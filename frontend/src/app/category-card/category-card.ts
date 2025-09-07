import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-category-card',
  templateUrl: './category-card.html',
  styleUrls: ['./category-card.scss']
})
export class CategoryCardComponent {
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() image: string = '';
  @Input() background: string = '#fff';
}
