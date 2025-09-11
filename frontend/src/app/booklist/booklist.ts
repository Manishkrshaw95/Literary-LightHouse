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
  private _books: Array<any> = [];

  /** items per page used by the paginate pipe */
  itemsPerPage = 10;

  @Input()
  set books(v: Array<any>) {
    this._books = v || [];
    this.clampPage();
  }

  get books(): Array<any> {
    return this._books;
  }

  get hasBooks(): boolean {
    return Array.isArray(this._books) && this._books.length > 0;
  }

  p: number = 1;

  constructor(public cart: CartService) {}

  addToCart(book: any) {
    this.cart.addToCart(book);
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil((this._books || []).length / this.itemsPerPage));
    if (!Number.isFinite(this.p) || this.p < 1) this.p = 1;
    if (this.p > total) this.p = total;
  }
}
