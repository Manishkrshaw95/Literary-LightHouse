
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryCardComponent } from '../category-card/category-card';
import { API_BASE } from '../api.config';
import { SidebarComponent } from '../sidebar/sidebar';
import { BookUploadComponent } from '../book-upload/book-upload';
import { BooklistComponent } from '../booklist/booklist';
import {NgxPaginationModule} from 'ngx-pagination';
import { BookService } from '../book.service';

@Component({
  selector: 'app-body',
  standalone: true,
  imports: [CommonModule, CategoryCardComponent, SidebarComponent, BookUploadComponent, BooklistComponent , NgxPaginationModule],
  templateUrl: './body.html',
  styleUrls: ['./body.scss'],
})
export class BodyComponent {
  showUpload = false;
  books: any[] = [];
  baseBooks: any[] = [];
  filteredBooks: any[] = [];
  page = 1;
  pageSize = 10;
  get totalPages() {
    return Math.ceil(this.books.length / this.pageSize);
  }
  get paginatedBooks() {
    const start = (this.page - 1) * this.pageSize;
    return this.books.slice(start, start + this.pageSize);
  }

  // track selected categories; 0 means "All"
  selectedCategories: number[] = [0];

  constructor(private bookSvc: BookService) {
    (async () => {
      try {
        // load cached books if available, else fetch and cache
  this.books = await this.bookSvc.loadBooks();
  this.baseBooks = [...this.books];
  this.filteredBooks = [...this.baseBooks];
      } catch (e) { this.books = []; }
    })();
  }

  setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
  }

  onUploadCardClick() {
    this.showUpload = true;
  }
  onCancelUpload() {
    this.showUpload = false;
  }

  // Receive selected category IDs from sidebar
  onCategorySelection(selectedIds: (number | string)[]) {
    this.selectedCategories = (selectedIds || []).map(id => Number(id)).filter(id => !Number.isNaN(id));
    // server-side fetch when filters change
    (async () => {
      try {
        if (this.selectedCategories.length === 0 || this.selectedCategories.includes(0)) {
          this.baseBooks = await this.bookSvc.loadBooks();
        } else {
          this.baseBooks = await this.bookSvc.fetchByCategories(this.selectedCategories);
        }
        this.filteredBooks = [...this.baseBooks];
        this.page = 1;
      } catch (e) {
        // fall back to client-side filtering if server call fails
        this.applyFilters();
      }
    })();
  }

  private applyFilters() {
    // start from all books
    let results = [...this.books];
    // category filter: if 'All' (0) not included, filter by categories intersection
    if (this.selectedCategories.length > 0 && !this.selectedCategories.includes(0)) {
      results = results.filter((b: any) => Array.isArray(b.categories) && b.categories.some((c: number) => this.selectedCategories.includes(Number(c))));
    }
    this.filteredBooks = results;
    // clamp page if needed when results shrink
    if (this.page > this.totalPages) this.page = Math.max(1, this.totalPages);
  }
}
