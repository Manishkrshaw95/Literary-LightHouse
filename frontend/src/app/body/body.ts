
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryCardComponent } from '../category-card/category-card';
import { SidebarComponent } from '../sidebar/sidebar';
import { BookUploadComponent } from '../book-upload/book-upload';

@Component({
  selector: 'app-body',
  standalone: true,
  imports: [CommonModule, CategoryCardComponent, SidebarComponent, BookUploadComponent],
  templateUrl: './body.html',
  styleUrls: ['./body.scss'],
})
export class BodyComponent {
  showUpload = false;
  onUploadCardClick() {
    this.showUpload = true;
  }
  onCancelUpload() {
    this.showUpload = false;
  }
}
