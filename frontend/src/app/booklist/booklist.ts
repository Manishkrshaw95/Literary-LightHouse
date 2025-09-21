import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPaginationModule } from 'ngx-pagination';
import { CartService } from '../cart.service';
import { AuthService } from '../auth.service';
import { LoginModalService } from '../login-modal/login-modal.service';
import { API_BASE } from '../api.config';
import { ToastService } from '../toast.service';
import { ImgFallbackDirective } from '../shared/img-fallback.directive';
import { BookService } from '../book.service';

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
  private pageStorageKey = 'll_books_page_v1';

  async ngOnInit(): Promise<void> {
    // prefer sessionStorage for session-scoped page memory
    try {
      const raw = sessionStorage.getItem(this.pageStorageKey);
      const v = Number(raw || '1');
      if (Number.isFinite(v) && v >= 1) this.p = v;
    } catch (e) { /* ignore */ }

    // if user is logged in, try to load server-side persisted page
    try {
      const u = this.auth.currentUser;
      if (u && u.id) {
        const res = await fetch(`${API_BASE}/users/${encodeURIComponent(String(u.id))}/settings`);
        if (res.ok) {
          const settings = await res.json();
          if (settings && Number.isFinite(Number(settings.lastBookPage))) {
            const sp = Number(settings.lastBookPage);
            if (sp >= 1) this.p = sp;
          }
        }
      }
    } catch (e) { /* ignore server settings fetch errors */ }
  }

  onPageChange(newPage: number) {
    this.p = newPage;
    try { sessionStorage.setItem(this.pageStorageKey, String(newPage)); } catch (e) {}

    // if user logged in, persist to server as well
    try {
      const u = this.auth.currentUser;
      if (u && u.id) {
        fetch(`${API_BASE}/users/${encodeURIComponent(String(u.id))}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastBookPage: newPage }) }).catch(() => {});
      }
    } catch (e) {}
  }

  constructor(public cart: CartService, public auth: AuthService, private toast: ToastService, public modal: LoginModalService, private bookSvc: BookService) {}

  addToCart(book: any) {
    this.cart.addToCart(book);
  }

  // Trigger add-to-cart with a fly-to-cart animation
  async addToCartAndAnimate(ev: Event, book: any) {
    // If not logged in, open the login modal instead of animating
    const u = this.auth.currentUser;
    if (!u || !u.id) {
      try {
        // open the shared LoginModalService
        this.modal.open();
      } catch (e) {
        // fallback to existing toast if modal not available
        try { this.toast.show('Please login to save your cart.', 'info', 2500); } catch (e) {}
      }
      return;
    }

    try {
      // call existing logic to update cart / persist
      this.addToCart(book);

      // find the image element for this book card
      const btn = ev.currentTarget as HTMLElement;
      const card = btn?.closest?.('.book-card') as HTMLElement | null;
      const img = card?.querySelector('.book-image') as HTMLImageElement | null;
      const headerCart = document.querySelector('.cart-icon') as HTMLElement | null;
      if (!img || !headerCart) return;

      // create clone
      const rect = img.getBoundingClientRect();
      const clone = img.cloneNode(true) as HTMLImageElement;
      clone.style.position = 'fixed';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.transition = 'transform 700ms cubic-bezier(.2,.8,.2,1), opacity 700ms ease';
      clone.style.zIndex = '9999';
      clone.classList.add('flying-image');
      document.body.appendChild(clone);

      // compute target position (center of cart icon)
      const targetRect = headerCart.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width / 2 - rect.width / 2;
      const targetY = targetRect.top + targetRect.height / 2 - rect.height / 2;

      // force layout
      clone.getBoundingClientRect();

      // translate to target with scale down
      const dx = targetX - rect.left;
      const dy = targetY - rect.top;
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.25)`;
      clone.style.opacity = '0.9';

      // bump cart icon
      headerCart.classList.add('cart-bump');

      // cleanup after animation
      setTimeout(() => {
        try { headerCart.classList.remove('cart-bump'); } catch (e) {}
        try { clone.remove(); } catch (e) {}
      }, 800);
    } catch (e) {
      // fallback: just add to cart
      try { this.addToCart(book); } catch (e) {}
    }
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
        // Invalidate cache and refresh from server so all views reflect latest state
        try {
          this.bookSvc.invalidateCache();
          const fresh = await this.bookSvc.refreshFromServer();
          // update the local books array in place preserving pagination
          this._books = fresh;
          this.clampPage();
        } catch {}
      } else {
        throw new Error('Patch failed');
      }
    } catch (e) {
      // revert on failure
      book.out_of_stock = !out;
      this.toast.show('Failed to update book status. Try again.', 'error', 3000);
      // Best-effort refresh to get consistent state
      try { await this.bookSvc.refreshFromServer(); } catch {}
    }
  }

  private clampPage() {
    const total = Math.max(1, Math.ceil((this._books || []).length / this.itemsPerPage));
    if (!Number.isFinite(this.p) || this.p < 1) this.p = 1;
    if (this.p > total) this.p = total;
  }
}
