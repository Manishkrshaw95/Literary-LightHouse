import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

// Functional guard (SSR safe) using DI inject()
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAdmin) return true;
  // Redirect non-admins to home; could also return UrlTree for better SSR handling
  return router.parseUrl('/');
};
