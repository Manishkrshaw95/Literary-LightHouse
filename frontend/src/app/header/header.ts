import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../cart.service';
import { SearchService } from '../search.service';
import { ThemeService } from '../theme.service';
import { LoginModalService } from '../login-modal/login-modal.service';
import { AuthService } from '../auth.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
  constructor(public cart: CartService, private search: SearchService, private theme: ThemeService, public modal: LoginModalService, public auth: AuthService) {}

  // Template-friendly getter to avoid direct signal calls in the template type-checker
  get currentUser() {
    try { return this.auth?.userSignal ? this.auth.userSignal() : null; } catch { return null; }
  }

  onSearchInput(ev: Event) {
    const v = (ev.target as HTMLInputElement).value || '';
    this.search.setTerm(v.trim());
  }

  isDark() {
    return this.theme.isDark();
  }

  toggleTheme() {
    this.theme.toggle();
  }
}
