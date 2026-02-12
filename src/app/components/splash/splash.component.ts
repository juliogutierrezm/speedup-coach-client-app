import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="app-splash" role="status" aria-live="polite">
      <div class="app-splash__card">
        <div class="app-splash__spinner" aria-hidden="true"></div>
        <p class="app-splash__text">Cargando…</p>
      </div>
    </div>
  `,
  styles: [
    `
      .app-splash {
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b1220;
        color: #e5e7eb;
      }
      .app-splash__card {
        display: grid;
        justify-items: center;
        gap: 12px;
        padding: 22px 18px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .app-splash__spinner {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.25);
        border-top-color: rgba(255, 255, 255, 0.9);
        animation: spin 0.9s linear infinite;
      }
      .app-splash__text {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SplashComponent {}
