import { Injectable, signal } from '@angular/core';

const ACCESS_KEY = 'promanage.accessToken';
const REFRESH_KEY = 'promanage.refreshToken';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly access = signal<string | null>(this.read(ACCESS_KEY));
  private readonly refresh = signal<string | null>(this.read(REFRESH_KEY));

  readonly accessToken = this.access.asReadonly();
  readonly refreshToken = this.refresh.asReadonly();

  set(accessToken: string, refreshToken: string): void {
    this.access.set(accessToken);
    this.refresh.set(refreshToken);
    this.write(ACCESS_KEY, accessToken);
    this.write(REFRESH_KEY, refreshToken);
  }

  clear(): void {
    this.access.set(null);
    this.refresh.set(null);
    this.remove(ACCESS_KEY);
    this.remove(REFRESH_KEY);
  }

  private read(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  private remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
