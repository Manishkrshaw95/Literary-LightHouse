import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-checkout-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="checkout-confirm">
      <h2>Thank you for your order!</h2>
      <p *ngIf="orderId">Your order id: <strong>{{ orderId }}</strong></p>
      <p *ngIf="total">Amount paid: <strong>₹{{ total }}</strong></p>
      <a routerLink="/">Continue shopping</a>
    </div>
  `,
  styles: [`.checkout-confirm{max-width:720px;margin:3rem auto;padding:1.6rem;background:var(--card-bg);border-radius:8px;color:var(--text)}a{display:inline-block;margin-top:1rem;color:var(--accent)}`]
})
export class CheckoutConfirmationComponent {
  orderId = history.state?.orderId;
  total = history.state?.total;
}
