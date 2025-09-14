import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private STORAGE_KEY = 'll_theme';
  private _isDark = new BehaviorSubject<boolean>(false);
  isDark$ = this._isDark.asObservable();

  constructor() {
    const saved = this.safeGet(this.STORAGE_KEY);
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved === 'dark' ? true : saved === 'light' ? false : prefersDark;
    this.setDark(initial);
  }

  private safeGet(key: string): string | null {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  isDark(): boolean {
    return this._isDark.value;
  }

  setDark(value: boolean) {
    this._isDark.next(value);
    try {
      document.documentElement.setAttribute('data-theme', value ? 'dark' : 'light');
      localStorage.setItem(this.STORAGE_KEY, value ? 'dark' : 'light');
    } catch (e) {
      // ignore in SSR or restricted environments
    }
  }

  toggle() {
    this.setDark(!this.isDark());
  }
}
