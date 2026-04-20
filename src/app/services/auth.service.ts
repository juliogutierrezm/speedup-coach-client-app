import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, filter, map, take } from 'rxjs/operators';
import {
  confirmResetPassword,
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  signIn,
  signOut
} from 'aws-amplify/auth';
import { awsExports } from '../../aws-exports';
import { ThemeService } from './theme.service';

export interface UserProfile {
  id: string;
  email: string;
  givenName?: string;
  familyName?: string;
  role: UserRole;
  companyId?: string;
  trainerIds?: string[];
  isActive: boolean;
}

export enum UserRole {
  ADMIN = 'admin',
  TRAINER = 'trainer',
  CLIENT = 'client'
}

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  /**
   * Deprecated. Use `authStatus` instead.
   * Kept temporarily for minimal churn across components.
   */
  authenticated: boolean;
  claims: any | null;
  groups: string[];
  pendingChallenge?: 'NEW_PASSWORD_REQUIRED' | null;
  pendingEmail?: string | null;
  authStatus?: AuthStatus;
}

export interface AuthError extends Error {
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  /**
   * Auth machine status:
   * - unknown: not yet resolved
   * - authenticated: valid tokens + user profile loaded
   * - unauthenticated: no valid session
   */
  private authStatusSubject = new BehaviorSubject<AuthStatus>('unknown');
  private authStateSubject = new BehaviorSubject<AuthState>({
    authenticated: false,
    claims: null,
    groups: [],
    pendingChallenge: null,
    pendingEmail: null,
    authStatus: 'unknown'
  });
  private readonly isBrowser: boolean;

  private initAuthPromise: Promise<void> | null = null;

  public currentUser$ = this.currentUserSubject.asObservable();
  /** Convenience boolean stream for existing components. */
  public isAuthenticated$ = this.authStatusSubject.pipe(map(s => s === 'authenticated'));
  public authStatus$ = this.authStatusSubject.asObservable();
  public authState$ = this.authStateSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private themeService: ThemeService
  ) {
    // Some build-time tooling can run with a "browser" platformId
    // but without real DOM globals. Guard against executing browser-only code in that context.
    this.isBrowser =
      isPlatformBrowser(platformId) &&
      typeof window !== 'undefined' &&
      typeof document !== 'undefined';
    if (this.isBrowser) {
      this.logConfig();
    }
  }

  /**
   * Resolves auth status deterministically.
   * Idempotent: multiple callers share the same promise.
    */
  initAuth(): Promise<void> {
    if (!this.isBrowser) {
      // Non-browser execution should stay neutral until the app runs in a real browser.
      return Promise.resolve();
    }

    if (this.initAuthPromise) {
      return this.initAuthPromise;
    }

    this.initAuthPromise = (async () => {
      try {
        const session = await fetchAuthSession();
        const hasTokens = !!session.tokens?.idToken;

        if (!hasTokens) {
          this.setUnauthenticated();
          return;
        }

        const user = await getCurrentUser();
        const userProfile = await this.buildUserProfile(user, session);
        const claims = session.tokens?.idToken?.payload ?? null;
        const groups = this.extractGroups(claims);

        this.currentUserSubject.next(userProfile);
        this.setAuthenticated({ claims, groups });
      } catch {
        this.setUnauthenticated();
      }
    })().finally(() => {
      // Important: never remain unknown after initAuth completes in browser.
      if (this.authStatusSubject.value === 'unknown') {
        this.setUnauthenticated();
      }
    });

    return this.initAuthPromise;
  }

  /** Backwards-compat alias: guards used to call this. */
  async checkAuthState(): Promise<void> {
    await this.initAuth();
  }

  private async buildUserProfile(user: any, session: any): Promise<UserProfile> {
    const idToken = session.tokens?.idToken;
    const accessToken = session.tokens?.accessToken;
    const idPayload = idToken?.payload || {};
    const accessPayload = accessToken?.payload || {};

    // Extract role from custom attributes or Cognito groups (check both tokens)
    const role = this.extractUserRole(idPayload, accessPayload);

    // Prefer ID token for profile fields; fallback to access token
    const email = idPayload.email || accessPayload.email || user.username;
    const givenName = idPayload.given_name || accessPayload.given_name;
    const familyName = idPayload.family_name || accessPayload.family_name;
    const companyId = idPayload['custom:companyId'] || accessPayload['custom:companyId'];
    const trainerIdsRaw = idPayload['custom:trainerIds'] || accessPayload['custom:trainerIds'];

    return {
      id: user.userId,
      email,
      givenName,
      familyName,
      role,
      companyId,
      trainerIds: typeof trainerIdsRaw === 'string' ? trainerIdsRaw.split(',') : undefined,
      isActive: true
    };
  }

  private extractGroups(idPayload: any): string[] {
    const groups = idPayload?.['cognito:groups'];
    if (Array.isArray(groups)) {
      return groups;
    }
    return [];
  }

  private extractUserRole(idPayload: any, accessPayload: any): UserRole {
    const norm = (v: any) => (typeof v === 'string' ? v.toLowerCase() : v);

    // 1) Custom role attribute on either token
    const customRole = norm(idPayload?.['custom:role'] || accessPayload?.['custom:role']);
    if (customRole === 'admin') return UserRole.ADMIN;
    if (customRole === 'trainer') return UserRole.TRAINER;

    // 2) Cognito groups claim on either token
    const groups = idPayload?.['cognito:groups'] || accessPayload?.['cognito:groups'];
    if (groups && Array.isArray(groups)) {
      if (groups.includes('Admin')) return UserRole.ADMIN;
      if (groups.includes('Trainer')) return UserRole.TRAINER;
    }

    // Default to CLIENT
    return UserRole.CLIENT;
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  // Synchronous read for guards/interceptor
  isAuthenticatedSync(): boolean {
    return this.authStatusSubject.value === 'authenticated';
  }

  authStatusSync(): AuthStatus {
    return this.authStatusSubject.value;
  }

  /** Emits once auth status is resolved (not 'unknown'). */
  whenResolved$(): Observable<AuthStatus> {
    return this.authStatus$.pipe(
      filter(status => status !== 'unknown'),
      take(1)
    );
  }

  getCurrentUserRole(): UserRole | null {
    return this.currentUserSubject.value?.role || null;
  }

  async signIn(email: string, password: string): Promise<'SUCCESS' | 'NEW_PASSWORD_REQUIRED'> {
    if (!this.isBrowser) {
      throw this.buildError('PLATFORM', 'Auth disponible solo en navegador.');
    }

    try {
      const result = await signIn({
        username: email,
        password
      });
      
      const step = result.nextStep?.signInStep;

      if (step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        this.authStateSubject.next({
          authenticated: false,
          claims: null,
          groups: [],
          pendingChallenge: 'NEW_PASSWORD_REQUIRED',
          pendingEmail: email,
          authStatus: 'unauthenticated'
        });
        this.authStatusSubject.next('unauthenticated');
        return 'NEW_PASSWORD_REQUIRED';
      }

      await this.finalizeLogin();
      return 'SUCCESS';
    } catch (error: any) {
      throw this.mapCognitoError(error);
    }
  }

  async completeNewPassword(newPassword: string): Promise<void> {
    const { pendingChallenge, pendingEmail } = this.authStateSubject.value;

    if (pendingChallenge !== 'NEW_PASSWORD_REQUIRED') {
      throw this.buildError(
        'NO_CHALLENGE',
        'No hay un desafío de nueva contraseña activo.'
      );
    }

    try {
      const confirmResult = await confirmSignIn({
        challengeResponse: newPassword
      });

      await this.finalizeLogin();
    } catch (error: any) {
      throw this.mapCognitoError(error);
    }
  }


  async forgotPassword(email: string): Promise<void> {
    if (!this.isBrowser) {
      throw this.buildError('PLATFORM', 'Auth disponible solo en navegador.');
    }
    try {
      await resetPassword({ username: email });
      this.authStateSubject.next({
        ...this.authStateSubject.value,
        pendingEmail: email,
        pendingChallenge: null
      });
    } catch (error: any) {
      throw this.mapCognitoError(error);
    }
  }

  async forgotPasswordSubmit(email: string, code: string, newPassword: string): Promise<void> {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword
      });
      this.authStateSubject.next({
        ...this.authStateSubject.value,
        pendingEmail: null,
        pendingChallenge: null
      });
    } catch (error: any) {
      throw this.mapCognitoError(error);
    }
  }

  async getSession(): Promise<any | null> {
    if (!this.isBrowser) return null;
    try {
      const session = await fetchAuthSession();
      return session;
    } catch {
      return null;
    }
  }

  getIdToken(): Observable<string | null> {
    return from(fetchAuthSession()).pipe(
      map(session => session?.tokens?.idToken?.toString() || null),
      catchError(() => of(null))
    );
  }


  getAccessToken(): Observable<string | null> {
    if (!this.isBrowser) {
      return of(null);
    }
    return from(fetchAuthSession()).pipe(
      map(session => session?.tokens?.accessToken?.toString() || null),
      catchError(() => of(null))
    );
  }

  getIdTokenClaims(): Observable<any | null> {
    if (!this.isBrowser) {
      return of(null);
    }
    return from(fetchAuthSession()).pipe(
      map(session => session?.tokens?.idToken?.payload || null),
      catchError(() => of(null))
    );
  }

  hasClientGroup(): boolean {
    return this.authStateSubject.value.groups.includes('Client');
  }

  async signOut(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }
    try {
      await signOut();
    } finally {
      this.setUnauthenticated();
    }
  }

  private async finalizeLogin(): Promise<void> {
    const session = await fetchAuthSession();

    const claims = session.tokens?.idToken?.payload || null;
    const groups = this.extractGroups(claims);

    if (!groups.includes('Client')) {
      await this.signOut();
      throw this.buildError('NOT_CLIENT', 'Acceso no autorizado para esta aplicación.');
    }

    const user = await getCurrentUser();
    const userProfile = await this.buildUserProfile(user, session);

    this.currentUserSubject.next(userProfile);
    this.setAuthenticated({ claims, groups });
  }

  private setAuthenticated(input: { claims: any | null; groups: string[] }): void {
    this.authStatusSubject.next('authenticated');
    this.authStateSubject.next({
      authenticated: true,
      claims: input.claims,
      groups: input.groups,
      pendingChallenge: null,
      pendingEmail: null,
      authStatus: 'authenticated'
    });
  }

  private setUnauthenticated(): void {
    this.currentUserSubject.next(null);
    this.authStatusSubject.next('unauthenticated');
    this.authStateSubject.next({
      authenticated: false,
      claims: null,
      groups: [],
      pendingChallenge: null,
      pendingEmail: null,
      authStatus: 'unauthenticated'
    });
    this.applyDefaultThemeWhenSignedOut();
  }

  private applyDefaultThemeWhenSignedOut(): void {
    if (this.authStatusSubject.value === 'authenticated') {
      return;
    }
    this.themeService.applyTheme(null);
  }

  private buildError(code: string, message: string): AuthError {
    const err = new Error(message) as AuthError;
    err.code = code;
    return err;
  }

  private mapCognitoError(error: any): AuthError {
    const name = error?.name || error?.code;

    switch (name) {
      case 'UserNotFoundException':
        return this.buildError('USER_NOT_FOUND', 'Usuario no encontrado.');
      case 'NotAuthorizedException':
        return this.buildError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
      case 'UserNotConfirmedException':
        return this.buildError('USER_NOT_CONFIRMED', 'Usuario no confirmado.');
      case 'PasswordResetRequiredException':
        return this.buildError('PASSWORD_RESET_REQUIRED', 'Debes restablecer tu contraseña.');
      case 'CodeMismatchException':
        return this.buildError('CODE_MISMATCH', 'El código ingresado es inválido.');
      case 'ExpiredCodeException':
        return this.buildError('CODE_EXPIRED', 'El código ha expirado.');
      case 'InvalidPasswordException':
        return this.buildError('INVALID_PASSWORD', 'La contraseña no cumple las políticas.');
      default:
        return this.buildError('UNKNOWN', 'Ocurrió un error, intenta de nuevo.');
    }
  }

  private logConfig(): void {
    try {
      console.info('[Auth] Config pool:', awsExports.aws_user_pools_id, 'client:', awsExports.aws_user_pools_web_client_id);
    } catch {}
  }
}
