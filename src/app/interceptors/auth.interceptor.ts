import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isApiRequest = req.url.startsWith(environment.apiBase);

    // Requests que no van al API
    if (!isApiRequest || this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // NOTE: no redirects here. Interceptor must be side-effect free.
    // Attach token deterministically.

    const requiresAuthHeader = this.requiresAuthHeader(req.url);

    return this.getDeterministicIdToken$(requiresAuthHeader).pipe(
      switchMap(token => {
        if (!token) {
          // Only allow missing token when endpoint doesn't require auth.
          return next.handle(req);
        }

        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });

        return next.handle(authReq).pipe(catchError(err => this.handleApiError(err)));
      })
    );
  }

  private isPublicEndpoint(url: string): boolean {
    return ['/assets', '/health', '/public'].some(p => url.includes(p));
  }

  private requiresAuthHeader(url: string): boolean {
    // We can expand this list; right now the critical one is /clients.
    return url.includes('/clients');
  }

  /**
   * For endpoints that MUST be authenticated (e.g. /clients),
   * never let the request go out without a token when auth is resolved/authenticated.
   */
  private getDeterministicIdToken$(requiresAuthHeader: boolean): Observable<string | null> {
    if (!requiresAuthHeader) {
      return this.authService.getIdToken();
    }

    // If auth is authenticated, we should be able to fetch token.
    // If token comes back null due to timing, do one extra fetch after auth resolved.
    return from(this.authService.initAuth()).pipe(
      switchMap(() => this.authService.whenResolved$()),
      switchMap((status) => {
        if (status !== 'authenticated') {
          return throwError(() => new Error('Auth requerido pero no autenticado.'));
        }
        return this.authService.getIdToken().pipe(
          switchMap(token => {
            if (token) {
              return from([token]);
            }
            // One more attempt after forcing session resolution.
            return this.authService.getIdToken().pipe(
              map(t2 => {
                if (!t2) {
                  throw new Error('No se pudo obtener token para request autenticado.');
                }
                return t2;
              })
            );
          })
        );
      })
    );
  }

  private handleApiError(err: any): Observable<never> {
    // If needed in the future, detect 401/403 here and only then sign out
    // *after* auth is resolved, but still without navigation.
    // Example:
    // if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403) && this.authService.authStatusSync() === 'authenticated') {
    //   void this.authService.signOut();
    // }
    // Placeholder for future: when status is resolved and token invalid, we could trigger a signOut.
    // Requirement: never navigate from interceptor.
    // No navigation here. Let the UI decide what to do with 401/403.
    return throwError(() => err);
  }
}
