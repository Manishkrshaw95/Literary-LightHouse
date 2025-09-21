import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPaginationModule } from 'ngx-pagination';
import { CartService } from '../cart.service';
import { AuthService } from '../auth.service';
import { API_BASE } from '../api.config';
import { ToastService } from '../toast.service';
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

  constructor(public cart: CartService, public auth: AuthService, private toast: ToastService) {}

  addToCart(book: any) {
    this.cart.addToCart(book);
  }

  async toggleOutOfStock(book: any, out: boolean) {
    if (!book || !book.id) return;
    // optimistic update
    book.out_of_stock = !!out;
    try {
      // persist to backend
      const res = await fetch(`${API_BASE}/booksData/${book.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ out_of_stock: !!out }) });
      if (res.ok) {
        this.toast.show(`Book "${book.name}" marked ${out ? 'out of stock' : 'available'}`, 'success', 3000);
      } else {
        throw new Error('Patch failed');
      }
    } catch (e) {
      // revert on failure
      book.out_of_stock = !out;
      this.toast.show('Failed to update book status. Try again.', 'error', 3000);
    }
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil((this._books || []).length / this.itemsPerPage));
    if (!Number.isFinite(this.p) || this.p < 1) this.p = 1;
    if (this.p > total) this.p = total;
  }
}
