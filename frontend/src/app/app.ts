
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Header } from './header/header';
import { BodyComponent } from './body/body';
import {NgxPaginationModule} from 'ngx-pagination';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header , BodyComponent , NgxPaginationModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
}
