import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { ClientDataService } from '../../services/client-data.service';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-profile.component.html',
  styleUrl: './client-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientProfileComponent implements OnInit, OnDestroy {
  profile: any = null;
  isLoading = false;
  errorMessage = '';
  
  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProfile(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    // Asumimos que existe getMyProfile() similar a getMyPlans()
    this.clientDataService.getMyProfile()
      .pipe(
        catchError(error => {
          this.handleLoadError(error, startedAt);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(profile => {
        this.profile = profile;
        this.cdr.markForCheck();
      });
  }

  getAge(dateString: string): string {
    if (!dateString) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} años`;
  }

  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientProfile] load failed', { elapsedMs, error });
    
    const status = error?.status;
    if (status === 404) this.errorMessage = 'No encontramos tu perfil.';
    else if (status === 401) this.errorMessage = 'Sesión expirada.';
    else this.errorMessage = 'No pudimos cargar tu perfil.';
    
    this.cdr.markForCheck();
  }

  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  private getElapsedMs(startedAt: number): number {
    return Math.round(this.getNowMs() - startedAt);
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatInjuries(injuries: string[] | string): string {
    if (Array.isArray(injuries)) {
      return injuries.join(', ');
    }
    return injuries || 'Ninguna reportada';
  }
}