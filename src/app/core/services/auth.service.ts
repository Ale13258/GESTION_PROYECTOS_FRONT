import { Injectable, computed, signal } from '@angular/core';
import {
  AppPermission,
  AppUser,
  NewUserForm,
  UserRole,
} from '../models/promanage.models';

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
  private readonly usersSignal = signal<AppUser[]>([
    {
      id: 'u-admin',
      name: 'Andrés Torres',
      email: 'andres.torres@promanage.co',
      role: 'admin',
      title: 'Administrador del sistema',
      active: true,
      createdAt: '2026-01-10',
      createdBy: 'Sistema',
    },
    {
      id: 'u2',
      name: 'Laura Restrepo',
      email: 'laura.restrepo@promanage.co',
      role: 'collaborator',
      title: 'Ingeniera de Proyectos',
      active: true,
      createdAt: '2026-02-01',
      createdBy: 'Andrés Torres',
    },
    {
      id: 'u3',
      name: 'Carlos Mejía',
      email: 'carlos.mejia@promanage.co',
      role: 'collaborator',
      title: 'Ingeniero de Compras',
      active: true,
      createdAt: '2026-02-18',
      createdBy: 'Andrés Torres',
    },
  ]);

  private readonly currentUserId = signal('u-admin');

  readonly users = this.usersSignal.asReadonly();

  readonly currentUser = computed(() => {
    const id = this.currentUserId();
    return this.usersSignal().find((u) => u.id === id) ?? this.usersSignal()[0];
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
    const user = this.currentUser();
    if (!user?.active) return false;
    return this.permissionsFor(user.role).includes(permission);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  setCurrentUser(userId: string): void {
    if (this.usersSignal().some((u) => u.id === userId)) {
      this.currentUserId.set(userId);
    }
  }

  addCollaborator(form: NewUserForm): AppUser | null {
    if (!this.canManageUsers()) return null;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name || !email) return null;
    if (this.usersSignal().some((u) => u.email === email)) return null;

    const created: AppUser = {
      id: `u${Date.now()}`,
      name,
      email,
      role: 'collaborator',
      title: form.title.trim() || 'Colaborador',
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
      createdBy: this.currentUser()?.name ?? 'Admin',
    };
    this.usersSignal.update((list) => [created, ...list]);
    return created;
  }

  setUserActive(userId: string, active: boolean): void {
    if (!this.canManageUsers()) return;
    if (userId === this.currentUser()?.id) return;
    this.usersSignal.update((list) =>
      list.map((u) => (u.id === userId && u.role !== 'admin' ? { ...u, active } : u)),
    );
  }
}
