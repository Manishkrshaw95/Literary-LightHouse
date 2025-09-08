import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent implements OnInit {
  categories: Array<{ id: number; name: string }> = [];
  loading: boolean = true;
  error: string = '';
  selectedCategoryIds: number[] = [0];
  @Output() selectionChange = new EventEmitter<number[]>();

  ngOnInit(): void {
    fetch('http://localhost:8080/categories')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
      })
      .then(data => {
        this.categories = [...data];
        this.loading = false;
      })
      .catch(err => {
        this.error = err.message;
        this.loading = false;
      });
  }

  toggleCategory(catId: number): void {
    if (catId === 0) {
      // If 'All' is selected, clear others and select only 'All'
      this.selectedCategoryIds = [0];
    } else {
      // Remove 'All' if another category is selected
      this.selectedCategoryIds = this.selectedCategoryIds.filter(id => id !== 0);
      if (this.selectedCategoryIds.includes(catId)) {
        this.selectedCategoryIds = this.selectedCategoryIds.filter(id => id !== catId);
      } else {
        this.selectedCategoryIds.push(catId);
      }
    }
  // emit updated selection
  this.selectionChange.emit([...this.selectedCategoryIds]);
  }

  isSelected(catId: number): boolean {
    return this.selectedCategoryIds.includes(catId);
  }
}
