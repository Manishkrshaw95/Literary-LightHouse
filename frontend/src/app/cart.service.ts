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
  // optional server-side id when persisted
  serverId?: string | number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  // maintain grouped entries (one entry per product) with quantity
  private cartItems = signal<CartEntry[]>([]);

  constructor(private auth: AuthService, private toast: ToastService) {
    // hydrate cart: if user already logged in, load from server; otherwise start empty
    (async () => {
      try {
        const u = this.auth.currentUser;
        if (u && u.id) {
          await this.loadCartFromServer(String(u.id));
        } else {
          this.cartItems.set([]);
        }
      } catch (e) { /* ignore */ }
    })();
    // react to login/logout: whenever auth.userSignal changes, reload cart
    try {
      // AuthService exposes a signal userSignal; subscribe to changes
      (this.auth.userSignal as any).subscribe?.((u: any) => {
        try {
          if (u && u.id) this.loadCartFromServer(String(u.id));
          else this.cartItems.set([]);
        } catch (e) {}
      });
    } catch (e) { /* ignore if signals don't support subscribe */ }
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
    const u = this.auth.currentUser;
    // Require user to be logged in for server-backed cart
    if (!u || !u.id) {
      try { this.toast.show('Please login to save your cart.', 'info', 2500); } catch (e) {}
      return;
    }
    // If logged in, perform optimistic UI update, then persist to server
    if (u && u.id) {
      // optimistic update: increment UI count immediately
      this.cartItems.update(items => {
        const idx = items.findIndex(i => String(i.id) === String(key));
        if (idx === -1) {
          const entry: CartEntry = { id: key, name: book.name || String(key), author: book.author, price, quantity: 1 };
          return [...items, entry];
        }
        const copy = [...items];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      });
      try { this.toast.show('Added to cart', 'success', 1000); } catch (e) {}

      (async () => {
        try {
          // verify latest stock before posting
          try {
            const chk = await fetch(`${API_BASE}/booksData/${encodeURIComponent(String(key))}`);
            if (chk.ok) {
              const bd = await chk.json();
              if (bd && bd.out_of_stock && !(this.auth && this.auth.isAdmin)) {
                // revert optimistic UI change
                this.cartItems.update(items => {
                  const idx = items.findIndex(i => String(i.id) === String(key));
                  if (idx === -1) return items;
                  const copy = [...items];
                  const q = copy[idx].quantity - 1;
                  if (q <= 0) { copy.splice(idx, 1); } else { copy[idx] = { ...copy[idx], quantity: q }; }
                  return copy;
                });
                try { this.toast.show('This item just went out of stock.', 'error', 2500); } catch {}
                return;
              }
            }
          } catch {}
          const res = await fetch(`${API_BASE}/cart/${encodeURIComponent(String(u.id))}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: String(key), quantity: 1 }) });
          if (res.ok) {
            const serverItem = await res.json();
            // fetch book details and reconcile server quantity/serverId
            let name = book.name || String(key), authorVal = book.author, priceVal = price;
            try {
              const b = await fetch(`${API_BASE}/booksData/${encodeURIComponent(String(key))}`);
              if (b.ok) {
                const bd = await b.json(); name = bd.name || name; authorVal = bd.author || authorVal; priceVal = bd.price ?? priceVal;
              }
            } catch (e) {}
            this.cartItems.update(items => {
              const idx = items.findIndex(i => String(i.id) === String(key));
              if (idx === -1) {
                const entry: CartEntry = { id: key, name, author: authorVal, price: priceVal, quantity: serverItem.quantity || 1, serverId: serverItem.id };
                return [...items, entry];
              }
              const copy = [...items];
              copy[idx] = { ...copy[idx], quantity: serverItem.quantity || copy[idx].quantity, serverId: serverItem.id };
              return copy;
            });
          } else {
            if (res.status === 409) {
              // out of stock server-side, revert optimistic UI
              this.cartItems.update(items => {
                const idx = items.findIndex(i => String(i.id) === String(key));
                if (idx === -1) return items;
                const copy = [...items];
                const q = copy[idx].quantity - 1;
                if (q <= 0) { copy.splice(idx, 1); } else { copy[idx] = { ...copy[idx], quantity: q }; }
                return copy;
              });
              try { this.toast.show('This item is out of stock.', 'error', 2500); } catch {}
              return;
            }
            // server rejected - reload server cart to reconcile
            await this.loadCartFromServer(String(u.id));
            try { this.toast.show('Failed to save cart to server', 'error', 2000); } catch (e) {}
          }
        } catch (e) {
          // network error - reload server cart later to reconcile
          try { this.toast.show('Network error while saving cart', 'error', 2000); } catch (e) {}
          await this.loadCartFromServer(String(u.id));
        }
      })();
    }
  }

  // remove one unit from the given book entry; remove the entry if quantity hits 0
  removeOne(book: any) {
    const key = book.id ?? book.name;
    const u = this.auth.currentUser;
    if (!u || !u.id) {
      try { this.toast.show('Please login to modify your saved cart.', 'info', 2000); } catch (e) {}
      return;
    }
    // decrement by posting negative quantity
    (async () => {
      try {
        await fetch(`${API_BASE}/cart/${encodeURIComponent(String(u.id))}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: String(key), quantity: -1 }) });
        // refresh server cart
        await this.loadCartFromServer(String(u.id));
      } catch (e) { /* ignore */ }
    })();
  }

  removeAll(book: any) {
    const key = book.id ?? book.name;
    const u = this.auth.currentUser;
    if (!u || !u.id) {
      try { this.toast.show('Please login to modify your saved cart.', 'info', 2000); } catch (e) {}
      return;
    }
    (async () => {
      try {
        const items = this.cartItems();
        const found = items.find(i => String(i.id) === String(key));
        if (found && found.serverId) {
          await fetch(`${API_BASE}/cart/${encodeURIComponent(String(u.id))}/${encodeURIComponent(String(found.serverId))}`, { method: 'DELETE' });
        } else {
          await fetch(`${API_BASE}/cart/${encodeURIComponent(String(u.id))}/${encodeURIComponent(String(key))}`, { method: 'DELETE' });
        }
        await this.loadCartFromServer(String(u.id));
      } catch (e) {}
    })();
  }

  clearCart() {
    const u = this.auth.currentUser;
    if (!u || !u.id) {
      try { this.toast.show('Please login to clear your saved cart.', 'info', 2000); } catch (e) {}
      return;
    }
    (async () => {
      try {
        const rows = await fetch(`${API_BASE}/cart/${encodeURIComponent(String(u.id))}`);
        if (rows.ok) {
          const items = await rows.json();
          for (const it of items) {
            try { await fetch(`${API_BASE}/cart/${encodeURIComponent(String(u.id))}/${encodeURIComponent(String(it.id))}`, { method: 'DELETE' }); } catch {}
          }
        }
      } catch (e) {}
      this.cartItems.set([]);
    })();
  }

  private persistCart() {
    // no-op: cart is server backed and persisted on each mutation; nothing to do here
    try {} catch (e) {}
  }

  // Load server-side cart for a user and hydrate cartItems
  async loadCartFromServer(userId: string) {
    try {
      const res = await fetch(`${API_BASE}/cart/${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const rows = await res.json();
      const out: CartEntry[] = [];
      for (const r of rows) {
        const bookId = r.bookId || r.book_id || r.book || r.bookId;
        let name = String(bookId), author = undefined, price = 0;
        try {
          const bres = await fetch(`${API_BASE}/booksData/${encodeURIComponent(String(bookId))}`);
          if (bres.ok) {
            const bd = await bres.json(); name = bd.name || name; author = bd.author; price = bd.price ?? 0;
          }
        } catch (e) {}
        out.push({ id: String(bookId), name, author, price, quantity: Number(r.quantity || 0), serverId: r.id });
      }
      this.cartItems.set(out);
    } catch (e) { /* ignore */ }
  }

  // Called after a successful login to migrate any localStorage cart into server-side cart
  async syncLocalCartOnLogin(userId: string) {
    try {
      // No local cart to migrate since we removed localStorage usage; just load server cart
      await this.loadCartFromServer(userId);
    } catch (e) {}
  }
}
