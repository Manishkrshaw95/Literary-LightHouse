import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxPaginationModule } from 'ngx-pagination';

@Component({
  selector: 'app-booklist',
  standalone: true,
  imports: [CommonModule, NgxPaginationModule],
  templateUrl: './booklist.html',
  styleUrls: ['./booklist.component.scss']
})
export class BooklistComponent {
  @Input() books: Array<any> = [];
  p: number = 1;
}
