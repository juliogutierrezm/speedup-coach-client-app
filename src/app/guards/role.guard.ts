import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AuthService, UserRole } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // Non-browser execution: avoid blocking route analysis when DOM APIs are unavailable.
    if (typeof window === 'undefined') {
      return of(true);
    }

    const requiredRoles = route.data?.['roles'] as UserRole[];
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return of(true);
    }

    return from(this.authService.initAuth()).pipe(
      switchMap(() => this.authService.whenResolved$()),
      switchMap(() => this.authService.currentUser$.pipe(take(1))),
      map(user => {
        if (!user) {
          return this.router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url }
          });
        }

        const isClientGroup = this.authService.hasClientGroup();
        if (!requiredRoles.includes(user.role) || !isClientGroup) {
          return this.router.createUrlTree(['/unauthorized']);
        }

        return true;
      })
    );
  }
}
