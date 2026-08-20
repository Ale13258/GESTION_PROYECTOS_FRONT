import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_AUTH } from './api.service';
import { TokenStore } from './token.store';

let refreshInFlight$: Observable<{ accessToken: string; refreshToken: string }> | null = null;

function isPublicAuthUrl(url: string): boolean {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/health') ||
    url.includes('/files/stream')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStore);
  const router = inject(Router);

  const skip = req.context.get(SKIP_AUTH) || isPublicAuthUrl(req.url);
  const access = tokens.accessToken();
  const authReq =
    !skip && access ? req.clone({ setHeaders: { Authorization: `Bearer ${access}` } }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || skip) {
        return throwError(() => error);
      }
      return refreshAndRetry(authReq, next, tokens, router);
    }),
  );
};

function refreshAndRetry(
  req: Parameters<HttpInterceptorFn>[0],
  next: Parameters<HttpInterceptorFn>[1],
  tokens: TokenStore,
  router: Router,
) {
  const refreshToken = tokens.refreshToken();
  if (!refreshToken) {
    tokens.clear();
    void router.navigateByUrl('/login');
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'No refresh token' }));
  }

  if (!refreshInFlight$) {
    refreshInFlight$ = from(
      fetch(`${environment.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).then(async (response) => {
        if (!response.ok) {
          throw new HttpErrorResponse({ status: response.status, statusText: response.statusText });
        }
        return (await response.json()) as { accessToken: string; refreshToken: string };
      }),
    ).pipe(
      catchError((err) => {
        tokens.clear();
        void router.navigateByUrl('/login');
        return throwError(() => err);
      }),
      finalize(() => {
        refreshInFlight$ = null;
      }),
      shareReplay(1),
    );
  }

  return refreshInFlight$.pipe(
    switchMap((session) => {
      tokens.set(session.accessToken, session.refreshToken);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } }));
    }),
  );
}
