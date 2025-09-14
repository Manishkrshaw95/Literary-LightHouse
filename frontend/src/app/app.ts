
import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';

import { Header } from './header/header';
import { LoginModal } from './login-modal/login-modal';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, Header, LoginModal],
  providers: [],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
}
