import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ClientProfileComponent } from './client-profile.component';

// Purpose: verify client profile component creation.
// Input: none. Output: component instance.
// Error handling: N/A.
// Standards Check: SRP OK | DRY OK | Tests Pending.

describe('ClientProfileComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ClientProfileComponent]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClientProfileComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
