import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthError, AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  step: 'request' | 'confirm' = 'request';
  loading = false;
  error: string | null = null;
  success: string | null = null;
  emailForReset: string | null = null;
  showNewPassword = false;
  showConfirmPassword = false;

  requestForm!: FormGroup;

  confirmForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.requestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.confirmForm = this.fb.group({
      code: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), this.passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async sendCode() {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    const email = this.requestForm.value.email!;

    try {
      await this.authService.forgotPassword(email);
      this.emailForReset = email;
      this.step = 'confirm';
      this.success = 'Hemos enviado un código a tu correo.';
    } catch (err) {
      const e = err as AuthError;
      this.error = this.mapError(e.code);
    } finally {
      this.loading = false;
    }
  }

  async confirmReset() {
    if (this.confirmForm.invalid || !this.passwordsMatch()) {
      this.confirmForm.markAllAsTouched();
      return;
    }
    const email = this.emailForReset || this.requestForm.value.email;
    if (!email) {
      this.error = 'Ingresa tu correo para continuar.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    const { code, newPassword } = this.confirmForm.value;

    try {
      await this.authService.forgotPasswordSubmit(email, code!, newPassword!);
      this.success = 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.';
      this.router.navigate(['/login']);
    } catch (err) {
      const e = err as AuthError;
      this.error = this.mapError(e.code);
    } finally {
      this.loading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  get showMismatch(): boolean {
    return this.confirmForm.controls.confirmPassword.touched && !this.passwordsMatch();
  }

  private passwordsMatch(): boolean {
    const { newPassword, confirmPassword } = this.confirmForm.value;
    return !!newPassword && !!confirmPassword && newPassword === confirmPassword;
  }

  private passwordPolicyValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value) return null;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);
    return hasUpper && hasLower && hasDigit ? null : { policy: true };
  }

  private mapError(code?: string): string {
    switch (code) {
      case 'USER_NOT_FOUND':
        return 'Usuario no encontrado.';
      case 'CODE_MISMATCH':
        return 'El código ingresado es inválido.';
      case 'CODE_EXPIRED':
        return 'El código ha expirado. Solicita uno nuevo.';
      case 'INVALID_PASSWORD':
        return 'La contraseña no cumple con los requisitos.';
      default:
        return 'No pudimos completar la acción. Intenta de nuevo.';
    }
  }
}
