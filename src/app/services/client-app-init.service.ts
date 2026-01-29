import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ClientDataResponse, ClientDataService } from './client-data.service';
import { ThemeService } from './theme.service';

export type ClientInitState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Orquesta la inicialización post-auth (una sola llamada /clients).
 * - Corre SOLO después de authStatus === 'authenticated'
 * - Es idempotente: while in-flight comparte la misma promesa
 * - Es reseteable en signOut/unauthenticated
 */
@Injectable({ providedIn: 'root' })
export class ClientAppInitService {
  private stateSubject = new BehaviorSubject<ClientInitState>('idle');
  state$ = this.stateSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  private initPromise: Promise<void> | null = null;

  constructor(
    private authService: AuthService,
    private clientDataService: ClientDataService,
    private themeService: ThemeService
  ) {
    // Reset determinista cuando el auth vuelve a unauthenticated.
    this.authService.authStatus$.subscribe(status => {
      if (status === 'unauthenticated') {
        this.reset();
      }
    });
  }

  get stateSnapshot(): ClientInitState {
    return this.stateSubject.value;
  }

  get errorSnapshot(): string | null {
    return this.errorSubject.value;
  }

  /**
   * Inicializa datos del cliente exactamente una vez por sesión.
   * Reintentos: usar reset() o force: true.
   */
  initClientData(options?: { force?: boolean }): Promise<void> {
    const force = !!options?.force;

    if (!force) {
      if (this.stateSubject.value === 'ready') {
        return Promise.resolve();
      }
      if (this.initPromise) {
        return this.initPromise;
      }
    }

    this.stateSubject.next('loading');
    this.errorSubject.next(null);

    this.initPromise = (async () => {
      // Asegura que estamos autenticados antes de tocar /clients.
      const status = await firstValueFrom(
        this.authService.authStatus$.pipe(
          filter(s => s !== 'unknown'),
          take(1)
        )
      );

      if (status !== 'authenticated') {
        this.stateSubject.next('idle');
        this.errorSubject.next('No estás autenticado.');
        return;
      }

      const data: ClientDataResponse = await firstValueFrom(this.clientDataService.getClientData({ force }));

      // Apply theme SOLO cuando los datos completos han llegado.
      this.themeService.applyTheme(data?.theme ?? null);
      this.stateSubject.next('ready');
    })().catch((error) => {
      console.error('[ClientAppInit] initClientData failed', { error });
      this.stateSubject.next('error');
      this.errorSubject.next(this.mapError(error));
      // Propaga para que quien llame también pueda reaccionar (e.g. logging/telemetry)
      throw error;
    }).finally(() => {
      // Permite nuevos intentos cuando hubo error.
      if (this.stateSubject.value !== 'loading') {
        this.initPromise = this.stateSubject.value === 'ready' ? this.initPromise : null;
      }
    });

    return this.initPromise;
  }

  reset(): void {
    this.clientDataService.clearCache();
    this.stateSubject.next('idle');
    this.errorSubject.next(null);
    this.initPromise = null;
  }

  private mapError(error: any): string {
    const status = error?.status;
    if (status === 0) return 'No pudimos conectar con el servidor.';
    if (status === 401 || status === 403) return 'Tu sesión expiró. Inicia sesión de nuevo.';
    if (status === 404) return 'No encontramos tus datos.';
    if (status >= 500) return 'El servidor tuvo un problema cargando tus datos.';
    return 'No pudimos cargar tu información. Intenta de nuevo.';
  }
}
