import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AirlinesComponent } from './airlines.component';

describe('AirlinesComponent', () => {
  let component: AirlinesComponent;
  let fixture: ComponentFixture<AirlinesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AirlinesComponent]
    });
    fixture = TestBed.createComponent(AirlinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
