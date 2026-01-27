import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthError, AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  private sub?: Subscription;
  form!: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.sub = this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.router.navigate(['/plans']);
      }
    });
  }


  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;
    const { email, password } = this.form.value;

    try {
      const result = await this.authService.signIn(email!, password!);
      if (result === 'NEW_PASSWORD_REQUIRED') {
        this.loading = false;
        this.router.navigate(['/change-password']);
        return;
      }
      this.loading = false;
      this.router.navigate(['/plans']);
    } catch (err) {
      const e = err as AuthError;
      this.error = this.mapError(e?.code);
    } finally {
      // Ensure loading is false even if navigation didn't run
      this.loading = false;
    }
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  private mapError(code?: string): string {
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Correo o contraseña incorrectos.';
      case 'USER_NOT_FOUND':
        return 'Usuario no encontrado.';
      case 'PASSWORD_RESET_REQUIRED':
        return 'Debes restablecer tu contraseña.';
      case 'NOT_CLIENT':
        return 'Acceso no autorizado para esta aplicación.';
      default:
        return 'No pudimos iniciar sesión. Intenta de nuevo.';
    }
  }
}
