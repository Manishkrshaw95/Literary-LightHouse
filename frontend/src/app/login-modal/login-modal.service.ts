import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoginModalService {
  visible = signal(false);
  open() { this.visible.set(true); }
  close() { this.visible.set(false); }
}
