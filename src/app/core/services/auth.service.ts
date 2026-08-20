import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AppPermission,
  AppUser,
  NewUserForm,
  UserRole,
} from '../models/promanage.models';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../api/api.service';
import { apiErrorCode, apiErrorMessage } from '../api/http-error';
import { AuthUserDto, LoginResponse, mapUser } from '../api/mappers';
import { TokenStore } from '../api/token.store';

const ALL_PERMISSIONS: AppPermission[] = [
  'manageUsers',
  'manageProjects',
  'manageInventory',
  'manageSuppliers',
  'manageMatrices',
  'manageQuotations',
  'manageApprovals',
  'viewReports',
  'manageSettings',
];

const COLLABORATOR_PERMISSIONS: AppPermission[] = ALL_PERMISSIONS.filter(
  (p) => p !== 'manageUsers',
);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStore);

  private readonly usersSignal = signal<AppUser[]>([]);
  private readonly currentUserSignal = signal<AppUser | null>(null);
  private readonly permissionsSignal = signal<AppPermission[]>([]);
  private sessionPromise: Promise<boolean> | null = null;

  readonly users = this.usersSignal.asReadonly();
  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = computed(() => {
    const user = this.currentUserSignal();
    return !!user?.active;
  });

  readonly canManageUsers = computed(() => this.hasPermission('manageUsers'));

  roleLabel(role: UserRole): string {
    return role === 'admin' ? 'Administrador' : 'Colaborador';
  }

  permissionLabel(permission: AppPermission): string {
    const map: Record<AppPermission, string> = {
      manageUsers: 'Crear y gestionar usuarios',
      manageProjects: 'Proyectos',
      manageInventory: 'Inventario técnico',
      manageSuppliers: 'Proveedores',
      manageMatrices: 'Matrices comparativas',
      manageQuotations: 'Cotizaciones',
      manageApprovals: 'Solicitudes de aprobación',
      viewReports: 'Reportes',
      manageSettings: 'Configuración',
    };
    return map[permission];
  }

  permissionsFor(role: UserRole): AppPermission[] {
    return role === 'admin' ? [...ALL_PERMISSIONS] : [...COLLABORATOR_PERMISSIONS];
  }

  hasPermission(permission: AppPermission): boolean {
    const user = this.currentUserSignal();
    if (!user?.active) return false;
    const fromApi = this.permissionsSignal();
    if (fromApi.length) return fromApi.includes(permission);
    return this.permissionsFor(user.role).includes(permission);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  async ensureSession(): Promise<boolean> {
    if (this.currentUserSignal()) return true;
    if (!this.tokens.accessToken() && !this.tokens.refreshToken()) return false;
    if (!this.sessionPromise) {
      this.sessionPromise = this.restoreSession().finally(() => {
        this.sessionPromise = null;
      });
    }
    return this.sessionPromise;
  }

  async login(
    email: string,
    password: string,
  ): Promise<
    { ok: true } | { ok: false; reason: 'invalid' | 'inactive' | 'password_not_set' | 'network' | 'server'; message?: string }
  > {
    try {
      const session = await this.api.post<LoginResponse>(
        '/auth/login',
        { email: email.trim().toLowerCase(), password },
        true,
      );
      this.applySession(session);
      await this.refreshUsers().catch(() => undefined);
      return { ok: true };
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === 'USER_INACTIVE') return { ok: false, reason: 'inactive' };
      if (code === 'PASSWORD_NOT_SET') return { ok: false, reason: 'password_not_set' };
      if (code === 'INVALID_CREDENTIALS') return { ok: false, reason: 'invalid' };
      if (error instanceof HttpErrorResponse && error.status === 0) {
        return { ok: false, reason: 'network' };
      }
      return { ok: false, reason: 'server', message: apiErrorMessage(error) };
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens.refreshToken();
    try {
      await this.api.post('/auth/logout', { refreshToken });
    } catch {
      /* ignore */
    }
    this.tokens.clear();
    this.currentUserSignal.set(null);
    this.permissionsSignal.set([]);
    this.usersSignal.set([]);
  }

  async refreshUsers(): Promise<void> {
    const rows = await this.api.listAll<AuthUserDto>('/users');
    this.usersSignal.set(rows.map(mapUser));
  }

  async addCollaborator(form: NewUserForm): Promise<(AppUser & { inviteEmailSent?: boolean; inviteUrl?: string }) | null> {
    if (!this.canManageUsers()) return null;
    const created = await this.api.post<AuthUserDto>('/users', {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      title: form.title.trim() || undefined,
      role: form.role,
    });
    const user = mapUser(created);
    this.usersSignal.update((list) => [user, ...list]);
    return { ...user, inviteEmailSent: created.inviteEmailSent, inviteUrl: created.inviteUrl };
  }

  async resendInvite(userId: string): Promise<{ inviteEmailSent: boolean; inviteUrl?: string }> {
    const created = await this.api.post<AuthUserDto>(`/users/${userId}/invite`);
    this.usersSignal.update((list) =>
      list.map((u) => (u.id === userId ? { ...u, mustSetPassword: true } : u)),
    );
    return { inviteEmailSent: Boolean(created.inviteEmailSent), inviteUrl: created.inviteUrl };
  }

  async previewInvite(token: string): Promise<{ name: string; email: string; role: UserRole }> {
    return this.api.get('/auth/invite', { token }, true);
  }

  async setPasswordFromInvite(token: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const session = await this.api.post<LoginResponse>('/auth/set-password', { token, password }, true);
      this.applySession(session);
      await this.refreshUsers().catch(() => undefined);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: apiErrorMessage(error, 'No se pudo crear la contraseña.') };
    }
  }

  async setUserActive(userId: string, active: boolean): Promise<void> {
    if (!this.canManageUsers()) return;
    if (userId === this.currentUserSignal()?.id) return;
    await this.api.patch(`/users/${userId}/active`, { active });
    this.usersSignal.update((list) =>
      list.map((u) => (u.id === userId ? { ...u, active } : u)),
    );
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.api.post('/auth/change-password', { currentPassword, newPassword });
  }

  private async restoreSession(): Promise<boolean> {
    try {
      const me = await this.api.get<AuthUserDto>('/auth/me');
      this.setUser(me);
      await this.refreshUsers().catch(() => undefined);
      return true;
    } catch {
      this.tokens.clear();
      this.currentUserSignal.set(null);
      return false;
    }
  }

  private applySession(session: LoginResponse): void {
    this.tokens.set(session.accessToken, session.refreshToken);
    this.setUser(session.user);
  }

  private setUser(dto: AuthUserDto): void {
    this.currentUserSignal.set(mapUser(dto));
    this.permissionsSignal.set(dto.permissions?.length ? dto.permissions : this.permissionsFor(dto.role));
  }
}
