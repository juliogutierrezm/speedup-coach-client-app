import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { ClientDataService, PlanProgressionWeek, WorkoutPlan, WorkoutSession } from '../../services/client-data.service';
import { getSessionExerciseCount, getSessionPrimaryMuscle, hasFunctionalExercise } from '../../utils/session-exercise.utils';

/**
 * Purpose: Render a client plan detail view with its sessions list.
 * Input: planId route param. Output: UI rendering and navigation.
 * Error handling: shows inline error messages on load failures and safe empty states.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-plan-detail',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './client-plan-detail.component.html',
  styleUrls: ['./client-plan-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientPlanDetailComponent implements OnInit, OnDestroy {
  isLoading = false;
  plan: WorkoutPlan | null = null;
  planMissing = false;
  planId: string | null = null;
  sessionList: WorkoutSession[] = [];
  allPlans: WorkoutPlan[] = [];
  errorMessage = '';
  private planOrderMap = new Map<string, number>();

  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize the plan detail data flow.
   * Input: none. Output: void.
   * Error handling: handled in loadPlan with fallbacks.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadPlan();
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
   * Purpose: navigate back to the plan list.
   * Input: none. Output: void (navigation side effect).
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  goBack(): void {
    this.router.navigate(['/plans']);
  }

  /**
   * Purpose: navigate to the selected session exercise list.
   * Input: WorkoutSession and index. Output: void (navigation side effect).
   * Error handling: sets inline error message when plan id is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openSession(index: number): void {
    if (!this.planId) {
      this.errorMessage = 'No pudimos abrir esta sesion.';
      this.cdr.markForCheck();
      return;
    }

    this.router.navigate(['/plans', this.planId, 'session', index]);
  }

  /**
   * Purpose: support keyboard activation on session cards.
   * Input: KeyboardEvent, WorkoutSession, index. Output: void.
   * Error handling: guards against unrelated keys.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onSessionKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openSession(index);
    }
  }

  /**
   * Purpose: compute the display title for the plan header.
   * Input: none. Output: string.
   * Error handling: uses safe fallbacks.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get planTitle(): string {
    return this.plan?.objective || this.plan?.name || 'Plan de entrenamiento';
  }

  /**
   * Purpose: return the session count for a workout plan.
   * Input: WorkoutPlan. Output: number.
   * Error handling: returns 0 for missing sessions.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionCount(plan: WorkoutPlan | null): number {
    if (!plan) {
      return 0;
    }
    if (typeof plan.totalSessions === 'number') {
      return plan.totalSessions;
    }
    return Array.isArray(plan.sessions) ? plan.sessions.length : 0;
  }

  /**
   * Purpose: return the plan counter based on its position in the plans list.
   * Input: WorkoutPlan | null. Output: number.
   * Error handling: returns 0 when plan is null or not found in the list.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getplanCounter(plan: WorkoutPlan | null): number {
    if (!plan) {
      return 0;
    }
    const planKey = this.getPlanKey(plan);
    if (!planKey) {
      return 0;
    }
    return this.planOrderMap.get(planKey) ?? 0;
  }

  /**
   * Purpose: build a readable session title with fallback numbering.
   * Input: WorkoutSession and index. Output: string.
   * Error handling: uses default label when name is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionTitle(session: WorkoutSession, index: number): string {
    const name = session?.name?.trim();
    return name && name.length > 0 ? name : `Sesion ${index + 1}`;
  }

  /**
   * Purpose: return the exercise count for a session.
   * Input: WorkoutSession. Output: number.
   * Error handling: returns 0 for missing items.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionItemsCount(session: WorkoutSession): number {
    return getSessionExerciseCount(session);
  }

  /**
   * Purpose: resolve a primary muscle group label for a session card.
   * Input: WorkoutSession. Output: string | null.
   * Error handling: returns null when not available.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionPrimaryMuscle(session: WorkoutSession): string | null {
    return getSessionPrimaryMuscle(session);
  }

  /**
   * Purpose: detect if the session includes functional exercises.
   * Input: WorkoutSession. Output: boolean.
   * Error handling: returns false on missing data.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  isSessionFunctional(session: WorkoutSession): boolean {
    return hasFunctionalExercise(session);
  }

  /**
   * Purpose: build aria label for session cards.
   * Input: WorkoutSession and index. Output: string.
   * Error handling: uses safe fallbacks.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionAriaLabel(session: WorkoutSession, index: number): string {
    const title = this.getSessionTitle(session, index);
    return `Abrir ${title}`;
  }

  /**
   * Purpose: provide a stable trackBy key for progression week entries.
   * Input: index and PlanProgressionWeek. Output: string.
   * Error handling: falls back to index when week is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByProgressionWeek = (index: number, week: PlanProgressionWeek): string => {
    return Number.isFinite(week?.week) ? `${week.week}` : `${index}`;
  };

  /**
   * Purpose: load plan details based on the route param.
   * Input: none. Output: void.
   * Error handling: logs and sets inline error messages on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadPlan(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.route.paramMap
      .pipe(
        map(params => params.get('planId')),
        take(1),
        switchMap(planId => {
          this.planId = planId;
          return this.clientDataService.getMyPlans();
        }),
        map(plans => {
          this.allPlans = this.sortPlansByCreatedAt(plans ?? []);
          this.planOrderMap = this.buildPlanOrderMap(this.allPlans);
          return this.findPlan(this.allPlans, this.planId);
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
      .subscribe(plan => {
        this.applyPlanSnapshot(plan);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: apply the plan snapshot to local display state.
   * Input: WorkoutPlan | null. Output: void.
   * Error handling: resets state when plan is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private applyPlanSnapshot(plan: WorkoutPlan | null): void {
    this.plan = plan;
    this.planMissing = !plan;
    this.sessionList = Array.isArray(plan?.sessions) ? plan.sessions : [];
  }

  /**
   * Purpose: locate a plan by id within a plan list.
   * Input: plans array and planId. Output: WorkoutPlan | null.
   * Error handling: returns null when no matches are found.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private findPlan(plans: WorkoutPlan[], planId: string | null): WorkoutPlan | null {
    if (!planId) {
      return null;
    }

    return plans.find(plan => plan.planId === planId || plan.SK === planId) || null;
  }

  /**
   * Purpose: resolve a stable plan key for ordering and lookup.
   * Input: WorkoutPlan. Output: string | null.
   * Error handling: returns null when identifiers are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getPlanKey(plan: WorkoutPlan): string | null {
    return plan?.planId || plan?.SK || null;
  }

  /**
   * Purpose: sort plans by createdAt (desc) with safe fallbacks.
   * Input: WorkoutPlan[]. Output: WorkoutPlan[] sorted copy.
   * Error handling: treats missing dates as 0 epoch.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private sortPlansByCreatedAt(plans: WorkoutPlan[]): WorkoutPlan[] {
    return [...plans].sort((a, b) => {
      const dateA = this.getPlanSortTime(a);
      const dateB = this.getPlanSortTime(b);
      return dateB - dateA;
    });
  }

  /**
   * Purpose: build a deterministic ordering map for plan numbering.
   * Input: ordered WorkoutPlan[]. Output: Map<planKey, order>.
   * Error handling: skips plans without a stable key.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildPlanOrderMap(plans: WorkoutPlan[]): Map<string, number> {
    const map = new Map<string, number>();
    const total = plans.length;
    plans.forEach((plan, index) => {
      const key = this.getPlanKey(plan);
      if (key) {
        map.set(key, total - index);
      }
    });
    return map;
  }

  /**
   * Purpose: resolve a sort timestamp for plan ordering.
   * Input: WorkoutPlan. Output: number (ms).
   * Error handling: falls back to 0 for invalid dates.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getPlanSortTime(plan: WorkoutPlan): number {
    const createdAt = plan?.createdAt ? Date.parse(plan.createdAt) : NaN;
    if (Number.isFinite(createdAt)) {
      return createdAt;
    }
    const date = plan?.date ? Date.parse(plan.date) : NaN;
    return Number.isFinite(date) ? date : 0;
  }

  /**
   * Purpose: map plan load errors into user-friendly messages.
   * Input: error payload. Output: string message.
   * Error handling: provides a default fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getPlanErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer este plan.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver este plan.';
    if (status === 404) return 'No encontramos este plan.';
    if (status >= 500) return 'El servidor no pudo entregar este plan.';
    return 'No se pudo cargar el plan. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for plan load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientPlanDetail] load failed', { elapsedMs, error });
    this.errorMessage = this.getPlanErrorMessage(error);
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
}
