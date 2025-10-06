import { Routes } from '@angular/router';
import { MainContentComponent } from './main-content/main-content';
import { CartComponent } from './cart/cart';
import { CheckoutComponent } from './checkout/checkout';
import { CheckoutConfirmationComponent } from './checkout/confirmation';
import { adminGuard } from './admin.guard';
// login component is standalone, will be lazy-loaded

export const routes: Routes = [
	{ path: '', component: MainContentComponent },
	{ path: 'cart', component: CartComponent },
	{ path: 'checkout', component: CheckoutComponent, children: [
		{ path: 'confirmation', component: CheckoutConfirmationComponent }
	] },
	{ path: 'login', loadComponent: () => import('./login/login').then(m => m.LoginComponent) },
	{ path: 'billing', canActivate: [adminGuard], loadComponent: () => import('./billing/billing').then(m => m.BillingComponent) },
	{ path: '**', redirectTo: '' }
];
