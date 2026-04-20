import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { ClientDataService, WorkoutPlan } from '../../services/client-data.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-client-plans',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './client-plans.component.html',
 styleUrls: ['./client-plans.component.scss']
  ,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientPlansComponent implements OnInit, OnDestroy {
  plans: WorkoutPlan[] = [];
  isLoading = false;
  errorMessage = '';
  private planOrderMap = new Map<string, number>();

  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public themeService: ThemeService
  ) {}


  /**
   * Purpose: initialize client plans list loading.
   * Input: none. Output: void.
   * Error handling: handled in loadPlans with fallback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadPlans();
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
   * Purpose: return the session count for a workout plan.
   * Input: WorkoutPlan. Output: number.
   * Error handling: returns 0 for missing sessions.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getSessionCount(plan: WorkoutPlan): number {
    if (typeof plan?.totalSessions === 'number') {
      return plan.totalSessions;
    }
    return Array.isArray(plan?.sessions) ? plan.sessions.length : 0;
  }

  /**
   * Purpose: return the plan counter based on its position in the plans list.
   * Input: WorkoutPlan. Output: number.
   * Error handling: returns 0 when plan is not found in the list.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlanCounter(plan: WorkoutPlan): number {
    const planKey = this.getPlanKey(plan);
    if (!planKey) {
      return 0;
    }
    return this.planOrderMap.get(planKey) ?? 0;
  }

  /**
   * Purpose: return accent border style for plan cards based on objective.
   * Input: WorkoutPlan. Output: string CSS style.
   * Error handling: returns default primary color border.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getAccentBorder(plan: WorkoutPlan): string {
    const colors: Record<string, string> = {
      'Ganar masa muscular': '#10b981',
      'Flexibilidad': '#10b981',
      'Pérdida de peso': '#f97316',
      'Fuerza': '#a855f7',
      'default': 'rgb(var(--color-primary))'
    };
    const color = colors[plan?.objective || ''] || colors.default;
    return `4px solid ${color}`;
  }

  /**
   * Purpose: return badge text based on plan objective.
   * Input: WorkoutPlan. Output: string | null.
   * Error handling: returns null for unknown objectives.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlanBadge(plan: WorkoutPlan): string | null {
    const badges: Record<string, string> = {
      'Ganar masa muscular': 'Más popular',
      'Flexibilidad': 'Recuperación',
      'Pérdida de peso': 'Alta intensidad',
      'Fuerza': 'Fuerza'
    };
    return badges[plan?.objective || ''] || null;
  }

  /**
   * Purpose: return Tailwind classes for badge styling based on objective.
   * Input: WorkoutPlan. Output: string.
   * Error handling: returns default primary badge classes.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getBadgeClasses(plan: WorkoutPlan): string {
    const classes: Record<string, string> = {
      'Ganar masa muscular': 'bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))]',
      'Flexibilidad': 'bg-emerald-500/10 text-emerald-500',
      'Pérdida de peso': 'bg-orange-500/10 text-orange-500',
      'Fuerza': 'bg-purple-500/10 text-purple-500',
      'default': 'bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))]'
    };
    return classes[plan?.objective || ''] || classes.default;
  }

  /**
   * Purpose: return Tailwind classes for icon background based on objective.
   * Input: WorkoutPlan. Output: string.
   * Error handling: returns default primary background.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getIconBgClasses(plan: WorkoutPlan): string {
    const classes: Record<string, string> = {
      'Ganar masa muscular': 'bg-[rgb(var(--color-primary))]/10',
      'Flexibilidad': 'bg-emerald-500/10',
      'Pérdida de peso': 'bg-orange-500/10',
      'Fuerza': 'bg-purple-500/10',
      'default': 'bg-[rgb(var(--color-primary))]/10'
    };
    return classes[plan?.objective || ''] || classes.default;
  }

  /**
   * Purpose: return Material Symbols icon name based on plan objective.
   * Input: WorkoutPlan. Output: string.
   * Error handling: returns default fitness_center icon.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlanIcon(plan: WorkoutPlan): string {
    const icons: Record<string, string> = {
      'Ganar masa muscular': 'fitness_center',
      'Flexibilidad': 'self_improvement',
      'Pérdida de peso': 'bolt',
      'Fuerza': 'exercise'
    };
    return icons[plan?.objective || ''] || 'fitness_center';
  }

  /**
   * Purpose: provide a stable trackBy key for plan rendering.
   * Input: index and plan. Output: string key.
   * Error handling: falls back to index when identifiers are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByPlan = (index: number, plan: WorkoutPlan): string => {
    return this.getPlanKey(plan) || `${index}`;
  };

  /**
   * Purpose: load workout plans for the authenticated client.
   * Input: none. Output: void.
   * Error handling: logs and falls back to empty list.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadPlans(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.clientDataService.getMyPlans()
      .pipe(
        catchError(error => {
          this.handleLoadError(error, startedAt);
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(plans => {
        this.plans = this.sortPlansByCreatedAt(plans ?? []);
        this.planOrderMap = this.buildPlanOrderMap(this.plans);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: navigate to the selected plan detail view.
   * Input: WorkoutPlan. Output: void (navigation side effect).
   * Error handling: sets inline error message when plan id is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openPlan(plan: WorkoutPlan): void {
    const planId = this.getPlanKey(plan);
    if (!planId) {
      this.errorMessage = 'No pudimos identificar este plan.';
      this.cdr.markForCheck();
      return;
    }

    this.router.navigate(['/plans', planId]);
  }

  /**
   * Purpose: support keyboard activation on plan cards.
   * Input: KeyboardEvent and WorkoutPlan. Output: void.
   * Error handling: guards against unrelated keys.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onPlanKeydown(event: KeyboardEvent, plan: WorkoutPlan): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPlan(plan);
    }
  }

  /**
   * Purpose: build aria label for plan cards.
   * Input: WorkoutPlan. Output: string.
   * Error handling: uses safe fallbacks when fields are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlanAriaLabel(plan: WorkoutPlan): string {
    const title = plan?.objective || plan?.name || 'Plan de entrenamiento';
    return `Abrir plan ${title}`;
  }

  /**
   * Purpose: resolve a stable key for plan navigation/rendering.
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
  private getPlansErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer tus planes.';
    if (status === 401 || status === 403) return 'No tienes permisos para ver tus planes.';
    if (status === 404) return 'No encontramos planes asignados.';
    if (status >= 500) return 'El servidor no pudo entregar tus planes.';
    return 'No se pudieron cargar tus planes. Intenta de nuevo.';
  }

  /**
   * Purpose: log structured context for plan load failures and show feedback.
   * Input: error object and start timestamp. Output: void.
   * Error handling: ensures UI stays stable with empty state.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientPlans] load failed', { elapsedMs, error });
    this.errorMessage = this.getPlansErrorMessage(error);
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
