import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ClientExerciseDetailComponent } from './client-exercise-detail.component';
import { ClientDataService } from '../../services/client-data.service';
import {
  ClientExerciseWeightLogService,
  CreateExerciseWeightLogRequest,
  ExerciseWeightLog,
  UpdateExerciseWeightLogRequest
} from '../../services/client-weight-entry.service';
import { ThemeService } from '../../services/theme.service';

// Purpose: tests for exercise detail component weight log flow (CRUD, date format, state management).
// Input: none. Output: test assertions.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('ClientExerciseDetailComponent', () => {
  const mockPlan = {
    planId: 'plan-1',
    sessions: [
      {
        name: 'Sesión 1',
        items: [
          {
            id: 'ex-1',
            name: 'Sentadilla'
          }
        ]
      }
    ]
  };

  let clientDataStub: { getMyPlans: jasmine.Spy };
  let exerciseWeightLogServiceStub: {
    getLogs: jasmine.Spy;
    createLog: jasmine.Spy;
    updateLog: jasmine.Spy;
    deleteLog: jasmine.Spy;
  };
  let routerStub: { navigate: jasmine.Spy };

  const activatedRouteStub = {
    paramMap: of(convertToParamMap({ planId: 'plan-1', sessionIndex: '0', exerciseIndex: '0' }))
  };

  const themeServiceStub = {
    resolveSessionName: (name?: string, index = 0) => name || `Sesión ${index + 1}`
  };

  beforeEach(async () => {
    clientDataStub = {
      getMyPlans: jasmine.createSpy('getMyPlans').and.returnValue(of([mockPlan]))
    };

    exerciseWeightLogServiceStub = {
      getLogs: jasmine.createSpy('getLogs').and.returnValue(
        of({ count: 1, items: [{ logId: 'log-1', planId: 'plan-1', exerciseId: 'ex-1', weight: 80, unit: 'kg', performedAt: '2026-08-31T00:00:00.000Z', note: 'Nota original' }] })
      ),
      createLog: jasmine.createSpy('createLog').and.returnValue(
        of({ message: 'Weight log created', item: { logId: 'log-2', planId: 'plan-1', exerciseId: 'ex-1', weight: 85, unit: 'kg', performedAt: '2026-09-01' } })
      ),
      updateLog: jasmine.createSpy('updateLog').and.returnValue(
        of({ message: 'Weight log updated', item: { logId: 'log-1', planId: 'plan-1', exerciseId: 'ex-1', weight: 82.5, unit: 'kg', performedAt: '2026-09-01', note: 'Nota editada' } })
      ),
      deleteLog: jasmine.createSpy('deleteLog').and.returnValue(
        of({ message: 'Weight log deleted', logId: 'log-1' })
      )
    };

    routerStub = { navigate: jasmine.createSpy('navigate') };

    await TestBed.configureTestingModule({
      imports: [ClientExerciseDetailComponent, NoopAnimationsModule],
      providers: [
        { provide: ClientDataService, useValue: clientDataStub },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: ClientExerciseWeightLogService, useValue: exerciseWeightLogServiceStub }
      ]
    }).compileComponents();
  });

  it('should create and load exercise and logs', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(exerciseWeightLogServiceStub.getLogs).toHaveBeenCalledWith('plan-1', 'ex-1');
    expect(component.weightLogs.length).toBe(1);
    expect(component.weightLogCount).toBe(1);
  });

  it('formats dates as DD/MM/YYYY without timezone shift from ISO and YYYY-MM-DD', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;

    expect(component.formatWeightLogDate('2026-08-31T00:00:00.000Z')).toBe('31/08/2026');
    expect(component.formatWeightLogDate('2026-09-01')).toBe('01/09/2026');
    expect(component.formatWeightLogDate('')).toBe('');
  });

  it('formats weight log using stored weight and unit independently of the form unit selector', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;

    // Selector en lb
    component.weightUnit = 'lb';

    const logInKg: ExerciseWeightLog = {
      logId: 'log-1',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 25,
      unit: 'kg',
      performedAt: '2026-08-31'
    };

    const logInLb: ExerciseWeightLog = {
      logId: 'log-2',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 55.5,
      unit: 'lb',
      performedAt: '2026-08-31'
    };

    expect(component.formatWeightLog(logInKg)).toBe('25 kg');
    expect(component.formatWeightLog(logInLb)).toBe('55.5 lb');
  });

  it('startEditWeightLog populates form and sets editingWeightLog with YYYY-MM-DD date', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const sampleLog: ExerciseWeightLog = {
      logId: 'log-1',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 27.5,
      unit: 'kg',
      performedAt: '2026-08-31T00:00:00.000Z',
      note: 'Subí un poco el peso'
    };

    component.startEditWeightLog(sampleLog);

    expect(component.editingWeightLog).toBe(sampleLog);
    expect(component.weightAmount).toBe(27.5);
    expect(component.weightUnit).toBe('kg');
    expect(component.recordedAt).toBe('2026-08-31');
    expect(component.weightNote).toBe('Subí un poco el peso');
  });

  it('cancelEditWeightLog resets form state to defaults', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.startEditWeightLog({
      logId: 'log-1',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 27.5,
      unit: 'kg',
      performedAt: '2026-08-31T00:00:00.000Z',
      note: 'Subí un poco el peso'
    });

    component.cancelEditWeightLog();

    expect(component.editingWeightLog).toBeNull();
    expect(component.weightAmount).toBeNull();
    expect(component.weightUnit).toBe('kg');
    expect(component.weightNote).toBe('');
  });

  it('saveWeightLog in edit mode calls updateLog with originalPerformedAt and reloads logs', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.startEditWeightLog({
      logId: 'log-1',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 27.5,
      unit: 'kg',
      performedAt: '2026-08-31T00:00:00.000Z',
      note: 'Nota previa'
    });

    component.weightAmount = 30;
    component.recordedAt = '2026-09-01';
    component.weightNote = 'Nueva nota';

    component.saveWeightLog();

    expect(exerciseWeightLogServiceStub.updateLog).toHaveBeenCalledWith({
      planId: 'plan-1',
      exerciseId: 'ex-1',
      logId: 'log-1',
      originalPerformedAt: '2026-08-31T00:00:00.000Z',
      weight: 30,
      unit: 'kg',
      performedAt: '2026-09-01',
      note: 'Nueva nota'
    } as UpdateExerciseWeightLogRequest);

    expect(component.editingWeightLog).toBeNull();
    expect(exerciseWeightLogServiceStub.getLogs).toHaveBeenCalledTimes(2);
  });

  it('updates unit correctly when changing unit during edit and sends updated unit in PUT', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.startEditWeightLog({
      logId: 'log-1',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 100,
      unit: 'kg',
      performedAt: '2026-08-31T00:00:00.000Z',
      note: 'Nota inicial'
    });

    expect(component.weightUnit).toBe('kg');
    expect(component.weightAmount).toBe(100);

    // Usuario cambia unidad a lb
    component.onWeightUnitChange('lb');
    expect(component.weightUnit).toBe('lb');
    expect(component.weightAmount).toBe(220.5);

    component.saveWeightLog();

    expect(exerciseWeightLogServiceStub.updateLog).toHaveBeenCalledWith({
      planId: 'plan-1',
      exerciseId: 'ex-1',
      logId: 'log-1',
      originalPerformedAt: '2026-08-31T00:00:00.000Z',
      weight: 220.5,
      unit: 'lb',
      performedAt: '2026-08-31',
      note: 'Nota inicial'
    } as UpdateExerciseWeightLogRequest);
  });

  it('saveWeightLog in create mode calls createLog and does not send clientId', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.weightAmount = 90;
    component.weightUnit = 'kg';
    component.recordedAt = '2026-09-01';
    component.weightNote = 'Buena serie';

    component.saveWeightLog();

    expect(exerciseWeightLogServiceStub.createLog).toHaveBeenCalledWith({
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 90,
      unit: 'kg',
      performedAt: '2026-09-01',
      note: 'Buena serie'
    } as CreateExerciseWeightLogRequest);
  });

  it('promptDeleteWeightLog and confirmDeleteWeightLog call deleteLog with query params and reload logs', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const targetLog: ExerciseWeightLog = {
      logId: 'log-1',
      planId: 'plan-1',
      exerciseId: 'ex-1',
      weight: 80,
      unit: 'kg',
      performedAt: '2026-08-31T00:00:00.000Z'
    };

    component.promptDeleteWeightLog(targetLog);
    expect(component.logPendingDelete).toBe(targetLog);

    component.confirmDeleteWeightLog();

    expect(exerciseWeightLogServiceStub.deleteLog).toHaveBeenCalledWith(
      'plan-1',
      'ex-1',
      'log-1',
      '2026-08-31T00:00:00.000Z'
    );
    expect(component.logPendingDelete).toBeNull();
    expect(exerciseWeightLogServiceStub.getLogs).toHaveBeenCalledTimes(2);
  });
});
