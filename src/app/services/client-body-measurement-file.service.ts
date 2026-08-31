/**
 * Purpose: manage body measurement file CRUD operations via backend API.
 * Input: client-scoped file metadata. Output: Observables of API responses.
 * Error handling: logs errors with operation context, surfaces user-facing messages via callback.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ClientBodyMeasurementFile } from '../models/body-metrics.model';

@Injectable({ providedIn: 'root' })
export class ClientBodyMeasurementFileService {
  private readonly baseUrl = `${environment.apiBase}/clients/metrics`;

  constructor(private http: HttpClient) {}

  /**
   * Purpose: request a pre-signed S3 upload URL from the backend.
   * Input: clientId, filename, contentType. Output: Observable with uploadUrl and fileKey.
   * Error handling: delegates to handleError with user message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getUploadUrl(clientId: string, filename: string, contentType: string): Observable<{ uploadUrl: string; fileKey: string }> {
    return this.http.post<any>(`${this.baseUrl}/upload-url`, { clientId, filename, contentType }).pipe(
      map(res => ({ uploadUrl: res.uploadUrl, fileKey: res.fileKey })),
      catchError(this.handleError('getUploadUrl', 'No se pudo obtener la URL de subida.'))
    );
  }

  /**
   * Purpose: upload a file directly to S3 using the pre-signed URL.
   * Input: pre-signed uploadUrl, File object. Output: Promise<void>.
   * Error handling: throws on non-OK response with statusText context.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  async uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ClientBodyMeasurementFile] S3 upload error:', errorText);
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }

  /**
   * Purpose: register uploaded file metadata in the backend.
   * Input: payload with clientId, fileKey, fileName, contentType. Output: Observable<ClientBodyMeasurementFile>.
   * Error handling: delegates to handleError with user message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  createFileRecord(payload: { clientId: string; fileKey: string; fileName: string; contentType: string }): Observable<ClientBodyMeasurementFile> {
    return this.http.post<ClientBodyMeasurementFile>(`${this.baseUrl}/file`, payload).pipe(
      catchError(this.handleError('createFileRecord', 'No se pudo registrar el archivo.'))
    );
  }

  /**
   * Purpose: fetch all measurement files for a given client.
   * Input: clientId string. Output: Observable<ClientBodyMeasurementFile[]>.
   * Error handling: returns empty array on blank clientId; delegates errors to handleError.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getFilesByClient(clientId: string): Observable<ClientBodyMeasurementFile[]> {
    if (!clientId?.trim()) {
      return of([]);
    }
    return this.http.get<any>(`${this.baseUrl}/file`, {
      params: { clientId }
    }).pipe(
      map(res => normalizeFilesResponse(res)),
      catchError(this.handleError('getFilesByClient', 'No se pudieron cargar los archivos.'))
    );
  }

  /**
   * Purpose: delete a measurement file from backend and S3.
   * Input: ClientBodyMeasurementFile with clientId, createdAt, fileKey. Output: Observable<void>.
   * Error handling: delegates to handleError with user message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  deleteFile(file: ClientBodyMeasurementFile): Observable<void> {
    return this.http.request<void>('DELETE', `${this.baseUrl}/file`, {
      body: {
        clientId: file.clientId,
        createdAt: file.createdAt,
        fileKey: file.fileKey
      }
    }).pipe(
      catchError(this.handleError('deleteFile', 'No se pudo eliminar el archivo.'))
    );
  }

  /**
   * Purpose: request a pre-signed download URL for a stored file.
   * Input: fileKey string. Output: Observable with downloadUrl.
   * Error handling: delegates to handleError with user message.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getDownloadUrl(fileKey: string): Observable<{ downloadUrl: string }> {
    return this.http.post<{ downloadUrl: string }>(`${this.baseUrl}/download-url`, { fileKey }).pipe(
      catchError(this.handleError('getDownloadUrl', 'No se pudo obtener la URL de descarga.'))
    );
  }

  /**
   * Purpose: centralized error handler for all service operations.
   * Input: operation name, user-facing message. Output: RxJS catchError callback.
   * Error handling: logs structured error context and re-throws.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private handleError(operation: string, message: string) {
    return (error: any) => {
      console.error(`[ClientBodyMeasurementFile] ${operation} failed`, { error, message });
      return throwError(() => ({ original: error, userMessage: message }));
    };
  }
}

/**
 * Purpose: normalize diverse API response shapes into a consistent array.
 * Input: raw API response. Output: ClientBodyMeasurementFile[].
 * Error handling: returns empty array on unparseable responses.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
function normalizeFilesResponse(res: any): ClientBodyMeasurementFile[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && typeof res.body === 'string') {
    try {
      const parsed = JSON.parse(res.body);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch {
      return [];
    }
  }
  if (res && Array.isArray(res.body)) return res.body;
  return [];
}
