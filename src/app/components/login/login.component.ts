import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
export class LoginComponent {
  loading = false;
  error: string | null = null;
  form!: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
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
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      this.router.navigateByUrl(returnUrl || '/plans');
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
