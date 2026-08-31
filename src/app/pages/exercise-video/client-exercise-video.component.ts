import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { ClientDataService, WorkoutPlan, WorkoutSession } from '../../services/client-data.service';
import { SessionExercise, flattenSessionItems, resolveExerciseMedia } from '../../utils/session-exercise.utils';
import { ThemeService } from '../../services/theme.service';

interface VideoLookup {
  plan: WorkoutPlan | null;
  session: WorkoutSession | null;
  exercise: SessionExercise | null;
}

/**
 * Purpose: render a dedicated exercise video view.
 * Input: planId, sessionIndex, exerciseIndex route params. Output: video playback UI.
 * Error handling: shows inline error messages on load failures and safe empty states.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-exercise-video',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './client-exercise-video.component.html',
  styleUrls: ['./client-exercise-video.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientExerciseVideoComponent implements OnInit, OnDestroy {
  isLoading = false;
  videoMissing = false;
  exerciseTitle = 'Ejercicio';
  videoUrl: string | null = null;
  videoPoster: string | null = null;
  youtubeEmbedUrl: SafeResourceUrl | null = null;
  isYouTubePlayerVisible = false;
  errorMessage = '';
  planTitle = 'Plan de entrenamiento';
  sessionTitle = '';

  private planId: string | null = null;
  private sessionIndex: number | null = null;
  private exerciseIndex: number | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
    private sanitizer: DomSanitizer
  ) {}

  /**
   * Purpose: initialize exercise video loading.
   * Input: none. Output: void.
   * Error handling: handled in loadVideo with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadVideo();
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
   * Purpose: navigate back to the exercise detail view.
   * Input: none. Output: void (navigation side effect).
   * Error handling: falls back to plan list when params are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  goBack(): void {
    if (this.planId && this.sessionIndex !== null && this.exerciseIndex !== null) {
      this.router.navigate([
        '/plans',
        this.planId,
        'session',
        this.sessionIndex,
        'exercise',
        this.exerciseIndex
      ]);
      return;
    }
    this.router.navigate(['/plans']);
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
   * Error handling: marks the exercise as missing when no fallback exists.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onNativeVideoError(): void {
    if (!this.videoUrl) {
      return;
    }

    this.videoUrl = null;
    this.videoMissing = !this.youtubeEmbedUrl;
    this.isYouTubePlayerVisible = false;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: load exercise video data based on route params.
   * Input: none. Output: void.
   * Error handling: logs and sets inline error messages on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadVideo(): void {
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
        this.applyVideoSnapshot(result);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: apply exercise lookup results into UI state.
   * Input: VideoLookup | null. Output: void.
   * Error handling: resets state when missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyVideoSnapshot(result: VideoLookup | null): void {
    if (!result?.exercise) {
      this.videoMissing = true;
      this.videoUrl = null;
      this.videoPoster = null;
      this.youtubeEmbedUrl = null;
      this.isYouTubePlayerVisible = false;
      return;
    }

    this.planTitle = this.getPlanTitle(result.plan);
    this.sessionTitle = this.getSessionTitle(result.session, this.sessionIndex ?? 0);
    this.exerciseTitle = this.getExerciseTitle(result.exercise);

    const media = resolveExerciseMedia(result.exercise);
    this.videoMissing = !media.hasPlayableVideo;
    this.videoUrl = media.preferredSource === 'native' ? media.nativeVideoUrl : null;
    this.videoPoster = media.thumbnailUrl;
    this.youtubeEmbedUrl = this.toTrustedYouTubeEmbedUrl(media.youtubeEmbedUrl);
    this.isYouTubePlayerVisible = false;
  }

  /**
   * Purpose: locate a plan session and exercise from the plan list.
   * Input: plans, planId, sessionIndex, exerciseIndex. Output: VideoLookup.
   * Error handling: returns null values when not found.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private findExercise(
    plans: WorkoutPlan[],
    planId: string,
    sessionIndex: number,
    exerciseIndex: number
  ): VideoLookup {
    const plan = plans.find(item => item.planId === planId || item.SK === planId) || null;
    const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
    const session = sessionIndex >= 0 && sessionIndex < sessions.length ? sessions[sessionIndex] : null;
    const exercises = flattenSessionItems(session?.items);
    const exercise = exerciseIndex >= 0 && exerciseIndex < exercises.length ? exercises[exerciseIndex] : null;
    return { plan, session, exercise };
  }

  /**
   * Purpose: return a readable exercise title.
   * Input: SessionExercise. Output: string.
   * Error handling: uses fallback when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getExerciseTitle(exercise: SessionExercise | null): string {
    const name = exercise?.name_es || exercise?.name;
    return name && name.trim().length > 0 ? name.trim() : 'Ejercicio';
  }

  /**
   * Purpose: build a readable plan title.
   * Input: WorkoutPlan. Output: string.
   * Error handling: uses fallback when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getPlanTitle(plan: WorkoutPlan | null): string {
    return plan?.objective || plan?.name || 'Plan de entrenamiento';
  }

  /**
   * Purpose: build a readable session title.
   * Input: WorkoutSession and index. Output: string.
   * Error handling: uses default label when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getSessionTitle(session: WorkoutSession | null, index: number): string {
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
   * Purpose: map video load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getVideoErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer este video.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver este video.';
    if (status === 404) return 'No encontramos este video.';
    if (status >= 500) return 'El servidor no pudo entregar este video.';
    return 'No se pudo cargar el video. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for video load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientExerciseVideo] load failed', { elapsedMs, error });
    this.errorMessage = this.getVideoErrorMessage(error);
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
