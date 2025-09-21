import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../cart.service';
import { AuthService, UserRecord } from '../auth.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LoginModalService } from '../login-modal/login-modal.service';
import { ToastService } from '../toast.service';
import { API_BASE } from '../api.config';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.scss']
})
export class CheckoutComponent implements OnInit {

  form: any;

  processing = false;
  showAuth = false;
  authMode: 'login' | 'register' = 'login';
  currentStep = 1;
  otpSent = false;
  otpMasked: string | null = null;
  otpValue: string | null = null;
  // order confirmation state
  orderPlaced = false;
  order: any = null;

  constructor(public cart: CartService, private fb: FormBuilder, private router: Router, public auth: AuthService, public modal: LoginModalService, private toast: ToastService) {}

  // expose a typed user getter so the template type-checker can narrow properties
  get user(): UserRecord | null { return this.auth.currentUser as UserRecord | null; }

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required],
      // default to UPI to avoid blocking on card validation unless selected
      paymentMethod: ['upi', Validators.required],
      // card fields (optional depending on paymentMethod)
      cardNumber: ['', []],
      cardExpiry: ['', []],
      cardCvv: ['', []]
    });

    // Prefill from current user if available
    const u = this.auth.currentUser;
    if (u) {
      this.form.patchValue({
        name: u.name || '',
        email: u.email || '',
        address: u.address || ''
      });
      this.currentStep = 2;
    }
    // React to login after opening the modal
    try {
      (this.auth.userSignal as any).subscribe?.((usr: any) => {
        if (usr) {
          this.form.patchValue({
            name: usr.name || '',
            email: usr.email || '',
            address: usr.address || ''
          });
          this.currentStep = 2;
        }
      });
    } catch {}
  }

  async doRegister(payload: { name: string; email?: string; phone?: string; password?: string }) {
    const saved = await this.auth.register(payload as any);
    if (saved) {
      // persist current form address to user
      const addr = this.form.get('address')?.value;
      if (addr) this.auth.saveAddress(addr);
      this.showAuth = false;
      // continue to payment flow
      this.placeOrder();
    }
  }

  async doLogin(payload: { identifier?: string; password?: string }) {
    // identifier can be email or phone
    const id = payload.identifier || '';
    const isEmail = /@/.test(id);
    const loginPayload: { email?: string; phone?: string; password?: string } = { password: payload.password };
    if (isEmail) loginPayload.email = id;
    else loginPayload.phone = id;
    const u = await this.auth.login(loginPayload as any);
    if (u) {
      const addr = this.form.get('address')?.value;
      if (addr) this.auth.saveAddress(addr);
      this.showAuth = false;
      this.placeOrder();
    }
  }

  async sendOtp(identifier?: string) {
    if (!identifier) return;
    // treat identifier as phone if not containing '@'
    const phone = /@/.test(identifier) ? null : identifier;
    if (!phone) return; // only send OTP to phones in this mock
    const res = await this.auth.sendOtp(phone);
    if (res && res.ok) {
      this.otpSent = true;
      this.otpMasked = res.masked || phone.slice(-4).padStart(phone.length, '*');
    }
  }

  async verifyOtp(identifier?: string, code?: string) {
    if (!identifier || !code) return;
    const phone = /@/.test(identifier) ? null : identifier;
    if (!phone) return;
    const r = await this.auth.verifyOtp(phone, code);
    if (r && r.ok) {
      // attempt to login by phone; if not found, create a local user
      let u = await this.auth.loginByPhone(phone as string);
      if (!u) {
        // register local user with phone
        u = await this.auth.register({ name: 'User', phone } as any);
      }
      if (u) {
        this.otpSent = false;
        this.otpMasked = null;
        this.showAuth = false;
        this.placeOrder();
      }
    }
  }

  toggleStep(n: number) {
    this.currentStep = this.currentStep === n ? n : n;
  }

  nextStep() {
    if (this.currentStep < 4) this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  get total() {
    return this.cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  }

  async placeOrder() {
    // guard: must have items in cart
    if (!this.cart.items || this.cart.items.length === 0) {
      this.currentStep = 3;
      try { this.toast.show('Your cart is empty.', 'info', 2200); } catch {}
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.currentStep = 2;
      try { this.toast.show('Please complete your delivery details.', 'error', 2500); } catch {}
      return;
    }
    // validate card fields when card payment is selected
    const pm = this.form.get('paymentMethod')?.value;
    if (pm === 'card') {
      const num = this.form.get('cardNumber')?.value || '';
      const cvv = this.form.get('cardCvv')?.value || '';
      const expiry = this.form.get('cardExpiry')?.value || '';
      const simpleCardValid = /^\d{12,19}$/.test(num.replace(/\s+/g, '')) && /^\d{3,4}$/.test(cvv) && /^\d{2}\/\d{2}$/.test(expiry);
      if (!simpleCardValid) {
        this.form.get('cardNumber')?.markAsTouched();
        this.form.get('cardCvv')?.markAsTouched();
        this.form.get('cardExpiry')?.markAsTouched();
        this.currentStep = 4;
        try { this.toast.show('Enter valid card details or choose a different method.', 'error', 2500); } catch {}
        return;
      }
    }
    // require login/register if user not present
    if (!this.auth.currentUser) {
      this.showAuth = true; // kept for backwards compatibility, though modal is used
      this.authMode = 'login';
      try { this.modal.open(); } catch {}
      this.currentStep = 1;
      try { this.toast.show('Please sign in to place your order.', 'info', 2500); } catch {}
      return;
    }

    // simulate payment processing delay visually
    this.processing = true;
    try {
      const phone = this.auth.currentUser?.phone || this.form.get('email')?.value || '';
      const address = this.form.get('address')?.value || '';
      const items = this.cart.items.map(i => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price }));
      const total = this.total;
      const userId = String(this.auth.currentUser?.id || '');
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, phone, address, items, total })
      });
      if (!res.ok) throw new Error(`Order failed (${res.status})`);
      const data = await res.json();
      // set local order object so template can render confirmation stacked
      this.order = { orderId: data.orderId, ack: data.ack, phone: data.phone, address: data.address, items: data.items, total: data.total };
      // clear cart UI; server already cleared persisted cart in POST /orders
      this.cart.clearCart();
      this.orderPlaced = true;
    } catch (e: any) {
      try { this.toast.show('Failed to place order. Please try again.', 'error', 3000); } catch {}
    } finally {
      this.processing = false;
    }
  }

  continueShopping() {
    this.orderPlaced = false;
    this.order = null;
    this.router.navigate(['/']);
  }

  printReceipt() {
    if (!this.order) return;
    const win = window.open('', '_blank', 'noopener');
    if (!win) return;
    const items = (this.order.items || []);
    const itemsHtml = items.map((it: any) => `
      <tr>
        <td class="cell-name">${escapeHtml(it.name)}</td>
        <td class="cell-author">${escapeHtml(it.author || '')}</td>
        <td class="cell-qty">${it.qty}</td>
        <td class="cell-price">₹${it.price.toFixed(2)}</td>
        <td class="cell-line">₹${(it.price * it.qty).toFixed(2)}</td>
      </tr>
    `).join('');
    const orderDate = new Date().toLocaleString();
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Receipt - ${escapeHtml(this.order.orderId)}</title>
          <style>
            :root{color-scheme:light}
            body{font-family:Inter, Roboto, Arial, Helvetica, sans-serif;padding:20px;color:#111;background:#fff}
            .brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}
            .mark{width:48px;height:48px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#f3f4f6;color:#111;font-weight:700}
            .brand-title{font-size:20px;font-weight:800}
            .brand-sub{display:block;font-size:12px;color:#6b7280}
            .meta{margin-bottom:12px;color:#374151}
            .meta div{margin:4px 0}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th,td{padding:8px 10px;border-bottom:1px solid #e6e6e6;text-align:left}
            th{background:#fafafa;font-weight:700}
            .cell-qty,.cell-price,.cell-line{text-align:right}
            .total-row td{border-top:2px solid #d1d5db;font-weight:800}
            .footer{margin-top:18px;color:#6b7280;font-size:13px}
            @media print{ body{padding:8px} .no-print{display:none} }
          </style>
        </head>
        <body>
          <div class="brand">
            <div class="mark">LL</div>
            <div>
              <div class="brand-title">Literary <span style="color:#f59e0b">Lighthouse</span></div>
              <div class="brand-sub">Knowledge of the world — in zero minutes</div>
            </div>
          </div>
          <div class="meta">
            <div>Order ID: <strong>${escapeHtml(this.order.orderId)}</strong></div>
            <div>Ack: <strong>${escapeHtml(this.order.ack)}</strong></div>
            <div>Date: <strong>${escapeHtml(orderDate)}</strong></div>
            <div>Phone: <strong>${escapeHtml(this.order.phone || '')}</strong></div>
            <div>Delivery address: <em>${escapeHtml(this.order.address || '')}</em></div>
          </div>
          <div class="items">
            <table>
              <thead>
                <tr><th>Book</th><th>Author</th><th>Qty</th><th>Unit</th><th>Line total</th></tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr class="total-row"><td colspan="4">Total</td><td>₹${Number(this.order.total).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="footer no-print">Thank you for shopping with Literary Lighthouse.</div>
          <div class="no-print" style="margin-top:12px">
            <button onclick="window.print()" style="padding:8px 12px;border-radius:6px;border:none;background:#111;color:#fff;cursor:pointer">Print / Save as PDF</button>
          </div>
          <script>window.onload = function(){ setTimeout(()=>{ /* keep UI-driven print optional */ }, 200); };</script>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}

// small helper to escape HTML inserted into the receipt
function escapeHtml(input: any) {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
