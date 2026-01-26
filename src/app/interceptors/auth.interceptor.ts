import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isApiRequest = req.url.startsWith(environment.apiBase);

    // Requests que no van al API
    if (!isApiRequest || this.isPublicEndpoint(req.url)) {
      return next.handle(req);
    }

    // Usuario no autenticado - BLOQUEAR request
    if (!this.authService.isAuthenticatedSync()) {
      this.authService.signOut();
      this.router.navigate(['/login']);
      return throwError(() => new Error('Unauthorized'));
    }

    return this.authService.getAccessToken().pipe(
      switchMap(token => {
        const authReq = token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req;

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
    if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
      this.authService.signOut();
      this.router.navigate(['/login']);
    }
    return throwError(() => err);
  }
}


