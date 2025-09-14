import { Component, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { LoginModalService } from '../login-modal/login-modal.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  identifier = '';
  otp = '';
  otpSent = false;
  otpMasked: string | null = null;
  // resend countdown state
  resendSeconds = 0;
  private _resendTimer: any = null;
  // user messages
  message: string | null = null;
  messageType: 'error' | 'success' | 'info' | null = null;
  // optional modal service injection allows login component to close the modal
  constructor(public auth: AuthService, private router: Router, @Optional() public modalSvc?: LoginModalService) {}

  onIdentifierChange(v: string) {
    // sanitize: allow only digits
    const cleaned = String(v || '').replace(/\D+/g, '');
    // limit length to 13 (enforce maximum)
    this.identifier = cleaned.slice(0, 13);
  }

  get phoneValid(): boolean {
    // enforce 10 to 13 digits per request
    return /^[0-9]{10,13}$/.test(this.identifier || '');
  }

  async sendOtp() {
    this.clearMessage();
    if (!this.identifier) return this.showMessage('Please enter phone number', 'error');
    const phone = /@/.test(this.identifier) ? null : this.identifier;
    if (!phone) return this.showMessage('Only phone-based OTP supported', 'error');
    if (this.resendSeconds > 0) return; // guard
    const r = await this.auth.sendOtp(phone);
    if (r && r.ok) {
      this.otpSent = true;
      this.otpMasked = r.masked;
      this.showMessage(`OTP sent to ${this.otpMasked}`, 'success');
      this.startResendCountdown(30); // disable resend for 30s
    } else if (r && r.error) {
      this.showMessage(`Failed to send OTP: ${r.error}`, 'error');
    } else {
      this.showMessage('Failed to send OTP (network)', 'error');
    }
  }

  async verifyOtp() {
    this.clearMessage();
    if (!this.identifier || !this.otp) return this.showMessage('Enter OTP to verify', 'error');
    const phone = /@/.test(this.identifier) ? null : this.identifier;
    if (!phone) return this.showMessage('Only phone-based OTP supported', 'error');
    const r = await this.auth.verifyOtp(phone, this.otp);
    if (r && r.ok) {
      this.showMessage('OTP verified — signing in...', 'success');
      let u = await this.auth.loginByPhone(phone as string);
      if (!u) u = await this.auth.register({ name: 'User', phone } as any);
      if (u) {
        console.log(`[LoginComponent] login success for ${u.phone || u.email || u.name}`);
      }
      // if running inside modal, close it; otherwise navigate home
      try {
        // optional injection of LoginModalService to support closing modal
        // tslint:disable-next-line: no-unused-expression
        (this as any).modalSvc;
      } catch (e) {}
      // navigate or close modal
      if ((this as any).modalSvc) {
        (this as any).modalSvc.close();
      } else if (u) {
        this.router.navigate(['/']);
      }
    } else if (r && r.error) {
      this.showMessage(`Verification failed: ${r.error}`, 'error');
    } else {
      this.showMessage('Verification failed (network)', 'error');
    }
  }

  private startResendCountdown(seconds: number) {
    this.resendSeconds = seconds;
    if (this._resendTimer) clearInterval(this._resendTimer);
    this._resendTimer = setInterval(() => {
      this.resendSeconds -= 1;
      if (this.resendSeconds <= 0) {
        clearInterval(this._resendTimer);
        this._resendTimer = null;
      }
    }, 1000);
  }

  private clearMessage() { this.message = null; this.messageType = null; }
  private showMessage(msg: string, type: 'error' | 'success' | 'info') { this.message = msg; this.messageType = type; }

  // password login removed; OTP-only flows supported
}
