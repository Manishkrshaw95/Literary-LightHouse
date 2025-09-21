import { Component, Inject, PLATFORM_ID, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SidebarComponent } from '../sidebar/sidebar';
import { SearchService } from '../search.service';
import { CategoryCardComponent } from '../category-card/category-card';
import { API_BASE } from '../api.config';
import { BookService } from '../book.service';
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
  // baseBooks holds the current category-filtered (server-side) set
  baseBooks: any[] = [];
  // filteredBooks applies search on top of baseBooks
  filteredBooks: any[] = [];
  selectedCategories: number[] = [0];

  private _lastSearch = '';
  private _searchSub: Subscription | null = null;

  constructor(private search: SearchService, @Inject(PLATFORM_ID) private platformId: any, private bookSvc: BookService) {
    if (isPlatformBrowser(this.platformId) && typeof fetch === 'function') {
      (async () => {
        try {
          this.books = await this.bookSvc.loadBooks();
          this.baseBooks = [...this.books];
          // apply search (if any) on top of base
          this.applyFilters();
        } catch (e) {
          this.error = String(e);
        } finally {
          this.loading = false;
        }
      })();
    } else {
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
    // server-side fetch when filters change
    (async () => {
      this.loading = true; this.error = '';
      try {
        if (this.selectedCategories.length === 0 || this.selectedCategories.includes(0)) {
          // no filter -> use cached all-books
          this.baseBooks = await this.bookSvc.loadBooks();
        } else {
          this.baseBooks = await this.bookSvc.fetchByCategories(this.selectedCategories);
        }
        // always re-apply search on top of new base set
        this.applyFilters();
      } catch (e: any) {
        this.error = String(e?.message || e || 'Failed to load books');
      } finally {
        this.loading = false;
      }
    })();
  }

  private applyFilters() {
    const term = (this.search.term || '').toLowerCase();

  // start from category-filtered base set; search only narrows/widens this
  let results = [...(this.baseBooks && this.baseBooks.length ? this.baseBooks : this.books)];

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
