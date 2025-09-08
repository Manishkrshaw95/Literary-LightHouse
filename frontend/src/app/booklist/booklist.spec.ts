import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Booklist } from './booklist';

describe('Booklist', () => {
  let component: Booklist;
  let fixture: ComponentFixture<Booklist>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Booklist]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Booklist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
