import { Component } from '@angular/core';
import { CategoryCardComponent } from '../category-card/category-card';

@Component({
  selector: 'app-body',
  standalone: true,
  imports: [CategoryCardComponent],
  templateUrl: './body.html',
  styleUrls: ['./body.scss']
})
export class BodyComponent {}
