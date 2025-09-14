import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { API_BASE } from '../api.config';

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
  fetch(`${API_BASE}/categories`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch categories');
        return res.json();
      })
      .then(data => {
        // ensure category ids are numeric
        this.categories = data.map((c: any) => ({ ...c, id: Number(c.id) }));
        this.loading = false;
        // emit initial selection so parent can initialize filtering
        this.selectionChange.emit([...this.selectedCategoryIds]);
      })
      .catch(err => {
        this.error = err.message;
        this.loading = false;
      });
  }

  toggleCategory(catId: number | string): void {
    const id = Number(catId);
    if (Number.isNaN(id)) return;

    if (id === 0) {
      // If 'All' is selected, clear others and select only 'All'
      this.selectedCategoryIds = [0];
    } else {
      // Remove 'All' if another category is selected
      this.selectedCategoryIds = this.selectedCategoryIds.filter(i => i !== 0);

      if (this.selectedCategoryIds.includes(id)) {
        this.selectedCategoryIds = this.selectedCategoryIds.filter(i => i !== id);
      } else {
        this.selectedCategoryIds.push(id);
      }
    }

    // emit updated selection
    this.selectionChange.emit([...this.selectedCategoryIds]);
  }

  isSelected(catId: number | string): boolean {
    const id = Number(catId);
    if (Number.isNaN(id)) return false;
    return this.selectedCategoryIds.includes(id);
  }
}
