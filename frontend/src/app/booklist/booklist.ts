import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPaginationModule } from 'ngx-pagination';
import { CartService } from '../cart.service';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';

@Component({
  selector: 'app-booklist',
  standalone: true,
  imports: [CommonModule, NgxPaginationModule, ImgFallbackDirective],
  templateUrl: './booklist.html',
  styleUrls: ['./booklist.component.scss']
})
export class BooklistComponent {
  @Input() books: Array<any> = [];
  p: number = 1;

  constructor(public cart: CartService) {}

  addToCart(book: any) {
    this.cart.addToCart(book);
  }
}
