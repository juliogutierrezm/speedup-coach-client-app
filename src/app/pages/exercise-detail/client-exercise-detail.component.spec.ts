import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ClientExerciseDetailComponent } from './client-exercise-detail.component';
import { ClientDataService } from '../../services/client-data.service';
import { ThemeService } from '../../services/theme.service';

// Purpose: placeholder test for exercise detail component creation.
// Input: none. Output: component instance.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('ClientExerciseDetailComponent', () => {
  const clientDataStub = {
    getMyPlans: () => of([])
  };
  const themeServiceStub = {
    resolveSessionName: (name?: string, index = 0) => name || `Sesión ${index + 1}`
  };

  const routerStub = { navigate: jasmine.createSpy('navigate') };
  const activatedRouteStub = {
    paramMap: of(convertToParamMap({ planId: 'plan-1', sessionIndex: '0', exerciseIndex: '0' }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientExerciseDetailComponent, NoopAnimationsModule],
      providers: [
        { provide: ClientDataService, useValue: clientDataStub },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: ThemeService, useValue: themeServiceStub }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientExerciseDetailComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
