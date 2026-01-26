/**
 * Purpose: define chart series points for time-based metrics.
 * Input: N/A. Output: typed chart series interfaces.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface ChartSeriesPoint {
  x: number;
  y: number | null;
}

/**
 * Purpose: define a named chart series for ApexCharts mapping.
 * Input: N/A. Output: typed chart series interface.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface ChartSeries {
  name: string;
  data: ChartSeriesPoint[];
}
