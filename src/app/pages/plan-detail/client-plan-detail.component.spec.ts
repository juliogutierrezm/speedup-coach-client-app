import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ClientPlanDetailComponent } from './client-plan-detail.component';
import { ClientDataService } from '../../services/client-data.service';
import { ThemeService } from '../../services/theme.service';

// Purpose: placeholder test for plan detail component creation.
// Input: none. Output: component instance.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('ClientPlanDetailComponent', () => {
  const clientDataStub = {
    getMyPlans: () => of([])
  };
  const themeServiceStub = {
    resolveSessionName: (name?: string, index = 0) => name || `Sesión ${index + 1}`,
    getSessionLabelLower: () => 'sesiones',
    getSessionLabel: () => 'Sesiones'
  };

  const routerStub = { navigate: jasmine.createSpy('navigate') };
  const activatedRouteStub = { paramMap: of(convertToParamMap({ planId: 'plan-1' })) };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientPlanDetailComponent, NoopAnimationsModule],
      providers: [
        { provide: ClientDataService, useValue: clientDataStub },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: ThemeService, useValue: themeServiceStub }
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientPlanDetailComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
