import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService, UserRole } from '../services/auth.service';

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
  ): Observable<boolean> {
    return this.checkAuth(route);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(childRoute);
  }

  private checkAuth(route: ActivatedRouteSnapshot): Observable<boolean> {
    // Always refresh auth state to get latest token/session
    return from(this.authService.checkAuthState()).pipe(
      switchMap(() => {
        // Check if authenticated
        if (!this.authService.isAuthenticatedSync()) {
          this.router.navigate(['/login']);
          return of(false);
        }

        // Check if user has Client group
        if (!this.authService.hasClientGroup()) {
          this.authService.signOut();
          this.router.navigate(['/login'], { state: { reason: 'unauthorized' } });
          return of(false);
        }

        // Check role if required
        const requiredRoles = route.data?.['roles'] as UserRole[];
        if (requiredRoles && requiredRoles.length > 0) {
          const user = this.authService.getCurrentUser();
          if (!user || !requiredRoles.includes(user.role)) {
            this.authService.signOut();
            this.router.navigate(['/login'], { state: { reason: 'unauthorized' } });
            return of(false);
          }
        }

        return of(true);
      })
    );
  }
}
