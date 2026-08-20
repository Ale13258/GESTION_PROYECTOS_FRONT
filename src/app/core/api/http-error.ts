import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; details?: unknown } | string | null;
    if (typeof body === 'string' && body.trim()) return body;
    if (body && typeof body === 'object' && body.message) {
      const details = Array.isArray(body.details) ? body.details.filter(Boolean).join('. ') : '';
      return details ? `${body.message}. ${details}` : body.message;
    }
    if (error.status === 0) return 'No hay conexión con el servidor.';
    if (error.status === 401) return 'Sesión expirada o credenciales inválidas.';
    if (error.status === 403) return 'No tienes permiso para esta acción.';
  }
  return fallback;
}

export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = error.error as { code?: string } | null;
  return body?.code ?? null;
}
