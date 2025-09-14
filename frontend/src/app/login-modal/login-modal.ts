import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../login/login';
import { LoginModalService } from './login-modal.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, LoginComponent],
  template: `
    <div *ngIf="svc.visible()" class="modal-backdrop" role="dialog" aria-modal="true" (keydown)="onKey($event)">
      <div class="modal-panel" #panel tabindex="-1">
        <button class="modal-close" (click)="svc.close()">\u00d7</button>
        <!-- pass modal service into login component instance so it can close itself -->
        <app-login></app-login>
      </div>
    </div>
  `,
  styles: [
    `.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1200}`,
    `.modal-panel{background:var(--card-bg);padding:18px;border-radius:10px;min-width:320px;position:relative}`,
    `.modal-close{position:absolute;right:16px;top:12px;background:transparent;border:none;font-size:20px}`
  ]
})
export class LoginModal implements OnDestroy {
  @ViewChild('panel', { read: ElementRef }) panel!: ElementRef<HTMLElement>;
  private _lastFocused: Element | null = null;
  private _onFocus = (e: FocusEvent) => this.maintainFocus(e as any);

  // create the effect in the constructor so it's inside an injection context
  // the effect uses setTimeout so DOM access happens after ViewChild init
  constructor(public svc: LoginModalService) {
    effect(() => {
      const v = this.svc.visible();
      if (typeof document === 'undefined') return;
      if (v) {
        this._lastFocused = typeof document !== 'undefined' ? document.activeElement : null;
        setTimeout(() => {
          try {
            this.panel?.nativeElement?.focus();
            document.addEventListener('focusin', this._onFocus);
          } catch (e) {
            /* ignore DOM errors during SSR or timing races */
          }
        }, 0);
      } else {
        try { document.removeEventListener('focusin', this._onFocus); } catch (e) {}
        if (this._lastFocused instanceof HTMLElement) (this._lastFocused as HTMLElement).focus();
      }
    });
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') document.removeEventListener('focusin', this._onFocus);
  }

  onKey(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.svc.close();
    }
  }

  // Keep focus trapped inside panel when modal open
  private maintainFocus(ev: FocusEvent) {
    if (!this.svc.visible()) return;
    const panelEl = this.panel?.nativeElement;
    if (!panelEl) return;
    const target = ev.target as Node;
    if (!panelEl.contains(target)) {
      // move focus back to panel
      (panelEl as HTMLElement).focus();
    }
  }
}
