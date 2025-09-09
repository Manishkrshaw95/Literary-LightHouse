import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CartService } from '../cart.service';
import { SearchService } from '../search.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
  constructor(public cart: CartService, private search: SearchService) {}

  onSearchInput(ev: Event) {
    const v = (ev.target as HTMLInputElement).value || '';
    this.search.setTerm(v.trim());
  }
}
