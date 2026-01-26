import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthError, AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  form!: FormGroup;

  loading = false;
  error: string | null = null;
  private sub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8), this.passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.sub = this.authService.authState$.subscribe(state => {
      if (state.pendingChallenge !== 'NEW_PASSWORD_REQUIRED') {
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async onSubmit() {
    if (this.form.invalid || !this.passwordsMatch()) {
      this.form.markAllAsTouched();
      return;
    }

    const newPassword = this.form.value.newPassword!;
    this.loading = true;
    this.error = null;

    try {
      await this.authService.completeNewPassword(newPassword);
      this.router.navigate(['/plans']);
    } catch (err) {
      const e = err as AuthError;
      this.error = this.mapError(e.code);
    } finally {
      this.loading = false;
    }
  }

  async backToLogin() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  get showMismatch(): boolean {
    return this.form.controls.confirmPassword.touched && !this.passwordsMatch();
  }

  private passwordsMatch(): boolean {
    const { newPassword, confirmPassword } = this.form.value;
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
      case 'INVALID_PASSWORD':
        return 'La contraseña no cumple con los requisitos.';
      default:
        return 'No pudimos actualizar la contraseña. Intenta de nuevo.';
    }
  }
}
