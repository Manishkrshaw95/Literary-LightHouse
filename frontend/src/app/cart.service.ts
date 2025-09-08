import { Injectable, signal } from '@angular/core';

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

  get items(): CartEntry[] {
    return this.cartItems();
  }

  // total count = sum of quantities
  get count(): number {
    return this.cartItems().reduce((s, e) => s + e.quantity, 0);
  }

  addToCart(book: any) {
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
  }

  removeAll(book: any) {
    const key = book.id ?? book.name;
    const author = book.author ?? null;
    this.cartItems.update(items => items.filter(i => !(i.id === key && ((i.author ?? null) === author))));
  }

  clearCart() {
    this.cartItems.set([]);
  }
}
