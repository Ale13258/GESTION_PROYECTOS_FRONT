import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantFeature } from '../models/promanage.models';
import { AuthService } from '../services/auth.service';

/** Requiere que el tenant tenga la feature indicada. */
export function featureGuard(feature: TenantFeature): CanActivateFn {
  return featureAnyGuard(feature);
}

/** Requiere al menos una de las features indicadas. */
export function featureAnyGuard(...features: TenantFeature[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ensureSession();
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    if (features.some((f) => auth.hasFeature(f))) return true;
    return router.createUrlTree([auth.homeRoute()]);
  };
}
