/**
 * Purpose: define body composition metric payloads from the backend.
 * Input: N/A. Output: typed BodyMetric interface.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface BodyMetric {
  PK?: string;
  SK?: string;
  type?: string;
  measurementDate?: string;
  createdAt?: string;
  measuredBy?: string;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercentage?: number;
  muscleMassKg?: number;
  musclePercentage?: number;
  visceralFatLevel?: number;
  bmi?: number;
  basalMetabolicRate?: number;
  metabolicAge?: number;
}
