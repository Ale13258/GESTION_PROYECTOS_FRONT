import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Solo el super admin (Alejandra) puede entrar a Empresas/tenants. */
export const superAdminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ensureSession();
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  if (auth.isSuperAdmin()) return true;
  return router.createUrlTree([auth.homeRoute()]);
};
