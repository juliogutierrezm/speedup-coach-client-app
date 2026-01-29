import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, AuthStatus } from './services/auth.service';
import { SplashComponent } from './components/splash/splash.component';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SplashComponent
  ],
  template: `
    <app-splash *ngIf="(authStatus$ | async) === 'unknown'; else appContent"></app-splash>
    <ng-template #appContent>
      <router-outlet></router-outlet>
    </ng-template>
  `
})
export class AppComponent {
  authStatus$: Observable<AuthStatus>;

  constructor(private authService: AuthService) {
    this.authStatus$ = this.authService.authStatus$;
  }
}


