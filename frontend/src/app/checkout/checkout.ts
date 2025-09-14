import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../cart.service';
import { AuthService, UserRecord } from '../auth.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LoginModalService } from '../login-modal/login-modal.service';

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

  constructor(public cart: CartService, private fb: FormBuilder, private router: Router, public auth: AuthService, public modal: LoginModalService) {}

  // expose a typed user getter so the template type-checker can narrow properties
  get user(): UserRecord | null { return this.auth.currentUser as UserRecord | null; }

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required],
  paymentMethod: ['card', Validators.required],
  // card fields (optional depending on paymentMethod)
  cardNumber: ['', []],
  cardExpiry: ['', []],
  cardCvv: ['', []]
    });
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

  placeOrder() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
        return;
      }
    }
    // require login/register if user not present
    if (!this.auth.currentUser) {
      this.showAuth = true;
      this.authMode = 'login';
      return;
    }

    // simulate payment processing
    this.processing = true;
    setTimeout(() => {
      // mock order id
      const orderId = 'ORD' + Date.now();
      // clear cart
      this.cart.clearCart();
      this.processing = false;
      // navigate to simple confirmation route with state
      this.router.navigate(['/checkout/confirmation'], { state: { orderId, total: this.total } });
    }, 900);
  }
}
