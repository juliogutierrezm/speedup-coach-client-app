import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexNoData,
  ApexResponsive,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';
import { ClientDataService, ClientProfile } from '../../services/client-data.service';
import { TenantTheme } from '../../services/theme.service';
import { BodyMetric } from '../../models/body-metric.model';
import { ChartSeries, ChartSeriesPoint } from '../../models/chart-series.model';

type MetricKey = 'weightKg' | 'bodyFatPercentage' | 'muscleMassKg' | 'musclePercentage';

/**
 * Purpose: define typed Apex chart options used by this view.
 * Input: N/A. Output: ChartOptions shape.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
interface ChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  markers: ApexMarkers;
  grid: ApexGrid;
  tooltip: ApexTooltip;
  colors: string[];
  fill: ApexFill;
  legend: ApexLegend;
  responsive: ApexResponsive[];
  noData: ApexNoData;
}

/**
 * Purpose: define view-specific chart card metadata.
 * Input: N/A. Output: ChartCard shape.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
interface ChartCard {
  id: string;
  title: string;
  subtitle: string;
  options: ChartOptions;
}

/**
 * Purpose: render the client body composition history and charts.
 * Input: none. Output: UI side effects.
 * Error handling: handled in loadClientData with fallback messaging.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-body-composition',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  templateUrl: './client-body-composition.component.html',
  styleUrls: ['./client-body-composition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientBodyCompositionComponent implements OnInit, OnDestroy {
  clientProfile: ClientProfile | null = null;
  trainerName = '';
  latestMetrics: BodyMetric | null = null;
  metricsAsc: BodyMetric[] = [];
  metricsDesc: BodyMetric[] = [];
  chartCards: ChartCard[] = [];
  theme: TenantTheme | null = null;
  isLoading = false;
  errorMessage = '';

  private destroy$ = new Subject<void>();

  constructor(
    private clientDataService: ClientDataService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize body composition view state.
   * Input: none. Output: void.
   * Error handling: delegated to loadClientData.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.loadClientData();
  }

  /**
   * Purpose: clean up subscriptions on destroy.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Purpose: provide stable tracking for chart cards.
   * Input: index and ChartCard. Output: string id.
   * Error handling: falls back to index for missing ids.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByChartId = (index: number, card: ChartCard): string => {
    return card?.id || `${index}`;
  };

  /**
   * Purpose: provide stable tracking for metric rows.
   * Input: index and BodyMetric. Output: string id.
   * Error handling: falls back to index for missing keys.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByMetric = (index: number, metric: BodyMetric): string => {
    return metric?.SK || metric?.measurementDate || `${index}`;
  };

  /**
   * Purpose: render age label from date of birth.
   * Input: ISO date string. Output: formatted age label.
   * Error handling: returns placeholder on invalid input.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getAgeLabel(dateString?: string): string {
    if (!dateString) {
      return 'N/A';
    }
    const today = new Date();
    const birthDate = new Date(dateString);
    if (!Number.isFinite(birthDate.getTime())) {
      return 'N/A';
    }
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return `${age} anos`;
  }

  /**
   * Purpose: format display values with units for UI cards and tables.
   * Input: numeric value, unit label, decimals. Output: formatted string.
   * Error handling: returns placeholder when value is invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatMetricValue(value: number | null | undefined, unit: string, decimals = 0): string {
    if (!Number.isFinite(value as number)) {
      return '-';
    }
    return `${(value as number).toFixed(decimals)} ${unit}`;
  }

  /**
   * Purpose: format ISO dates for header and table display.
   * Input: ISO date string. Output: dd/MM/yyyy or placeholder.
   * Error handling: returns placeholder on invalid date input.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatDisplayDate(dateString?: string): string {
    const timestamp = this.getMetricTimestamp(dateString);
    if (!timestamp) {
      return '-';
    }
    const date = new Date(timestamp);
    return `${this.pad2(date.getDate())}/${this.pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  /**
   * Purpose: load client data and hydrate charts/table.
   * Input: none. Output: void.
   * Error handling: maps error to message and keeps UI stable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadClientData(): void {
    const startedAt = this.getNowMs();
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.clientDataService.getClientData()
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
      .subscribe(data => {
        if (!data) {
          return;
        }
        this.clientProfile = data.user ?? null;
        this.trainerName = data.user?.trainerName || data.trainerName || '';
        this.theme = data.theme ?? null;
        const metrics = Array.isArray(data.bodyMetrics) ? data.bodyMetrics : [];
        this.metricsAsc = this.sortMetricsAsc(metrics);
        this.metricsDesc = this.sortMetricsDesc(metrics);
        this.latestMetrics = this.resolveLatestMetric(data.user?.latestBodyMetrics, this.metricsAsc);
        this.chartCards = this.buildChartCards(this.metricsAsc, this.theme);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: map load errors into UI messages and structured logs.
   * Input: error payload and start time. Output: void.
   * Error handling: logs context and sets a fallback message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleLoadError(error: any, startedAt: number): void {
    const elapsedMs = this.getElapsedMs(startedAt);
    console.error('[ClientBodyComposition] load failed', { elapsedMs, error });
    this.errorMessage = this.getLoadErrorMessage(error);
    this.cdr.markForCheck();
  }

  /**
   * Purpose: map error status codes to friendly messages.
   * Input: error payload. Output: message string.
   * Error handling: returns default message for unknown errors.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getLoadErrorMessage(error: any): string {
    const status = error?.status;
    if (status === 400) return 'No pudimos leer tus metricas.';
    if (status === 401 || status === 403) return 'Tu sesion expiro. Inicia sesion.';
    if (status === 404) return 'No encontramos tus metricas.';
    if (status === 413) return 'La respuesta es demasiado grande.';
    if (status >= 500) return 'El servidor no pudo entregar tus metricas.';
    return 'No pudimos cargar tu composicion corporal.';
  }

  /**
   * Purpose: sort metrics chronologically (oldest to newest).
   * Input: BodyMetric array. Output: sorted array copy.
   * Error handling: invalid dates default to 0.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private sortMetricsAsc(metrics: BodyMetric[]): BodyMetric[] {
    return [...metrics].sort((a, b) => {
      return this.getMetricTimestamp(a?.measurementDate) - this.getMetricTimestamp(b?.measurementDate);
    });
  }

  /**
   * Purpose: sort metrics descending (newest to oldest).
   * Input: BodyMetric array. Output: sorted array copy.
   * Error handling: invalid dates default to 0.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private sortMetricsDesc(metrics: BodyMetric[]): BodyMetric[] {
    return [...metrics].sort((a, b) => {
      return this.getMetricTimestamp(b?.measurementDate) - this.getMetricTimestamp(a?.measurementDate);
    });
  }

  /**
   * Purpose: resolve latest measurement snapshot with safe fallbacks.
   * Input: explicit latest metrics and sorted metrics list. Output: BodyMetric or null.
   * Error handling: returns null when no metrics are available.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private resolveLatestMetric(latest: BodyMetric | undefined, metricsAsc: BodyMetric[]): BodyMetric | null {
    if (latest && this.getMetricTimestamp(latest.measurementDate)) {
      return latest;
    }
    return metricsAsc.length ? metricsAsc[metricsAsc.length - 1] : null;
  }

  /**
   * Purpose: build chart cards for body composition evolution.
   * Input: sorted metrics and current theme. Output: ChartCard array.
   * Error handling: returns empty array when no metrics exist.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildChartCards(metricsAsc: BodyMetric[], theme: TenantTheme | null): ChartCard[] {
    if (!metricsAsc.length) {
      return [];
    }
    const primaryColor = theme?.primaryColor || 'var(--c-primary)';
    const accentColor = theme?.accentColor || 'var(--c-accent)';
    const fontFamily = theme?.fontFamily || 'var(--c-font)';

    const weightSeries = this.buildMetricSeries(metricsAsc, 'weightKg', 'Peso');
    const fatSeries = this.buildMetricSeries(metricsAsc, 'bodyFatPercentage', 'Grasa corporal');
    const muscleMassSeries = this.buildMetricSeries(metricsAsc, 'muscleMassKg', 'Masa muscular');
    const comparisonSeries = [
      this.buildMetricSeries(metricsAsc, 'bodyFatPercentage', 'Grasa corporal'),
      this.buildMetricSeries(metricsAsc, 'musclePercentage', 'Musculo')
    ];

    return [
      {
        id: 'weight',
        title: 'Evolucion de peso',
        subtitle: 'Seguimiento de peso en kilogramos.',
        options: this.buildLineChartOptions(weightSeries, [primaryColor], 'kg', fontFamily, theme)
      },
      {
        id: 'body-fat',
        title: 'Evolucion de grasa corporal',
        subtitle: 'Porcentaje de grasa corporal.',
        options: this.buildLineChartOptions(fatSeries, [accentColor], '%', fontFamily, theme)
      },
      {
        id: 'muscle-mass',
        title: 'Evolucion de masa muscular',
        subtitle: 'Masa muscular en kilogramos.',
        options: this.buildLineChartOptions(muscleMassSeries, [primaryColor], 'kg', fontFamily, theme)
      },
      {
        id: 'comparison',
        title: 'Comparativo grasa vs musculo',
        subtitle: 'Porcentajes de grasa y musculo.',
        options: this.buildAreaChartOptions(comparisonSeries, [accentColor, primaryColor], '%', fontFamily, theme)
      }
    ];
  }

  /**
   * Purpose: build line chart options for single-series metrics.
   * Input: ChartSeries, colors, unit, font family, theme. Output: ChartOptions.
   * Error handling: returns safe defaults for missing theme.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildLineChartOptions(
    series: ChartSeries,
    colors: string[],
    unit: string,
    fontFamily: string,
    theme: TenantTheme | null
  ): ChartOptions {
    const isDark = theme?.backgroundMode === 'dark';
    return {
      series: [series],
      chart: {
        type: 'line',
        height: 260,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily
      },
      colors,
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
      fill: { type: 'solid' },
      grid: { borderColor: 'var(--c-border)', strokeDashArray: 4 },
      xaxis: {
        type: 'datetime',
        labels: {
          formatter: (value: string | number) => this.formatAxisDate(value),
          style: { colors: 'var(--c-muted)' }
        },
        axisBorder: { color: 'var(--c-border)' },
        axisTicks: { color: 'var(--c-border)' }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatAxisNumber(value),
          style: { colors: 'var(--c-muted)' }
        }
      },
      tooltip: {
        enabled: true,
        theme: isDark ? 'dark' : 'light',
        x: { format: 'dd/MM/yy' },
        y: { formatter: (value: number) => this.formatTooltipValue(value, unit) }
      },
      legend: { show: false },
      responsive: this.getChartResponsive(),
      noData: this.getNoDataOptions()
    };
  }

  /**
   * Purpose: build area chart options for comparison metrics.
   * Input: ChartSeries list, colors, unit, font family, theme. Output: ChartOptions.
   * Error handling: returns safe defaults for missing theme.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildAreaChartOptions(
    series: ChartSeries[],
    colors: string[],
    unit: string,
    fontFamily: string,
    theme: TenantTheme | null
  ): ChartOptions {
    const isDark = theme?.backgroundMode === 'dark';
    return {
      series,
      chart: {
        type: 'area',
        height: 280,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily
      },
      colors,
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 0, strokeWidth: 0 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 0.2,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      grid: { borderColor: 'var(--c-border)', strokeDashArray: 4 },
      xaxis: {
        type: 'datetime',
        labels: {
          formatter: (value: string | number) => this.formatAxisDate(value),
          style: { colors: 'var(--c-muted)' }
        },
        axisBorder: { color: 'var(--c-border)' },
        axisTicks: { color: 'var(--c-border)' }
      },
      yaxis: {
        labels: {
          formatter: (value: number) => this.formatAxisNumber(value),
          style: { colors: 'var(--c-muted)' }
        }
      },
      tooltip: {
        enabled: true,
        theme: isDark ? 'dark' : 'light',
        shared: true,
        x: { format: 'dd/MM/yy' },
        y: { formatter: (value: number) => this.formatTooltipValue(value, unit) }
      },
      legend: {
        position: 'top',
        fontSize: '12px',
        labels: { colors: 'var(--c-muted)' }
      },
      responsive: this.getChartResponsive(),
      noData: this.getNoDataOptions()
    };
  }

  /**
   * Purpose: build a chart series for a numeric metric key.
   * Input: metrics list, metric key, series label. Output: ChartSeries.
   * Error handling: filters out invalid timestamps and keeps null values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildMetricSeries(metrics: BodyMetric[], key: MetricKey, label: string): ChartSeries {
    const data = metrics
      .map(metric => this.buildSeriesPoint(metric, key))
      .filter((point): point is ChartSeriesPoint => !!point);
    return { name: label, data };
  }

  /**
   * Purpose: build a chart series point for a metric value.
   * Input: BodyMetric and metric key. Output: ChartSeriesPoint or null.
   * Error handling: returns null when date is invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private buildSeriesPoint(metric: BodyMetric, key: MetricKey): ChartSeriesPoint | null {
    const timestamp = this.getMetricTimestamp(metric?.measurementDate);
    if (!timestamp) {
      return null;
    }
    const rawValue = metric?.[key];
    const value = Number.isFinite(rawValue as number) ? (rawValue as number) : null;
    return { x: timestamp, y: value };
  }

  /**
   * Purpose: return responsive overrides for charts.
   * Input: none. Output: ApexResponsive[].
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getChartResponsive(): ApexResponsive[] {
    return [
      {
        breakpoint: 1024,
        options: {
          chart: { height: 240 },
          stroke: { width: 2 },
          markers: { size: 3 }
        }
      },
      {
        breakpoint: 640,
        options: {
          chart: { height: 220 }
        }
      }
    ];
  }

  /**
   * Purpose: provide consistent no-data messaging for charts.
   * Input: none. Output: ApexNoData.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getNoDataOptions(): ApexNoData {
    return {
      text: 'Sin datos para graficar.',
      align: 'center',
      verticalAlign: 'middle',
      style: {
        color: 'var(--c-muted)',
        fontSize: '14px'
      }
    };
  }

  /**
   * Purpose: format axis labels for datetime series.
   * Input: timestamp (number or string). Output: dd/MM.
   * Error handling: returns empty string for invalid timestamps.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private formatAxisDate(value: number | string): string {
    const timestamp = typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return '';
    }
    const date = new Date(timestamp);
    return `${this.pad2(date.getDate())}/${this.pad2(date.getMonth() + 1)}`;
  }

  /**
   * Purpose: format numeric axis labels with compact precision.
   * Input: numeric value. Output: formatted string.
   * Error handling: returns placeholder for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private formatAxisNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return '-';
    }
    return value.toFixed(1);
  }

  /**
   * Purpose: format tooltip values with units.
   * Input: numeric value and unit string. Output: formatted value.
   * Error handling: returns placeholder for invalid values.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private formatTooltipValue(value: number | null | undefined, unit: string): string {
    if (!Number.isFinite(value as number)) {
      return '-';
    }
    return `${(value as number).toFixed(1)} ${unit}`;
  }

  /**
   * Purpose: parse metric timestamp for sorting and charting.
   * Input: ISO date string. Output: timestamp (ms) or 0.
   * Error handling: returns 0 when parsing fails.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getMetricTimestamp(dateString?: string): number {
    const timestamp = dateString ? Date.parse(dateString) : NaN;
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  /**
   * Purpose: pad numeric values to two digits.
   * Input: number. Output: padded string.
   * Error handling: coerces invalid values to 0.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private pad2(value: number): string {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toString().padStart(2, '0');
  }

  /**
   * Purpose: return a monotonic timestamp for elapsed time logging.
   * Input: none. Output: number (ms).
   * Error handling: falls back to Date.now when performance is unavailable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getNowMs(): number {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  /**
   * Purpose: compute elapsed milliseconds from a start timestamp.
   * Input: start time. Output: elapsed ms (rounded).
   * Error handling: guards against invalid timestamps.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private getElapsedMs(startedAt: number): number {
    const now = this.getNowMs();
    const elapsed = now - startedAt;
    return Number.isFinite(elapsed) ? Math.round(elapsed) : 0;
  }
}
