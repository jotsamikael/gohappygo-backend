import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlateformPricingComponent } from './plateform-pricing.component';

describe('PlateformPricingComponent', () => {
  let component: PlateformPricingComponent;
  let fixture: ComponentFixture<PlateformPricingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlateformPricingComponent]
    });
    fixture = TestBed.createComponent(PlateformPricingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
