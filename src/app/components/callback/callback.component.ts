import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, UserRole } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss']
})
export class CallbackComponent implements OnInit {
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    try {
      // Avoid accessing window during SSR render
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      // Callback no longer needed for custom login UI
      // Redirect to login if user somehow reached this page
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Callback error:', error);
      this.error = 'Error procesando la autenticación. Por favor intenta de nuevo.';
    }
  }

  retryLogin() {
    this.router.navigate(['/login']);
  }
}
