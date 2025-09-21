import { Injectable, signal } from '@angular/core';
import { API_BASE } from './api.config';

export interface UserRecord {
  id?: number | string;
  name: string;
  email?: string;
  phone?: string;
  password?: string; // in real app never store plain password
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<UserRecord | null>(null);
  // expose the signal so components can subscribe/react to changes
  readonly userSignal = this._user;
  get currentUser() { return this._user(); }

  private setUser(u: UserRecord | null) {
    // mark admin if phone matches the admin phone
    if (u && (u as any).phone === '8793895938') {
      (u as any).isAdmin = true;
    }
    this._user.set(u);
    if (u) console.log(`[AuthService] login success for ${u.phone || u.email || u.name}`);
  }

  constructor() {
    // hydrate from localStorage if available (guard SSR)
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('ll_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          // use setUser so admin flag is applied
          this.setUser(parsed as any);
        }
      }
    } catch (e) {
      // ignore - SSR or parsing failure
    }
  }

  get isAdmin() {
    const u = this._user();
    return !!(u && (u as any).isAdmin);
  }

  async register(user: UserRecord) {
    // try to POST to json-server at localhost:3000/users
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user)
      });
      if (res.ok) {
        const saved = await res.json();
  this.setUser(saved);
  localStorage.setItem('ll_user', JSON.stringify(saved));
        return saved;
      }
    } catch (e) {
      // fallthrough to localStorage fallback
    }
    // local fallback: create id and save to localStorage
    const local = { ...user, id: 'local-' + Date.now() };
    const users = JSON.parse(localStorage.getItem('ll_users') || '[]');
    users.push(local);
    localStorage.setItem('ll_users', JSON.stringify(users));
    this.setUser(local);
    localStorage.setItem('ll_user', JSON.stringify(local));
    return local;
  }

  async login({ email, phone, password }: { email?: string; phone?: string; password?: string }) {
    // try to GET from json-server
    try {
      const q = email ? `email=${encodeURIComponent(email)}` : `phone=${encodeURIComponent(phone ?? '')}`;
  const res = await fetch(`${API_BASE}/users?${q}`);
      if (res.ok) {
        const arr = await res.json();
        const match = arr.find((u: any) => !password || u.password === password);
        if (match) {
          this.setUser(match);
          localStorage.setItem('ll_user', JSON.stringify(match));
          return match;
        }
      }
    } catch (e) {
      // ignore
    }
    // fallback to localStorage
    const users = JSON.parse(localStorage.getItem('ll_users') || '[]');
    const found = users.find((u: any) => (email && u.email === email) || (phone && u.phone === phone));
    if (found && (!password || found.password === password)) {
      this.setUser(found);
      localStorage.setItem('ll_user', JSON.stringify(found));
      return found;
    }
    return null;
  }

  // Find and set user by phone only (used after OTP verification)
  async loginByPhone(phone: string) {
    if (!phone) return null;
    try {
      const q = `phone=${encodeURIComponent(phone)}`;
      const res = await fetch(`${API_BASE}/users?${q}`);
      if (res.ok) {
        const arr = await res.json();
        const match = arr[0];
        if (match) {
            this.setUser(match);
            localStorage.setItem('ll_user', JSON.stringify(match));
            return match;
        }
      }
    } catch (e) {}
    const users = JSON.parse(localStorage.getItem('ll_users') || '[]');
    const found = users.find((u: any) => u.phone === phone);
    if (found) {
      this.setUser(found);
      localStorage.setItem('ll_user', JSON.stringify(found));
      return found;
    }
    return null;
  }

  logout() {
    this.setUser(null);
    localStorage.removeItem('ll_user');
  }

  // Dev-only OTP helpers. Calls local otp-server (default http://localhost:5001)
  async sendOtp(phone: string) {
    try {
      const base = (window as any).__OTP_SERVER_BASE__ || 'http://localhost:5001';
      const res = await fetch(base + '/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  async verifyOtp(phone: string, code: string) {
    try {
      const base = (window as any).__OTP_SERVER_BASE__ || 'http://localhost:5001';
      const res = await fetch(base + '/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  saveAddress(address: string) {
    const u = this._user();
    if (!u) return null;
    u.address = address;
    this._user.set({ ...u });
    // try to PATCH to json-server
    (async () => {
      try {
        if (u.id && String(u.id).startsWith('local-')) return; // don't attempt
  await fetch(`${API_BASE}/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
      } catch {}
    })();
    localStorage.setItem('ll_user', JSON.stringify(this._user()));
    return this._user();
  }
}
