import { Injectable, signal } from '@angular/core';
import { API_BASE } from './api.config';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

export interface CartEntry {
  id: string | number;
  name: string;
  author?: string;
  price: number;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  // maintain grouped entries (one entry per product) with quantity
  private cartItems = signal<CartEntry[]>([]);

  constructor(private auth: AuthService, private toast: ToastService) {
    // hydrate cart from localStorage: stored as [{ id, quantity }]
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('ll_cart');
        if (raw) {
          const parsed: Array<{ id: string | number; quantity: number }> = JSON.parse(raw);
          // fetch product details from API and populate cartItems
          (async () => {
            try {
              // try to fetch all books data and match ids
              const res = await fetch(`${API_BASE}/booksData`);
              if (res.ok) {
                const all = await res.json();
                const entries: CartEntry[] = [];
                for (const p of parsed) {
                  const found = all.find((b: any) => String(b.id ?? b.name) === String(p.id));
                  if (found) {
                    entries.push({ id: p.id, name: found.name || found.title || String(p.id), author: found.author, price: found.price ?? 0, quantity: p.quantity });
                  }
                }
                if (entries.length) this.cartItems.set(entries);
              }
            } catch (e) { /* ignore */ }
          })();
        }
      }
    } catch (e) { /* ignore */ }
  }

  get items(): CartEntry[] {
    return this.cartItems();
  }

  // total count = sum of quantities
  get count(): number {
    return this.cartItems().reduce((s, e) => s + e.quantity, 0);
  }

  addToCart(book: any) {
    // prevent adding out-of-stock books for non-admin users
    if (book && book.out_of_stock) {
      const isAdmin = !!(this.auth && (this.auth.isAdmin));
      if (!isAdmin) {
        console.warn('[CartService] Cannot add to cart: book is out of stock', book);
        try { this.toast.show('This item is out of stock.', 'error', 3000); } catch (e) {}
        return;
      }
    }
    const key = book.id ?? book.name;
    const author = book.author ?? null;
    const price = book.price ?? book.price_inr ?? 0;
    this.cartItems.update(items => {
      const idx = items.findIndex(i => (i.id === key) && ((i.author ?? null) === author));
      if (idx === -1) {
        const entry: CartEntry = { id: key, name: book.name, author: book.author, price, quantity: 1 };
        return [...items, entry];
      }
      const copy = [...items];
      copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
      return copy;
    });
  this.persistCart();
  }

  // remove one unit from the given book entry; remove the entry if quantity hits 0
  removeOne(book: any) {
    const key = book.id ?? book.name;
    const author = book.author ?? null;
    this.cartItems.update(items => {
      const idx = items.findIndex(i => (i.id === key) && ((i.author ?? null) === author));
      if (idx === -1) return items;
      const copy = [...items];
      if (copy[idx].quantity > 1) {
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity - 1 };
      } else {
        copy.splice(idx, 1);
      }
      return copy;
    });
  this.persistCart();
  }

  removeAll(book: any) {
    const key = book.id ?? book.name;
    const author = book.author ?? null;
    this.cartItems.update(items => items.filter(i => !(i.id === key && ((i.author ?? null) === author))));
  this.persistCart();
  }

  clearCart() {
    this.cartItems.set([]);
    try { localStorage.removeItem('ll_cart'); } catch (e) {}
  }

  private persistCart() {
    try {
      if (typeof localStorage === 'undefined') return;
      const minimal = this.cartItems().map(i => ({ id: i.id, quantity: i.quantity }));
      localStorage.setItem('ll_cart', JSON.stringify(minimal));
    } catch (e) { }
  }
}
