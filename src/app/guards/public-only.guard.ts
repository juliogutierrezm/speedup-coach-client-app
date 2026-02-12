import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, from, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Prevents rendering auth pages (login/forgot/change-password) when already authenticated.
 * Pure guard: no side-effects (no router.navigate).
 */
@Injectable({
  providedIn: 'root'
})
export class PublicOnlyGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    // SSR/build-time: allow route config extraction without hanging.
    if (typeof window === 'undefined') {
      return of(true);
    }

    // Ensure initAuth has been called (idempotent).
    return from(this.authService.initAuth()).pipe(
      switchMap(() => this.authService.whenResolved$()),
      map((status) => {
        if (status === 'authenticated') {
          return this.router.createUrlTree(['/plans']);
        }
        return true;
      })
    );
  }
}
