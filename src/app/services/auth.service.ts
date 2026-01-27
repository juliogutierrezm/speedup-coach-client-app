import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

export interface AuthState {
  authenticated: boolean;
  claims: any | null;
  groups: string[];
  pendingChallenge?: 'NEW_PASSWORD_REQUIRED' | null;
  pendingEmail?: string | null;
}

export interface AuthError extends Error {
  code: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private authStateSubject = new BehaviorSubject<AuthState>({
    authenticated: false,
    claims: null,
    groups: [],
    pendingChallenge: null,
    pendingEmail: null
  });
  private readonly isBrowser: boolean;

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public authState$ = this.authStateSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private themeService: ThemeService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.logConfig();
    }
  }

  async checkAuthState(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    console.log('[DEBUG] 🔍 checkAuthState START');
    try {
      const session = await fetchAuthSession();
      const hasTokens = !!session.tokens?.idToken;

      console.log('[DEBUG] 📊 checkAuthState | hasTokens:', hasTokens, '| hasIdToken:', !!session.tokens?.idToken, '| hasAccessToken:', !!session.tokens?.accessToken);

      if (!hasTokens) {
        console.log('[DEBUG] ⚠️  checkAuthState | No tokens found, returning');
        return;
      }

      const user = await getCurrentUser();
      const userProfile = await this.buildUserProfile(user, session);
      const claims = session.tokens?.idToken?.payload ?? null;
      const groups = this.extractGroups(claims);

      console.log('[DEBUG] ✅ checkAuthState SUCCESS | user:', user.username, '| groups:', groups, '| authenticated: true');

      this.currentUserSubject.next(userProfile);
      this.isAuthenticatedSubject.next(true);
      this.authStateSubject.next({
        authenticated: true,
        claims,
        groups,
        pendingChallenge: null,
        pendingEmail: null
      });
    } catch (error) {
      console.error('[DEBUG] ❌ checkAuthState ERROR:', error);
      this.resetState();
    }
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
    return this.authStateSubject.value.authenticated;
  }

  getCurrentUserRole(): UserRole | null {
    return this.currentUserSubject.value?.role || null;
  }

  async signIn(email: string, password: string): Promise<'SUCCESS' | 'NEW_PASSWORD_REQUIRED'> {
    if (!this.isBrowser) {
      throw this.buildError('PLATFORM', 'Auth disponible solo en navegador.');
    }

    console.log('[DEBUG] 🔹 signIn START | email:', email);
    try {
      const result = await signIn({
        username: email,
        password
      });

      console.log('[DEBUG] ✅ signIn RESULT | nextStep:', result.nextStep?.signInStep, '| full result:', result);
      
      const step = result.nextStep?.signInStep;

      if (step === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        console.log('[DEBUG] 🔑 NEW_PASSWORD_REQUIRED detected | email:', email);
        this.authStateSubject.next({
          authenticated: false,
          claims: null,
          groups: [],
          pendingChallenge: 'NEW_PASSWORD_REQUIRED',
          pendingEmail: email
        });
        return 'NEW_PASSWORD_REQUIRED';
      }

      console.log('[DEBUG] → calling finalizeLogin from signIn');
      await this.finalizeLogin();
      return 'SUCCESS';
    } catch (error: any) {
      console.error('[DEBUG] ❌ signIn ERROR', error);
      throw this.mapCognitoError(error);
    }
  }

  async completeNewPassword(newPassword: string): Promise<void> {
    const { pendingChallenge, pendingEmail } = this.authStateSubject.value;

    console.log('[DEBUG] 🔑 completeNewPassword START | pendingChallenge:', pendingChallenge, '| pendingEmail:', pendingEmail);

    if (pendingChallenge !== 'NEW_PASSWORD_REQUIRED') {
      throw this.buildError(
        'NO_CHALLENGE',
        'No hay un desafío de nueva contraseña activo.'
      );
    }

    try {
      // 🔥 FIX CRÍTICO: SOLO enviar la nueva contraseña
      console.log('[DEBUG] 📤 confirmSignIn CALL | challengeResponse: [password]');
      const confirmResult = await confirmSignIn({
        challengeResponse: newPassword
      });

      console.log('[DEBUG] ✅ confirmSignIn RESULT:', confirmResult);

      console.log('[DEBUG] → Checking fetchAuthSession BEFORE finalizeLogin');
      const preSessionCheck = await fetchAuthSession();
      console.log('[DEBUG] 📊 Session before finalizeLogin | hasIdToken:', !!preSessionCheck.tokens?.idToken, '| hasAccessToken:', !!preSessionCheck.tokens?.accessToken);
      if (preSessionCheck.tokens?.idToken?.payload) {
        const exp = preSessionCheck.tokens.idToken.payload.exp;
        console.log('[DEBUG] 📋 ID Token Claims:', {
          sub: preSessionCheck.tokens.idToken.payload.sub,
          email: preSessionCheck.tokens.idToken.payload.email,
          groups: preSessionCheck.tokens.idToken.payload['cognito:groups'],
          tokenExpiry: exp ? new Date(exp * 1000) : 'N/A'
        });
      }

      console.log('[DEBUG] → calling finalizeLogin from completeNewPassword');
      await this.finalizeLogin();
      console.log('[DEBUG] ✅ completeNewPassword SUCCESS | authState:', this.authStateSubject.value);
    } catch (error: any) {
      console.error('[DEBUG] ❌ completeNewPassword ERROR', error);
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
      this.resetState();
    }
  }

  private async finalizeLogin(): Promise<void> {
    console.log('[DEBUG] 📌 finalizeLogin START');
    const session = await fetchAuthSession();
    console.log('[DEBUG] 📊 finalizeLogin | session tokens:', {
      hasIdToken: !!session.tokens?.idToken,
      hasAccessToken: !!session.tokens?.accessToken
    });

    const claims = session.tokens?.idToken?.payload || null;
    const groups = this.extractGroups(claims);

    console.log('[DEBUG] 🔎 finalizeLogin | groups extracted:', groups);

    if (!groups.includes('Client')) {
      console.error('[DEBUG] ❌ finalizeLogin | User NOT in Client group | groups:', groups);
      await this.signOut();
      throw this.buildError('NOT_CLIENT', 'Acceso no autorizado para esta aplicación.');
    }

    const user = await getCurrentUser();
    console.log('[DEBUG] 👤 finalizeLogin | getCurrentUser result | userId:', user.userId, '| username:', user.username);
    
    const userProfile = await this.buildUserProfile(user, session);
    
    console.log('[DEBUG] ✅ finalizeLogin | Setting authenticated state | user:', userProfile.email, '| role:', userProfile.role);

    this.currentUserSubject.next(userProfile);
    this.isAuthenticatedSubject.next(true);
    this.authStateSubject.next({
      authenticated: true,
      claims,
      groups,
      pendingChallenge: null,
      pendingEmail: null
    });
  }

  private resetState(): void {
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.authStateSubject.next({
      authenticated: false,
      claims: null,
      groups: [],
      pendingChallenge: null,
      pendingEmail: null
    });
    this.applyDefaultThemeWhenSignedOut();
  }

  private applyDefaultThemeWhenSignedOut(): void {
    if (this.isAuthenticatedSubject.value) {
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
