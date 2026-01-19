import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ClientBodyCompositionComponent } from './client-body-composition.component';

// Purpose: verify body composition component creation.
// Input: none. Output: component instance.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('ClientBodyCompositionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ClientBodyCompositionComponent]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientBodyCompositionComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
