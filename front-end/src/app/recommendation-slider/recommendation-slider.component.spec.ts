import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecommendationSliderComponent } from './recommendation-slider.component';

describe('RecommendationSliderComponent', () => {
  let component: RecommendationSliderComponent;
  let fixture: ComponentFixture<RecommendationSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationSliderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecommendationSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
