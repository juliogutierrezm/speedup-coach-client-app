import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const ALLOWED_FONT_FAMILIES = ['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Oswald', 'Lato'];
const SYSTEM_FONT_FALLBACKS = ['system-ui', '-apple-system', 'sans-serif'];
const DEFAULT_PRIMARY_FONT = 'Inter';

const resolvePrimaryFont = (fontFamily?: string | null): string => {
  const normalized = (fontFamily || '').trim().toLowerCase();
  const match = ALLOWED_FONT_FAMILIES.find(font => font.toLowerCase() === normalized);
  return match || DEFAULT_PRIMARY_FONT;
};

const buildFontStack = (fontFamily?: string | null): string => {
  const primary = resolvePrimaryFont(fontFamily);
  const fallbackFonts = ALLOWED_FONT_FAMILIES
    .filter(font => font !== primary)
    .map(font => `'${font}'`);

  return [`'${primary}'`, ...fallbackFonts, ...SYSTEM_FONT_FALLBACKS].join(', ');
};

const DEFAULT_FONT_STACK = buildFontStack(DEFAULT_PRIMARY_FONT);

export interface ThemeConfig {
  tenantId?: string;
  tenantType?: 'TRAINER' | 'COMPANY' | 'DEFAULT';
  primaryColor: string;
  accentColor: string;
  darkMode?: boolean;  // UI mapping for backgroundMode
  backgroundMode?: string;  // Backend: 'dark' | 'light'
  typography?: string;  // UI mapping for fontFamily
  fontFamily?: string;  // Backend field
  logoKey?: string;  // Backend: S3 key path
  logoUrl?: string;  // Used only for display
  appName?: string;  // Max 40 chars
  tagline?: string;  // Max 80 chars
  sessionNaming?: 'day' | 'session';  // Visual label for sessions
}

export interface TenantTheme {
  tenantId?: string;
  tenantType?: 'TRAINER' | 'COMPANY' | 'DEFAULT';
  primaryColor: string;
  accentColor: string;
  backgroundMode: 'dark' | 'light';
  fontFamily: string;
  appName?: string;
  tagline?: string;
  logoUrl?: string;
  sessionNaming?: 'day' | 'session';
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<ThemeConfig | null>(null);
  public theme$ = this.themeSubject.asObservable();
  private tenantThemeSubject = new BehaviorSubject<TenantTheme | null>(null);
  public tenantTheme$ = this.tenantThemeSubject.asObservable();

  private readonly isBrowser: boolean;

  // Default theme values
  private readonly defaultTenantTheme: TenantTheme = {
    primaryColor: '#FF9900',
    accentColor: '#22D3EE',
    backgroundMode: 'dark',
    fontFamily: DEFAULT_FONT_STACK,
    appName: 'TrainGrid',
    tagline: 'Entrena mejor. Progresa mas rapido.',
    logoUrl: '/assets/TrainGrid.png'
  };

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private getApiBaseUrl(): string {
    // Use the configured apiBase so every request targets the API Gateway directly.
    return environment.apiBase;
  }

  /**
   * Get current theme configuration from server
   */
  getTheme(): Observable<ThemeConfig> {
    return this.http.get<ThemeConfig>(`${this.getApiBaseUrl()}/tenant/theme`);
  }

  /**
   * Purpose: fetch tenant theme configuration for client experiences.
   * Input: none. Output: Observable<TenantTheme>.
   * Error handling: defers fallback handling to callers for user feedback.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTenantTheme(): Observable<TenantTheme> {
    return this.getTheme().pipe(
      map(theme => this.normalizeTenantTheme(theme))
    );
  }

  /**
   * Purpose: apply tenant theme tokens globally for client UI rendering.
   * Input: TenantTheme payload (or null for defaults). Output: void (side effects on documentElement).
   * Error handling: no-op on non-browser platforms; logs unexpected failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  applyTheme(theme?: ThemeConfig | TenantTheme | null): void {
    if (!this.isBrowser || typeof document === 'undefined') {
      return;
    }

    try {
      const normalized = this.normalizeTenantTheme(theme);
      const root = document.documentElement;
      const isDark = normalized.backgroundMode === 'dark';
      const fontStack = normalized.fontFamily || DEFAULT_FONT_STACK;

      root.style.setProperty('--client-primary', normalized.primaryColor);
      root.style.setProperty('--client-accent', normalized.accentColor);
      root.style.setProperty('--client-font', fontStack);
      root.style.setProperty('--font-display', fontStack);
      root.style.setProperty('--c-font', fontStack);
      root.style.setProperty('--client-app-name', normalized.appName || '');
      root.style.setProperty('--client-tagline', normalized.tagline || '');
      root.style.setProperty('--client-logo-url', normalized.logoUrl || '');

      root.style.setProperty('--client-bg', isDark ? '#0b1220' : '#ffffff');
      root.style.setProperty('--client-surface', isDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff');
      root.style.setProperty('--client-surface-strong', isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(11, 18, 32, 0.03)');
      root.style.setProperty('--client-text', isDark ? '#ffffff' : '#0b1220');
      root.style.setProperty('--client-text-muted', isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(11, 18, 32, 0.6)');
      root.style.setProperty('--client-border', isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(11, 18, 32, 0.12)');
      root.style.setProperty('--client-shadow-1', isDark ? '0 18px 36px rgba(11, 18, 32, 0.55)' : '0 14px 30px rgba(11, 18, 32, 0.16)');
      root.style.setProperty('--client-header-text', '#ffffff');
      root.style.setProperty('--client-header-muted', 'rgba(255, 255, 255, 0.84)');
      root.style.setProperty('--client-header-chip', 'rgba(255, 255, 255, 0.22)');

      root.classList.toggle('dark', isDark);
      this.tenantThemeSubject.next(normalized);
    } catch (error) {
      console.error('[ThemeService] applyTheme failed', {
        error,
        hasTheme: !!theme
      });
    }
  }

  /**
   * Save theme configuration to server
   */
  saveTheme(config: ThemeConfig): Observable<ThemeConfig> {
    return this.http.put<ThemeConfig>(`${this.getApiBaseUrl()}/tenant/theme`, config);
  }

  /**
   * Get pre-signed URL for logo upload
   */
  getLogoUploadUrl(filename: string, contentType: string): Observable<{ uploadUrl: string; fileKey: string }> {
    return this.http.post<any>(
      `${this.getApiBaseUrl()}/tenant/logo-upload-url`,
      { filename, contentType }
    ).pipe(
      map(response => ({
        uploadUrl: response.uploadUrl,
        fileKey: response.key // Map 'key' from Lambda to 'fileKey'
      }))
    );
  }

  /**
   * Upload logo directly to S3 using pre-signed URL
   * Uses native fetch, NOT HttpClient (to avoid interceptors)
   */
  async uploadLogoToS3(uploadUrl: string, file: File): Promise<void> {
    // Using fetch instead of HttpClient to avoid interceptors
    // Only send Content-Type header - it's required to match the signature
    // Don't send x-amz-* headers as they trigger CORS preflight which S3 doesn't handle
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('S3 upload error:', errorText);
      throw new Error(`Failed to upload logo: ${response.statusText}`);
    }

    // Don't try to read response body - just verify success
  }

  /**
   * Get default theme
   */
  getDefaultTheme(): ThemeConfig {
    return { ...this.defaultTenantTheme };
  }

  /**
   * Purpose: return tenant theme defaults for fallback scenarios.
   * Input: none. Output: TenantTheme.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getDefaultTenantTheme(): TenantTheme {
    return { ...this.defaultTenantTheme };
  }

  /**
   * Load theme from server and cache it
   */
  loadTheme(): Observable<ThemeConfig> {
    return new Observable(subscriber => {
      this.getTheme().subscribe({
        next: (theme) => {
          this.themeSubject.next(theme);
          subscriber.next(theme);
          subscriber.complete();
        },
        error: (error) => {
          const cached = this.themeSubject.value;
          if (cached) {
            console.warn('[ThemeService] loadTheme failed; using cached theme.', { error });
            subscriber.next(cached);
            subscriber.complete();
            return;
          }
          // If theme not configured, use defaults
          console.log('Using default theme:', error);
          const fallback = this.getDefaultTheme();
          this.themeSubject.next(fallback);
          subscriber.next(fallback);
          subscriber.complete();
        }
      });
    });
  }

  /**
   * Purpose: return the current theme snapshot when available.
   * Input: none. Output: ThemeConfig | null.
   * Error handling: returns null when unset.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getCurrentTheme(): ThemeConfig | null {
    return this.themeSubject.value;
  }

  /**
   * Purpose: return the latest tenant theme snapshot for client views.
   * Input: none. Output: TenantTheme | null.
   * Error handling: returns null when no theme is cached.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getCurrentTenantTheme(): TenantTheme | null {
    return this.tenantThemeSubject.value;
  }

  /**
   * Update theme in memory
   */
  setThemeInMemory(config: ThemeConfig): void {
    this.themeSubject.next(config);
  }

  /**
   * Purpose: cache tenant theme data for client UI rendering.
   * Input: TenantTheme. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  setTenantThemeInMemory(config: TenantTheme): void {
    this.tenantThemeSubject.next(this.normalizeTenantTheme(config));
  }

  /**
   * Purpose: normalize tenant theme payload to ensure required fields exist.
   * Input: raw theme config. Output: TenantTheme resolved for client usage.
   * Error handling: returns defaults only when raw theme is nullish.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private normalizeTenantTheme(config?: ThemeConfig | TenantTheme | null): TenantTheme {
    if (!config) {
      return this.getDefaultTenantTheme();
    }

    const backgroundMode =
      config.backgroundMode === 'light' || config.backgroundMode === 'dark'
        ? config.backgroundMode
        : 'darkMode' in config && typeof (config as ThemeConfig).darkMode === 'boolean'
          ? (config as ThemeConfig).darkMode
            ? 'dark'
            : 'light'
          : 'dark';
    const typography = 'typography' in config ? (config as ThemeConfig).typography : undefined;
    const fontFamily = this.normalizeFontFamily(config.fontFamily || typography);

    return {
      tenantId: config.tenantId,
      tenantType: config.tenantType,
      primaryColor: config.primaryColor || '',
      accentColor: config.accentColor || '',
      backgroundMode,
      fontFamily,
      appName: config.appName || '',
      tagline: config.tagline || '',
      logoUrl: config.logoUrl || '',
      sessionNaming: config.sessionNaming === 'day' ? 'day' : 'session'
    };
  }

  private normalizeFontFamily(fontFamily?: string | null): string {
    return buildFontStack(fontFamily);
  }

  getSessionLabel(count: number): string {
    const naming = this.tenantThemeSubject.value?.sessionNaming;
    return naming === 'day'
      ? (count === 1 ? 'Día' : 'Días')
      : (count === 1 ? 'Sesión' : 'Sesiones');
  }

  getSessionLabelLower(count: number): string {
    return this.getSessionLabel(count).toLowerCase();
  }

  getSessionNamingPrefix(): string {
    const naming = this.tenantThemeSubject.value?.sessionNaming;
    return naming === 'day' ? 'Día' : 'Sesión';
  }

  resolveSessionName(name: string | undefined | null, index: number): string {
    const prefix = this.getSessionNamingPrefix();
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length === 0) {
      return `${prefix} ${index + 1}`;
    }
    if (this.tenantThemeSubject.value?.sessionNaming === 'day') {
      const match = trimmed.match(/^Sesi[oó]n\s+(\d+)$/i);
      if (match) {
        return `Día ${match[1]}`;
      }
    }
    return trimmed;
  }
}
