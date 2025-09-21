import { Injectable } from '@angular/core';

export interface ToastMessage { text: string; type?: 'info' | 'success' | 'error'; id?: number }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private container: HTMLElement | null = null;
  private idCounter = 1;

  private ensureContainer() {
    if (this.container) return;
    const c = document.createElement('div');
    c.className = 'll-toast-container';
    document.body.appendChild(c);
    this.container = c;
  }

  show(text: string, type: 'info'|'success'|'error' = 'info', timeout = 3000) {
    try {
      this.ensureContainer();
      const id = this.idCounter++;
      const el = document.createElement('div');
      el.className = `ll-toast ll-toast-${type}`;
      el.textContent = text;
      el.dataset['id'] = String(id);
      this.container!.appendChild(el);
      setTimeout(() => {
        el.classList.add('ll-toast-hide');
        setTimeout(() => el.remove(), 300);
      }, timeout);
      return id;
    } catch (e) { return null; }
  }
}
