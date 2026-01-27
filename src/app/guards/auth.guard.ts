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
    // If ya estamos autenticados, evita re-invocar checkAuthState en cada navegación
    if (this.authService.isAuthenticatedSync()) {
      return of(this.evaluateAccess(route));
    }

    // Si no hay estado, sincroniza una sola vez
    return from(this.authService.checkAuthState()).pipe(
      switchMap(() => of(this.evaluateAccess(route)))
    );
  }

  private evaluateAccess(route: ActivatedRouteSnapshot): boolean {
    // Check if authenticated
    if (!this.authService.isAuthenticatedSync()) {
      this.router.navigate(['/login']);
      return false;
    }

    // Check if user has Client group
    if (!this.authService.hasClientGroup()) {
      this.authService.signOut();
      this.router.navigate(['/login'], { state: { reason: 'unauthorized' } });
      return false;
    }

    // Check role if required
    const requiredRoles = route.data?.['roles'] as UserRole[];
    if (requiredRoles && requiredRoles.length > 0) {
      const user = this.authService.getCurrentUser();
      if (!user || !requiredRoles.includes(user.role)) {
        this.authService.signOut();
        this.router.navigate(['/login'], { state: { reason: 'unauthorized' } });
        return false;
      }
    }

    return true;
  }
}
