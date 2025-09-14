
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryCardComponent } from '../category-card/category-card';
import { API_BASE } from '../api.config';
import { SidebarComponent } from '../sidebar/sidebar';
import { BookUploadComponent } from '../book-upload/book-upload';
import { BooklistComponent } from '../booklist/booklist';
import {NgxPaginationModule} from 'ngx-pagination';

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

  constructor() {
  fetch(`${API_BASE}/booksData`)
      .then(res => res.json())
      .then(data => {
        this.books = data;
      });
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
