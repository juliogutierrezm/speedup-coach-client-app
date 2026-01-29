import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
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
    // Attach token if available.
    return this.authService.getIdToken().pipe(
      switchMap(token => {
        if (!token) {
          return next.handle(req);
        }

        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });

        return next.handle(authReq).pipe(
          catchError(err => this.handleApiError(err))
        );
      })
    );
  }

  private isPublicEndpoint(url: string): boolean {
    return ['/assets', '/health', '/public'].some(p => url.includes(p));
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
