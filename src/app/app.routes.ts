import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { UserRole } from './services/auth.service';
import { ClientLayoutComponent } from './layout/client-layout.component';

const clientRoutes: Routes = [
  {
    path: 'plans/:planId/session/:sessionIndex/exercise/:exerciseIndex/video',
    loadComponent: () =>
      import('./pages/exercise-video/client-exercise-video.component').then(
        m => m.ClientExerciseVideoComponent
      )
  },
  {
    path: 'plans/:planId/session/:sessionIndex/exercise/:exerciseIndex',
    loadComponent: () =>
      import('./pages/exercise-detail/client-exercise-detail.component').then(
        m => m.ClientExerciseDetailComponent
      )
  },
  {
    path: 'plans/:planId/session/:sessionIndex',
    loadComponent: () =>
      import('./pages/session-exercises/client-session-exercises.component').then(
        m => m.ClientSessionExercisesComponent
      )
  },
  {
    path: 'plans/:planId',
    loadComponent: () =>
      import('./pages/plan-detail/client-plan-detail.component').then(
        m => m.ClientPlanDetailComponent
      )
  },
  {
    path: 'plans',
    loadComponent: () =>
      import('./pages/plans/client-plans.component').then(m => m.ClientPlansComponent)
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/client-profile.component').then(m => m.ClientProfileComponent)
  },
  {
    path: 'body-composition',
    loadComponent: () =>
      import('./pages/body-composition/client-body-composition.component').then(
        m => m.ClientBodyCompositionComponent
      )
  },
  { path: '', redirectTo: 'plans', pathMatch: 'full' },
  { path: '**', redirectTo: 'plans' }
];

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./components/change-password/change-password.component').then(m => m.ChangePasswordComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./components/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  {
    path: '',
    component: ClientLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    data: { roles: [UserRole.CLIENT] },
    children: clientRoutes
  },
  { path: '**', redirectTo: 'plans' }
];
