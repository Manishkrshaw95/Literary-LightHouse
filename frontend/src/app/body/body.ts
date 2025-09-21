
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
  page = 1;
  pageSize = 10;
  get totalPages() {
    return Math.ceil(this.books.length / this.pageSize);
  }
  get paginatedBooks() {
    const start = (this.page - 1) * this.pageSize;
    return this.books.slice(start, start + this.pageSize);
  }

  constructor(private bookSvc: BookService) {
    (async () => {
      try {
        // load cached books if available, else fetch and cache
        this.books = await this.bookSvc.loadBooks();
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
}
