import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { from, of, Subject } from 'rxjs';
import { catchError, filter, finalize, takeUntil, tap } from 'rxjs/operators';
import { ThemeService, TenantTheme } from '../services/theme.service';
import { AuthService } from '../services/auth.service';
import { ClientDataService } from '../services/client-data.service';
import { environment } from '../../environments/environment';

type StatusTone = 'info' | 'success' | 'error';

@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './client-layout.component.html',
  styleUrls: ['./client-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientLayoutComponent implements OnInit, OnDestroy {
  isThemeLoading = true;
  isSigningOut = false;
  isDark = false;
  drawerOpen = false;
  debugThemeEnabled = !environment.production;
  debugDarkMode = false;
  themeTokens: Record<string, string> = {};
  currentTheme: TenantTheme | null = null;
  statusMessage = '';
  statusTone: StatusTone = 'info';

  private destroy$ = new Subject<void>();
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private themeService: ThemeService,
    private authService: AuthService,
    private clientDataService: ClientDataService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTenantTheme();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.drawerOpen) {
      this.closeDrawer();
    }
  }

  toggleDrawer(): void {
    this.drawerOpen = !this.drawerOpen;
    this.cdr.markForCheck();
  }

  closeDrawer(): void {
    if (this.drawerOpen) {
      this.drawerOpen = false;
      this.cdr.markForCheck();
    }
  }

  dismissStatus(): void {
    this.clearStatus();
  }

  signOut(): void {
    if (this.isSigningOut) {
      return;
    }

    const startedAt = this.getNowMs();
    this.isSigningOut = true;
    this.cdr.markForCheck();

    from(this.authService.signOut())
      .pipe(
        finalize(() => {
          this.isSigningOut = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (error) => {
          const elapsedMs = this.getElapsedMs(startedAt);
          console.error('[ClientLayout] signOut failed', { elapsedMs, error });
          this.showStatus('No se pudo cerrar sesion. Intenta de nuevo.', 'error');
        }
      });
  }

  onDebugThemeToggle(enabled: boolean): void {
    if (!this.currentTheme) {
      return;
    }

    const backgroundMode = enabled ? 'dark' : 'light';
    this.debugDarkMode = enabled;
    this.isDark = enabled;
    this.applyThemeSnapshot({
      ...this.currentTheme,
      backgroundMode
    });
  }

  private loadTenantTheme(): void {
    const startedAt = this.getNowMs();
    this.isThemeLoading = true;
    this.cdr.markForCheck();

    this.clientDataService.getClientData()
      .pipe(
        catchError(error => {
          this.handleThemeLoadError(error, startedAt);
          return of(null);
        }),
        finalize(() => {
          this.isThemeLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
    
    this.themeService.tenantTheme$
      .pipe(
        filter((theme): theme is TenantTheme => !!theme),
        tap(theme => this.applyThemeSnapshot(theme)),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private applyThemeSnapshot(theme: TenantTheme): void {
    const resolved = this.normalizeTheme(theme);
    const isDarkMode = resolved.backgroundMode === 'dark';
    this.currentTheme = resolved;
    this.debugDarkMode = isDarkMode;
    this.isDark = isDarkMode;
    this.setHtmlDarkClass(isDarkMode);

    this.themeTokens = {
      '--c-primary': resolved.primaryColor,
      '--c-accent': resolved.accentColor,
      '--c-font': resolved.fontFamily,
      '--c-app-name': resolved.appName || '',
      '--c-tagline': resolved.tagline || '',
      '--color-primary': this.colorToRgb(resolved.primaryColor, '12 74 110'),
      '--color-accent': this.colorToRgb(resolved.accentColor, '6 182 212')
    };

    this.cdr.markForCheck();
  }

  private handleThemeLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientLayout] tenant theme load failed', { elapsedMs, error });
    this.showStatus(this.getThemeErrorMessage(error), 'error');
  }

  private getThemeErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No se pudo validar el tema del tenant.';
    if (status === 401 || status === 403) return 'No tienes permisos para cargar el tema.';
    if (status === 404) return 'No encontramos un tema configurado.';
    if (status >= 500) return 'El servidor no pudo entregar el tema.';
    return 'No se pudo cargar el tema. Usando valores por defecto.';
  }

  private showStatus(message: string, tone: StatusTone): void {
    this.statusMessage = message;
    this.statusTone = tone;
    this.cdr.markForCheck();
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
    this.statusTimer = setTimeout(() => this.clearStatus(), 4200);
  }

  private clearStatus(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.statusMessage) {
      this.statusMessage = '';
      this.cdr.markForCheck();
    }
  }

  private normalizeTheme(theme: TenantTheme): TenantTheme {
    return {
      tenantId: theme.tenantId,
      tenantType: theme.tenantType,
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      backgroundMode: theme.backgroundMode,
      fontFamily: theme.fontFamily,
      appName: theme.appName || '',
      tagline: theme.tagline || '',
      logoUrl: theme.logoUrl || ''
    };
  }

  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  private getElapsedMs(startedAt: number): number {
    const now = this.getNowMs();
    const elapsed = now - startedAt;
    return Number.isFinite(elapsed) ? Math.round(elapsed) : 0;
  }

  private setHtmlDarkClass(enabled: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('dark', enabled);
  }

  private colorToRgb(color: string, fallback: string): string {
    const rgb = this.hexToRgb(color);
    return rgb ?? fallback;
  }

  private hexToRgb(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    let cleaned = value.trim();
    if (cleaned.startsWith('#')) {
      cleaned = cleaned.slice(1);
    }

    if (cleaned.length === 3) {
      cleaned = cleaned
        .split('')
        .map((segment) => `${segment}${segment}`)
        .join('');
    }

    const isValid = /^[0-9a-f]{6}$/i.test(cleaned);
    if (!isValid) {
      return null;
    }

    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
}
