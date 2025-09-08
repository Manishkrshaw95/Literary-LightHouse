import { Routes } from '@angular/router';
import { MainContentComponent } from './main-content/main-content';
import { CartComponent } from './cart/cart';

export const routes: Routes = [
	{ path: '', component: MainContentComponent },
	{ path: 'cart', component: CartComponent },
	{ path: '**', redirectTo: '' }
];
