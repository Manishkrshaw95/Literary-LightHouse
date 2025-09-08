import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar';
import { CategoryCardComponent } from '../category-card/category-card';
import { BooklistComponent } from '../booklist/booklist';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, SidebarComponent, CategoryCardComponent, BooklistComponent],
  templateUrl: './main-content.html',
  styleUrls: ['./main-content.scss']
})
export class MainContentComponent {
  books: any[] = [];
  loading: boolean = true;
  error: string = '';
  filteredBooks: any[] = [];
  selectedCategories: number[] = [0];

  constructor() {
    fetch('http://localhost:8080/booksData')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch books');
        return res.json();
      })
      .then(data => {
        this.books = data;
        this.filteredBooks = [...this.books];
        this.loading = false;
      })
      .catch(err => {
        this.error = err.message;
        this.loading = false;
      });
  }

  onCategorySelection(selectedIds: number[]) {
    this.selectedCategories = selectedIds || [];
    if (this.selectedCategories.length === 0 || this.selectedCategories.includes(0)) {
      this.filteredBooks = [...this.books];
      return;
    }
    this.filteredBooks = this.books.filter((b: any) => b.categories && b.categories.some((c: number) => this.selectedCategories.includes(c)));
  }

}
