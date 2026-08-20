import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export const SKIP_AUTH = new HttpContextToken(() => false);

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  url(path: string): string {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${suffix}`;
  }

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    skipAuth = false,
  ): Promise<T> {
    const context = skipAuth ? new HttpContext().set(SKIP_AUTH, true) : undefined;
    return firstValueFrom(this.http.get<T>(this.url(path), { params: this.toParams(params), context }));
  }

  post<T>(path: string, body: unknown = {}, skipAuth = false): Promise<T> {
    const context = skipAuth ? new HttpContext().set(SKIP_AUTH, true) : undefined;
    return firstValueFrom(this.http.post<T>(this.url(path), body, { context }));
  }

  patch<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.patch<T>(this.url(path), body));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.url(path)));
  }

  postForm<T>(path: string, form: FormData): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), form));
  }

  getBlob(path: string): Promise<Blob> {
    return firstValueFrom(this.http.get(this.url(path), { responseType: 'blob' }));
  }

  async listAll<T>(path: string, extra?: Record<string, string | number | boolean | undefined>): Promise<T[]> {
    const page = await this.get<Paginated<T>>(path, { page: 1, pageSize: 100, ...extra });
    return page.data ?? [];
  }

  private toParams(params?: Record<string, string | number | boolean | undefined>): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
