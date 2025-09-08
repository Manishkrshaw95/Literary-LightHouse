import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss']
})
export class CartComponent {
  constructor(public cart: CartService) {}
  // cart.items are now grouped CartEntry objects
  get groupedItems() {
    return this.cart.items;
  }

  get total() {
    return this.cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // delegate to service which handles quantities
  increaseQuantity(entry: any) {
    this.cart.addToCart(entry);
  }

  decreaseQuantity(entry: any) {
    this.cart.removeOne(entry);
  }

  removeAll(entry: any) {
    this.cart.removeAll(entry);
  }
}
