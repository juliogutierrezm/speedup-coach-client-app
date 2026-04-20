/**
 * Purpose: manage body measurement PDF files (upload, list, preview, delete).
 * Input: none (clientId from authenticated profile). Output: UI side effects.
 * Error handling: inline toast notifications for user feedback, structured console logging.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil, switchMap } from 'rxjs/operators';
import { ClientDataService } from '../../../services/client-data.service';
import { ClientBodyMeasurementFileService } from '../../../services/client-body-measurement-file.service';
import { ClientBodyMeasurementFile } from '../../../models/body-metrics.model';

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_CONTENT_TYPE = 'application/pdf';
const TOAST_DURATION_MS = 3500;

/**
 * Purpose: define toast notification metadata for inline user feedback.
 * Input: N/A. Output: ToastMessage shape.
 * Error handling: N/A.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
interface ToastMessage {
  text: string;
  tone: 'success' | 'error';
}

@Component({
  selector: 'app-body-measurement-files',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './body-measurement-files.component.html',
  styleUrls: ['./body-measurement-files.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BodyMeasurementFilesComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  files: ClientBodyMeasurementFile[] = [];
  isLoading = false;
  isUploading = false;
  deletingFileKey: string | null = null;
  confirmingDeleteKey: string | null = null;
  toast: ToastMessage | null = null;

  private clientId = '';
  private destroy$ = new Subject<void>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private clientDataService: ClientDataService,
    private fileService: ClientBodyMeasurementFileService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Purpose: initialize component by resolving clientId and loading files.
   * Input: none. Output: void.
   * Error handling: shows toast on profile load failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnInit(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.clientDataService.getMyProfile()
      .pipe(
        switchMap(profile => {
          this.clientId = profile?.id || '';
          if (!this.clientId) {
            this.showToast('No se pudo identificar al usuario.', 'error');
            this.isLoading = false;
            this.cdr.markForCheck();
            return of([]);
          }
          return this.fileService.getFilesByClient(this.clientId);
        }),
        catchError(err => {
          console.error('[BodyMeasurementFiles] init failed', { error: err });
          this.showToast(err?.userMessage || 'Error al cargar archivos.', 'error');
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(files => {
        this.files = this.sortFilesByDate(files);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: clean up subscriptions and timers on destroy.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  /**
   * Purpose: trigger the hidden file input for PDF selection.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  /**
   * Purpose: handle file selection, validate, and execute upload flow.
   * Input: input change event. Output: void.
   * Error handling: validates type and size before upload; shows toast on errors.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    input.value = '';

    if (file.type !== ALLOWED_CONTENT_TYPE) {
      this.showToast('Solo se permiten archivos PDF.', 'error');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.showToast(`El archivo excede el limite de ${MAX_FILE_SIZE_MB}MB.`, 'error');
      return;
    }

    this.uploadFile(file);
  }

  /**
   * Purpose: open a file preview in a new browser tab.
   * Input: ClientBodyMeasurementFile. Output: void.
   * Error handling: shows toast on download URL failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  previewFile(file: ClientBodyMeasurementFile): void {
    this.fileService.getDownloadUrl(file.fileKey)
      .pipe(
        catchError(err => {
          this.showToast(err?.userMessage || 'No se pudo abrir el archivo.', 'error');
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        if (res?.downloadUrl) {
          window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
        }
      });
  }

  /**
   * Purpose: show inline delete confirmation for a specific file.
   * Input: file key string. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  confirmDelete(fileKey: string): void {
    this.confirmingDeleteKey = fileKey;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: cancel inline delete confirmation.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  cancelDelete(): void {
    this.confirmingDeleteKey = null;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: execute file deletion after confirmation.
   * Input: ClientBodyMeasurementFile. Output: void.
   * Error handling: shows toast on failure, reloads list on success.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  executeDelete(file: ClientBodyMeasurementFile): void {
    this.confirmingDeleteKey = null;
    this.deletingFileKey = file.fileKey;
    this.cdr.markForCheck();

    this.fileService.deleteFile(file)
      .pipe(
        catchError(err => {
          console.error('[BodyMeasurementFiles] delete failed', { error: err, fileKey: file.fileKey });
          this.showToast(err?.userMessage || 'No se pudo eliminar el archivo.', 'error');
          return of(null);
        }),
        finalize(() => {
          this.deletingFileKey = null;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        if (res !== null) {
          this.showToast('Archivo eliminado.', 'success');
          this.loadFiles();
        }
      });
  }

  /**
   * Purpose: provide stable tracking for file list rendering.
   * Input: index, ClientBodyMeasurementFile. Output: unique string.
   * Error handling: falls back to index for missing keys.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  trackByFile = (_index: number, file: ClientBodyMeasurementFile): string => {
    return file?.fileKey || `${_index}`;
  };

  /**
   * Purpose: format ISO dates for display.
   * Input: ISO date string. Output: dd/MM/yyyy or placeholder.
   * Error handling: returns placeholder on invalid date.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime())) return '-';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Purpose: dismiss the current toast notification.
   * Input: none. Output: void.
   * Error handling: N/A.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  dismissToast(): void {
    this.toast = null;
    this.cdr.markForCheck();
  }

  /**
   * Purpose: execute the full upload flow (get URL → upload to S3 → register record → reload).
   * Input: File object. Output: void.
   * Error handling: catches each step and shows toast on failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private uploadFile(file: File): void {
    this.isUploading = true;
    this.cdr.markForCheck();

    this.fileService.getUploadUrl(this.clientId, file.name, file.type)
      .pipe(
        switchMap(async ({ uploadUrl, fileKey }) => {
          await this.fileService.uploadFileToS3(uploadUrl, file);
          return fileKey;
        }),
        switchMap(fileKey =>
          this.fileService.createFileRecord({
            clientId: this.clientId,
            fileKey,
            fileName: file.name,
            contentType: file.type
          })
        ),
        catchError(err => {
          console.error('[BodyMeasurementFiles] upload failed', { error: err, fileName: file.name });
          this.showToast(err?.userMessage || 'Error al subir el archivo.', 'error');
          return of(null);
        }),
        finalize(() => {
          this.isUploading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(result => {
        if (result) {
          this.showToast('Archivo subido correctamente.', 'success');
          this.loadFiles();
        }
      });
  }

  /**
   * Purpose: reload the file list from the backend.
   * Input: none. Output: void.
   * Error handling: shows toast on failure; keeps existing list on error.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadFiles(): void {
    if (!this.clientId) return;

    this.fileService.getFilesByClient(this.clientId)
      .pipe(
        catchError(err => {
          console.error('[BodyMeasurementFiles] loadFiles failed', { error: err });
          this.showToast(err?.userMessage || 'Error al recargar archivos.', 'error');
          return of(this.files);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(files => {
        this.files = this.sortFilesByDate(files);
        this.cdr.markForCheck();
      });
  }

  /**
   * Purpose: sort files by createdAt descending (newest first).
   * Input: file array. Output: sorted copy.
   * Error handling: invalid dates default to 0.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private sortFilesByDate(files: ClientBodyMeasurementFile[]): ClientBodyMeasurementFile[] {
    return [...files].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      return tb - ta;
    });
  }

  /**
   * Purpose: display an auto-dismissing toast notification.
   * Input: message text, tone. Output: void.
   * Error handling: clears previous timer if overlapping.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private showToast(text: string, tone: 'success' | 'error'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast = { text, tone };
    this.cdr.markForCheck();
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.markForCheck();
    }, TOAST_DURATION_MS);
  }
}
