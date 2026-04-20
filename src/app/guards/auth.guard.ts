import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, from, map, switchMap } from 'rxjs';
import { AuthService, UserRole } from '../services/auth.service';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.checkAuth(route, state.url);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.checkAuth(childRoute, state.url);
  }

  private checkAuth(route: ActivatedRouteSnapshot, url: string): Observable<boolean | UrlTree> {
    // Non-browser execution: avoid blocking route analysis when DOM APIs are unavailable.
    if (typeof window === 'undefined') {
      return of(true);
    }

    // Ensure initAuth was called (idempotent).
    return from(this.authService.initAuth()).pipe(
      switchMap(() => this.authService.whenResolved$()),
      map(() => this.evaluateAccess(route, url))
    );
  }

  private evaluateAccess(route: ActivatedRouteSnapshot, url: string): boolean | UrlTree {
    // Check if authenticated
    if (!this.authService.isAuthenticatedSync()) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: url }
      });
    }

    // Check if user has Client group
    if (!this.authService.hasClientGroup()) {
      return this.router.createUrlTree(['/unauthorized']);
    }

    // Check role if required
    const requiredRoles = route.data?.['roles'] as UserRole[];
    if (requiredRoles && requiredRoles.length > 0) {
      const user = this.authService.getCurrentUser();
      if (!user || !requiredRoles.includes(user.role)) {
        return this.router.createUrlTree(['/unauthorized']);
      }
    }

    return true;
  }
}
