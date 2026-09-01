import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { ClientDataService, WorkoutPlan, WorkoutSession } from '../../services/client-data.service';
import {
  ClientExerciseWeightLogService,
  ExerciseWeightLog
} from '../../services/client-weight-entry.service';
import { SessionExercise, flattenSessionItems, resolveExerciseMedia } from '../../utils/session-exercise.utils';
import { ThemeService } from '../../services/theme.service';

interface ExerciseLookup {
  plan: WorkoutPlan | null;
  session: WorkoutSession | null;
  exercise: SessionExercise | null;
}

type WeightUnit = 'kg' | 'lb';

const POUNDS_PER_KILOGRAM = 2.2046226218;

/**
 * Purpose: render the detail view for a selected exercise.
 * Input: planId, sessionIndex, exerciseIndex route params. Output: UI rendering and navigation.
 * Error handling: shows inline error messages on load failures and safe empty states.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-exercise-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './client-exercise-detail.component.html',
  styleUrls: ['./client-exercise-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientExerciseDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  exerciseMissing = false;
  planTitle = 'Plan de entrenamiento';
  sessionTitle = '';
  exercise: SessionExercise | null = null;
  descriptionText = '';
  tips: string[] = [];
  mistakes: string[] = [];
  primaryMuscle: string | null = null;
  secondaryMuscles: string[] = [];
  previewUrl: string | null = null;
  videoPoster: string | null = null;
  youtubeEmbedUrl: SafeResourceUrl | null = null;
  isYouTubePlayerVisible = false;
  errorMessage = '';
  weightLogs: ExerciseWeightLog[] = [];
  weightLogCount = 0;
  isWeightLogFormOpen = false;
  editingWeightLog: ExerciseWeightLog | null = null;
  logPendingDelete: ExerciseWeightLog | null = null;
  isDeletingWeightLog = false;
  weightAmount: number | null = null;
  weightUnit: WeightUnit = 'kg';
  readonly todayDate = this.getTodayDate();
  recordedAt = this.todayDate;
  weightNote = '';
  isWeightLogLoading = false;
  isSavingWeightLog = false;
  weightLogError = '';
  weightLogSuccess = '';

  private planId: string | null = null;
  private sessionIndex: number | null = null;
  private exerciseIndex: number | null = null;
  private imageError = false;
  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public themeService: ThemeService,
    private sanitizer: DomSanitizer,
    private exerciseWeightLogService: ClientExerciseWeightLogService
  ) {}

  /**
   * Purpose: initialize exercise detail loading.
   * Input: none. Output: void.
   * Error handling: handled in loadExercise with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadExercise();
  }

  /**
   * Purpose: clean up subscriptions on component destroy.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Purpose: navigate back to the session exercises list.
   * Input: none. Output: void (navigation side effect).
   * Error handling: falls back to plan list when params are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  goBack(): void {
    if (this.planId && this.sessionIndex !== null) {
      this.router.navigate(['/plans', this.planId, 'session', this.sessionIndex]);
      return;
    }
    this.router.navigate(['/plans']);
  }

  /**
   * Purpose: return a readable exercise title.
   * Input: SessionExercise. Output: string.
   * Error handling: uses fallback when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getExerciseTitle(exercise: SessionExercise | null): string {
    const name = exercise?.name_es || exercise?.name;
    return name && name.trim().length > 0 ? name.trim() : 'Ejercicio';
  }

  /**
   * Purpose: format numbers or strings for display.
   * Input: unknown value. Output: string.
   * Error handling: returns '-' for missing values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatValue(value: unknown): string {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? `${value}` : '-';
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return '-';
  }

  /**
   * Purpose: return a weight label only when data exists.
   * Input: unknown weight. Output: string | null.
   * Error handling: returns null for missing values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getWeightValue(weight: unknown): string | null {
    if (typeof weight === 'number') {
      return Number.isFinite(weight) ? `${weight}` : null;
    }
    if (typeof weight === 'string') {
      const trimmed = weight.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  /**
   * Purpose: format rest values with seconds suffix.
   * Input: number | undefined. Output: string.
   * Error handling: returns '-' when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatRest(rest?: number): string {
    if (typeof rest === 'number' && Number.isFinite(rest)) {
      return `${rest}s`;
    }
    return '-';
  }

  /**
   * Purpose: flag image load failures for placeholder rendering.
   * Input: none. Output: void.
   * Error handling: ignores duplicate errors.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onImageError(): void {
    if (!this.imageError) {
      this.imageError = true;
      this.cdr.markForCheck();
    }
  }

  /**
   * Purpose: determine if the resolved poster thumbnail is still usable.
   * Input: none. Output: boolean.
   * Error handling: returns false on missing or errored image.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  hasThumbnail(): boolean {
    return Boolean(this.videoPoster) && !this.imageError;
  }

  /**
   * Purpose: reveal the YouTube fallback inline player after the user interacts.
   * Input: none. Output: void.
   * Error handling: ignores calls when no YouTube fallback exists.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  playYouTubeVideo(): void {
    if (!this.youtubeEmbedUrl || this.isYouTubePlayerVisible) {
      return;
    }

    this.isYouTubePlayerVisible = true;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: switch to the YouTube fallback when the hosted video cannot load.
   * Input: none. Output: void.
   * Error handling: falls back to an empty state when no YouTube video exists.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onNativeVideoError(): void {
    if (!this.previewUrl) {
      return;
    }

    this.previewUrl = null;
    this.isYouTubePlayerVisible = false;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: open the weight log form in create mode.
   * Input: none. Output: void.
   * Error handling: clears stale inline feedback before user input.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openWeightLogForm(): void {
    this.resetWeightLogFormState();
    this.isWeightLogFormOpen = true;
    this.weightLogError = '';
    this.weightLogSuccess = '';
    this.cdr.markForCheck();
  }

  saveWeightLog(): void {
    const rawExerciseId = this.exercise?.id || (this.exercise as any)?.exerciseId;
    if (!this.planId || !rawExerciseId || !this.exercise) {
      this.weightLogError = 'No pudimos identificar este ejercicio.';
      this.cdr.markForCheck();
      return;
    }

    if (typeof this.weightAmount !== 'number' || !Number.isFinite(this.weightAmount) || this.weightAmount <= 0) {
      this.weightLogError = `Ingresa una carga valida entre 0,1 y ${this.maximumWeightForUnit} ${this.weightUnit}.`;
      this.weightLogSuccess = '';
      this.cdr.markForCheck();
      return;
    }

    const maxAllowed = this.weightUnit === 'kg' ? 2000 : 2000 * POUNDS_PER_KILOGRAM;
    if (this.weightAmount > maxAllowed) {
      this.weightLogError = `Ingresa una carga valida entre 0,1 y ${this.maximumWeightForUnit} ${this.weightUnit}.`;
      this.weightLogSuccess = '';
      this.cdr.markForCheck();
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.recordedAt)) {
      this.weightLogError = 'Selecciona una fecha valida.';
      this.weightLogSuccess = '';
      this.cdr.markForCheck();
      return;
    }

    this.isSavingWeightLog = true;
    this.weightLogError = '';
    this.weightLogSuccess = '';
    this.cdr.markForCheck();

    if (this.editingWeightLog) {
      const logId = this.editingWeightLog.logId || this.editingWeightLog.id || '';
      const originalPerformedAt = this.editingWeightLog.performedAt;

      this.exerciseWeightLogService.updateLog({
        planId: this.planId,
        exerciseId: rawExerciseId,
        logId,
        originalPerformedAt,
        weight: this.weightAmount,
        unit: this.weightUnit,
        performedAt: this.recordedAt,
        note: this.weightNote.trim() || undefined
      })
        .pipe(
          catchError(error => {
            console.error('[ClientExerciseDetail] weight log update failed', { error });
            this.weightLogError = 'No se pudo actualizar la carga. Intenta de nuevo.';
            return EMPTY;
          }),
          finalize(() => {
            this.isSavingWeightLog = false;
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          this.resetWeightLogFormState();
          this.isWeightLogFormOpen = false;
          this.weightLogSuccess = 'Carga actualizada.';
          this.loadWeightLogs();
          this.cdr.markForCheck();
        });
      return;
    }

    this.exerciseWeightLogService.createLog({
      planId: this.planId,
      exerciseId: rawExerciseId,
      weight: this.weightAmount,
      unit: this.weightUnit,
      performedAt: this.recordedAt,
      note: this.weightNote.trim() || undefined
    })
      .pipe(
        catchError(error => {
          console.error('[ClientExerciseDetail] weight log save failed', { error });
          this.weightLogError = 'No se pudo registrar la carga. Intenta de nuevo.';
          return EMPTY;
        }),
        finalize(() => {
          this.isSavingWeightLog = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.resetWeightLogFormState();
        this.isWeightLogFormOpen = false;
        this.weightLogSuccess = 'Carga registrada.';
        this.loadWeightLogs();
        this.cdr.markForCheck();
      });
  }

  startEditWeightLog(log: ExerciseWeightLog): void {
    this.isWeightLogFormOpen = true;
    this.editingWeightLog = log;
    this.weightAmount = typeof log.weight === 'number' && Number.isFinite(log.weight)
      ? log.weight
      : ((log as any).weightKg ?? null);
    this.weightUnit = log.unit || 'kg';
    this.recordedAt = this.extractDateInputString(log.performedAt);
    this.weightNote = log.note || '';
    this.weightLogError = '';
    this.weightLogSuccess = '';
    this.cdr.markForCheck();
  }

  cancelEditWeightLog(): void {
    this.cancelWeightLogForm();
  }

  /**
   * Purpose: close the weight log form without persisting changes.
   * Input: none. Output: void.
   * Error handling: clears transient validation and success messages.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  cancelWeightLogForm(): void {
    this.resetWeightLogFormState();
    this.isWeightLogFormOpen = false;
    this.weightLogError = '';
    this.weightLogSuccess = '';
    this.cdr.markForCheck();
  }

  /**
   * Purpose: restore the editable weight log fields to create-mode defaults.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private resetWeightLogFormState(): void {
    this.editingWeightLog = null;
    this.weightAmount = null;
    this.weightUnit = 'kg';
    this.recordedAt = this.getTodayDate();
    this.weightNote = '';
  }

  promptDeleteWeightLog(log: ExerciseWeightLog): void {
    this.logPendingDelete = log;
    this.cdr.markForCheck();
  }

  cancelDeleteWeightLog(): void {
    this.logPendingDelete = null;
    this.cdr.markForCheck();
  }

  confirmDeleteWeightLog(): void {
    if (!this.logPendingDelete) {
      return;
    }

    const rawExerciseId = this.exercise?.id || (this.exercise as any)?.exerciseId;
    const logId = this.logPendingDelete.logId || this.logPendingDelete.id || '';
    const performedAt = this.logPendingDelete.performedAt;

    if (!this.planId || !rawExerciseId || !logId || !performedAt) {
      this.weightLogError = 'No pudimos identificar el registro a eliminar.';
      this.logPendingDelete = null;
      this.cdr.markForCheck();
      return;
    }

    this.isDeletingWeightLog = true;
    this.weightLogError = '';
    this.cdr.markForCheck();

    const deletedLog = this.logPendingDelete;

    this.exerciseWeightLogService.deleteLog(this.planId, rawExerciseId, logId, performedAt)
      .pipe(
        catchError(error => {
          console.error('[ClientExerciseDetail] weight log delete failed', { error });
          this.weightLogError = 'No se pudo eliminar el registro. Intenta de nuevo.';
          return EMPTY;
        }),
        finalize(() => {
          this.isDeletingWeightLog = false;
          this.logPendingDelete = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (
          this.editingWeightLog &&
          (this.editingWeightLog.logId === deletedLog.logId || this.editingWeightLog.id === deletedLog.id)
        ) {
          this.cancelEditWeightLog();
        }
        this.weightLogSuccess = 'Registro eliminado.';
        this.loadWeightLogs();
        this.cdr.markForCheck();
      });
  }

  onWeightUnitChange(unit: WeightUnit): void {
    if (unit === this.weightUnit) {
      return;
    }

    this.weightUnit = unit;
    this.cdr.markForCheck();
  }

  get maximumWeightForUnit(): number {
    return this.weightUnit === 'kg' ? 2000 : Math.round(2000 * POUNDS_PER_KILOGRAM);
  }

  formatWeightLog(log: ExerciseWeightLog): string {
    const rawWeight = typeof log.weight === 'number' && Number.isFinite(log.weight)
      ? log.weight
      : (log as any).weightKg;

    if (typeof rawWeight !== 'number' || !Number.isFinite(rawWeight)) {
      return '-';
    }

    const logUnit = log.unit || 'kg';
    const decimals = Number.isInteger(rawWeight) ? 0 : 1;
    return `${rawWeight.toFixed(decimals)} ${logUnit}`;
  }

  formatWeightLogDate(value?: string): string {
    if (!value) return '';

    const datePart = value.split('T')[0];
    const [year, month, day] = datePart.split('-');

    if (!year || !month || !day) return value;

    return `${day}/${month}/${year}`;
  }

  trackByWeightLog = (_index: number, log: ExerciseWeightLog): string => log.logId || log.id || `${log.performedAt}-${_index}`;

  private extractDateInputString(value?: string): string {
    if (!value) return this.getTodayDate();
    const datePart = value.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : this.getTodayDate();
  }

  /**
   * Purpose: load exercise detail based on route params.
   * Input: none. Output: void.
   * Error handling: logs and sets inline error messages on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadExercise(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.route.paramMap
      .pipe(
        map(params => ({
          planId: params.get('planId'),
          sessionIndex: this.parseIndex(params.get('sessionIndex')),
          exerciseIndex: this.parseIndex(params.get('exerciseIndex'))
        })),
        take(1),
        switchMap(({ planId, sessionIndex, exerciseIndex }) => {
          this.planId = planId;
          this.sessionIndex = sessionIndex;
          this.exerciseIndex = exerciseIndex;
          if (!planId || sessionIndex === null || exerciseIndex === null) {
            return of(null);
          }
          return this.clientDataService.getMyPlans().pipe(
            map(plans => this.findExercise(plans, planId, sessionIndex, exerciseIndex))
          );
        }),
        catchError(error => {
          this.handleLoadError(error, startedAt);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(result => {
        this.applyExerciseSnapshot(result);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: apply exercise lookup results into UI state.
   * Input: ExerciseLookup | null. Output: void.
   * Error handling: resets state when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyExerciseSnapshot(result: ExerciseLookup | null): void {
    if (!result?.plan || !result.session || !result.exercise) {
      this.exerciseMissing = true;
      this.exercise = null;
      this.descriptionText = '';
      this.tips = [];
      this.mistakes = [];
      this.primaryMuscle = null;
      this.secondaryMuscles = [];
      this.previewUrl = null;
      this.videoPoster = null;
      this.youtubeEmbedUrl = null;
      this.isYouTubePlayerVisible = false;
      this.imageError = false;
      this.weightLogs = [];
      this.weightLogCount = 0;
      return;
    }

    this.exerciseMissing = false;
    this.exercise = result.exercise;
    this.planTitle = result.plan.objective || result.plan.name || 'Plan de entrenamiento';
    this.sessionTitle = this.getSessionTitle(result.session, this.sessionIndex ?? 0);
    this.descriptionText = this.getDescription(result.exercise);
    this.tips = this.normalizeTextList(result.exercise.tips);
    this.mistakes = this.normalizeTextList(result.exercise.common_mistakes);
    this.primaryMuscle = this.normalizeText(result.exercise.muscle_group);
    this.secondaryMuscles = this.normalizeTextList(result.exercise.secondary_muscles);
    this.imageError = false;

    const media = resolveExerciseMedia(result.exercise);
    this.previewUrl = media.preferredSource === 'native' ? media.nativeVideoUrl : null;
    this.videoPoster = media.thumbnailUrl;
    this.youtubeEmbedUrl = this.toTrustedYouTubeEmbedUrl(media.youtubeEmbedUrl);
    this.isYouTubePlayerVisible = false;
    this.loadWeightLogs();
  }

  private loadWeightLogs(): void {
    const rawExerciseId = this.exercise?.id || (this.exercise as any)?.exerciseId;
    if (!this.planId || !rawExerciseId) {
      return;
    }

    this.isWeightLogLoading = true;
    this.weightLogError = '';
    this.exerciseWeightLogService.getLogs(this.planId, rawExerciseId)
      .pipe(
        catchError(error => {
          console.error('[ClientExerciseDetail] weight logs load failed', { error });
          this.weightLogError = 'No se pudo cargar el historial de cargas.';
          return of({ count: 0, items: [] as ExerciseWeightLog[] });
        }),
        finalize(() => {
          this.isWeightLogLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(response => {
        const items = Array.isArray(response?.items) ? response.items : [];
        this.weightLogs = this.sortWeightLogs(items);
        this.weightLogCount = typeof response?.count === 'number' ? response.count : items.length;
        this.cdr.markForCheck();
      });
  }

  private sortWeightLogs(logs: ExerciseWeightLog[]): ExerciseWeightLog[] {
    return [...logs].sort((first, second) => {
      const dateA = first.performedAt || (first as any).recordedAt || '';
      const dateB = second.performedAt || (second as any).recordedAt || '';
      return dateB.localeCompare(dateA);
    });
  }

  /**
   * Purpose: locate a plan session and exercise from the plan list.
   * Input: plans, planId, sessionIndex, exerciseIndex. Output: ExerciseLookup.
   * Error handling: returns null values when not found.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private findExercise(
    plans: WorkoutPlan[],
    planId: string,
    sessionIndex: number,
    exerciseIndex: number
  ): ExerciseLookup {
    const plan = plans.find(item => item.planId === planId || item.SK === planId) || null;
    const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
    const session = sessionIndex >= 0 && sessionIndex < sessions.length ? sessions[sessionIndex] : null;
    const exercises = flattenSessionItems(session?.items);
    const exercise = exerciseIndex >= 0 && exerciseIndex < exercises.length ? exercises[exerciseIndex] : null;
    return { plan, session, exercise };
  }

  /**
   * Purpose: build a fallback session title.
   * Input: WorkoutSession and index. Output: string.
   * Error handling: uses default label when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getSessionTitle(session: WorkoutSession, index: number): string {
    return this.themeService.resolveSessionName(session?.name, index);
  }

  /**
   * Purpose: parse route params to a safe index.
   * Input: string | null. Output: number | null.
   * Error handling: returns null for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private parseIndex(value: string | null): number | null {
    if (value === null) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  /**
   * Purpose: normalize description text for display.
   * Input: SessionExercise. Output: string.
   * Error handling: returns empty string when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getDescription(exercise: SessionExercise): string {
    const text = exercise?.description_es || exercise?.description_en || '';
    return typeof text === 'string' ? text.trim() : '';
  }

  /**
   * Purpose: normalize a label string.
   * Input: unknown. Output: string | null.
   * Error handling: returns null for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeText(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  /**
   * Purpose: normalize arrays of strings for list rendering.
   * Input: unknown. Output: string[].
   * Error handling: returns empty array for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeTextList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter(item => typeof item === 'string' && item.trim().length > 0).map(item => item.trim());
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
  }

  /**
   * Purpose: map exercise load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getExerciseErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer este ejercicio.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver este ejercicio.';
    if (status === 404) return 'No encontramos este ejercicio.';
    if (status >= 500) return 'El servidor no pudo entregar este ejercicio.';
    return 'No se pudo cargar el ejercicio. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for exercise load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientExerciseDetail] load failed', { elapsedMs, error });
    this.errorMessage = this.getExerciseErrorMessage(error);
    this.cdr.markForCheck();
  }

  /**
   * Purpose: return a monotonic timestamp for elapsed time logging.
   * Input: none. Output: number (ms).
   * Error handling: falls back to Date.now when performance is unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = `${today.getMonth() + 1}`.padStart(2, '0');
    const day = `${today.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toKilograms(amount: number | null): number | null {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }

    const kilograms = this.weightUnit === 'kg' ? amount : amount / POUNDS_PER_KILOGRAM;
    return Number(kilograms.toFixed(3));
  }

  /**
   * Purpose: compute elapsed milliseconds from a start timestamp.
   * Input: start time. Output: elapsed ms (rounded).
   * Error handling: guards against invalid timestamps.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getElapsedMs(startedAt: number): number {
    const now = this.getNowMs();
    const elapsed = now - startedAt;
    return Number.isFinite(elapsed) ? Math.round(elapsed) : 0;
  }

  /**
   * Purpose: sanitize the YouTube embed URL for iframe binding.
   * Input: raw embed URL. Output: SafeResourceUrl | null.
   * Error handling: returns null when no usable URL exists.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private toTrustedYouTubeEmbedUrl(url: string | null): SafeResourceUrl | null {
    if (!url) {
      return null;
    }

    const autoplayUrl = `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(autoplayUrl);
  }
}
