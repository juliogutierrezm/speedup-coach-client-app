/**
 * Purpose: define body measurement file metadata from the backend.
 * Input: N/A. Output: typed ClientBodyMeasurementFile interface.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
export interface ClientBodyMeasurementFile {
  clientId: string;
  fileKey: string;
  fileName: string;
  contentType: string;
  createdAt: string;
}
