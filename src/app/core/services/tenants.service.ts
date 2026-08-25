import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { apiErrorMessage } from '../api/http-error';
import { NewTenantForm, TenantFeature, TenantInfo } from '../models/promanage.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TenantsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly tenantsSignal = signal<TenantInfo[]>([]);
  private readonly loadingSignal = signal(false);

  readonly tenants = this.tenantsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  async reload(): Promise<void> {
    if (!this.auth.isSuperAdmin()) {
      this.tenantsSignal.set([]);
      return;
    }
    this.loadingSignal.set(true);
    try {
      const rows = await this.api.get<TenantInfo[]>('/tenants');
      this.tenantsSignal.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.tenantsSignal.set([]);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async create(form: NewTenantForm): Promise<{
    tenant: TenantInfo;
    inviteUrl?: string;
    inviteEmailSent?: boolean;
    inviteError?: string;
  }> {
    const features: TenantFeature[] = form.features.length
      ? form.features
      : ['materials.quotes'];
    const tenant = await this.api.post<TenantInfo>('/tenants', {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      features,
      branding: {
        name: form.brandingName.trim() || form.name.trim(),
        tagline: form.brandingTagline.trim() || undefined,
      },
    });

    let inviteUrl: string | undefined;
    let inviteEmailSent: boolean | undefined;
    let inviteError: string | undefined;
    if (form.adminEmail.trim() && form.adminName.trim()) {
      try {
        const created = await this.auth.addCollaborator({
          name: form.adminName.trim(),
          email: form.adminEmail.trim(),
          title: 'Administrador',
          role: 'admin',
          tenantId: tenant.id,
        });
        inviteUrl = created?.inviteUrl;
        inviteEmailSent = created?.inviteEmailSent;
        if (!created) {
          inviteError = 'No se pudo invitar al administrador.';
        }
      } catch (error) {
        inviteError = apiErrorMessage(error, 'No se pudo invitar al administrador.');
      }
    }

    this.tenantsSignal.update((list) => {
      if (list.some((t) => t.id === tenant.id)) return list;
      return [...list, tenant];
    });
    void this.reload();
    return { tenant, inviteUrl, inviteEmailSent, inviteError };
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const updated = await this.api.patch<TenantInfo>(`/tenants/${id}/active`, { active });
    this.tenantsSignal.update((list) =>
      list.map((t) => (t.id === id ? { ...t, active: updated.active } : t)),
    );
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/tenants/${id}`);
    this.tenantsSignal.update((list) => list.filter((t) => t.id !== id));
  }

  featureLabel(feature: TenantFeature): string {
    if (feature === 'promanage.full') return 'Equipos de trabajo';
    if (feature === 'materials.quotes') return 'Materiales de construcción';
    return feature;
  }

  isDefault(tenant: TenantInfo): boolean {
    return tenant.slug === 'promanage' || tenant.id === '00000000-0000-4000-8000-000000000001';
  }
}
