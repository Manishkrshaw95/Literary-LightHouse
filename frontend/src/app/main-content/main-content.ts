import { Component, Inject, PLATFORM_ID, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SidebarComponent } from '../sidebar/sidebar';
import { SearchService } from '../search.service';
import { CategoryCardComponent } from '../category-card/category-card';
import { API_BASE } from '../api.config';
import { BooklistComponent } from '../booklist/booklist';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, SidebarComponent, CategoryCardComponent, BooklistComponent],
  templateUrl: './main-content.html',
  styleUrls: ['./main-content.scss']
})
export class MainContentComponent implements OnInit, OnDestroy {
  books: any[] = [];
  loading: boolean = true;
  error: string = '';
  filteredBooks: any[] = [];
  selectedCategories: number[] = [0];

  private _lastSearch = '';
  private _searchSub: Subscription | null = null;

  constructor(private search: SearchService, @Inject(PLATFORM_ID) private platformId: any) {
    if (isPlatformBrowser(this.platformId) && typeof fetch === 'function') {
      fetch(`${API_BASE}/booksData`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch books');
          return res.json();
        })
        .then(data => {
          // normalize categories to numbers and ensure array exists
          this.books = data.map((b: any) => ({
            ...b,
            categories: Array.isArray(b.categories) ? b.categories.map((c: any) => Number(c)) : []
          }));
          this.filteredBooks = [...this.books];
          // apply initial search if any
          if (this.search.term) this.applyFilters();
          this.loading = false;
        })
        .catch(err => {
          this.error = err.message;
          this.loading = false;
        });
    } else {
      // SSR/prerender: avoid fetch and initialize minimal state
      this.books = [];
      this.filteredBooks = [];
      this.loading = false;
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this._searchSub = this.search.term$.pipe(
        debounceTime(250),
        distinctUntilChanged()
      ).subscribe(term => {
        this._lastSearch = (term || '').trim();
        this.applyFilters();
      });
    }
  }

  ngOnDestroy() {
    if (this._searchSub) {
      this._searchSub.unsubscribe();
      this._searchSub = null;
    }
  }

  onCategorySelection(selectedIds: (number | string)[]) {
    // normalize incoming ids to numbers
    this.selectedCategories = (selectedIds || []).map(id => Number(id)).filter(id => !Number.isNaN(id));

    this.applyFilters();
  }

  private applyFilters() {
    const term = (this.search.term || '').toLowerCase();

    // start from all books
    let results = [...this.books];

    // category filter
    if (this.selectedCategories.length > 0 && !this.selectedCategories.includes(0)) {
      results = results.filter((b: any) => Array.isArray(b.categories) && b.categories.some((c: number) => this.selectedCategories.includes(c)));
    }

    // search filter (name or author)
    if (term) {
      results = results.filter((b: any) => {
        const name = String(b.name || '').toLowerCase();
        const author = String(b.author || '').toLowerCase();
        return name.includes(term) || author.includes(term);
      });
    }

    this.filteredBooks = results;
  }

}
