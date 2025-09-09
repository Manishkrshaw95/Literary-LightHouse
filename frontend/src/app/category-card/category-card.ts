import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';

@Component({
  selector: 'app-category-card',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './category-card.html',
  styleUrls: ['./category-card.scss']
})
export class CategoryCardComponent {
  @Input() title: string = '';
  @Input() description: string = '';
  @Input() image: string = '';
  @Input() background: string = '#fff';
}
