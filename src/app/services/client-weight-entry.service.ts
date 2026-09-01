import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExerciseWeightLog {
  logId?: string;
  id?: string;
  planId: string;
  exerciseId: string;
  weight: number;
  unit: 'kg' | 'lb';
  performedAt: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateExerciseWeightLogRequest {
  planId: string;
  exerciseId: string;
  weight: number;
  unit: 'kg' | 'lb';
  performedAt: string;
  note?: string;
}

export interface UpdateExerciseWeightLogRequest {
  planId: string;
  exerciseId: string;
  logId: string;
  originalPerformedAt: string;
  weight: number;
  unit: 'kg' | 'lb';
  performedAt: string;
  note?: string;
}

export interface ExerciseWeightLogsResponse {
  count: number;
  items: ExerciseWeightLog[];
}

export interface CreateExerciseWeightLogResponse {
  message?: string;
  item: ExerciseWeightLog;
}

export interface UpdateExerciseWeightLogResponse {
  message?: string;
  item: ExerciseWeightLog;
}

export interface DeleteExerciseWeightLogResponse {
  message?: string;
  logId?: string;
}

/**
 * Purpose: manage exercise load records belonging to the authenticated client.
 * Input: exercise load log requests. Output: persisted logs from the client API.
 * Error handling: delegates HTTP errors to the calling component for user feedback.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class ClientExerciseWeightLogService {
  private readonly logsUrl = `${environment.apiBase}/clients/exercise-weight-logs`;

  constructor(private http: HttpClient) {}

  getLogs(planId: string, exerciseId: string): Observable<ExerciseWeightLogsResponse> {
    return this.http.get<ExerciseWeightLogsResponse>(this.logsUrl, {
      params: { planId, exerciseId }
    });
  }

  createLog(log: CreateExerciseWeightLogRequest): Observable<CreateExerciseWeightLogResponse> {
    return this.http.post<CreateExerciseWeightLogResponse>(this.logsUrl, log);
  }

  updateLog(log: UpdateExerciseWeightLogRequest): Observable<UpdateExerciseWeightLogResponse> {
    return this.http.put<UpdateExerciseWeightLogResponse>(this.logsUrl, log);
  }

  deleteLog(
    planId: string,
    exerciseId: string,
    logId: string,
    performedAt: string
  ): Observable<DeleteExerciseWeightLogResponse> {
    const params = new HttpParams()
      .set('planId', planId)
      .set('exerciseId', exerciseId)
      .set('logId', logId)
      .set('performedAt', performedAt);

    return this.http.delete<DeleteExerciseWeightLogResponse>(this.logsUrl, { params });
  }
}