import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NewTenantForm, TenantFeature, TenantInfo } from '../../core/models/promanage.models';
import { AuthService } from '../../core/services/auth.service';
import { TenantsService } from '../../core/services/tenants.service';
import { apiErrorMessage } from '../../core/api/http-error';
import { UiFeedbackService } from '../../shared/ui-feedback/ui-feedback.service';

@Component({
  selector: 'app-tenants-page',
  imports: [FormsModule],
  templateUrl: './tenants.page.html',
  styleUrl: './tenants.page.scss',
})
export class TenantsPage implements OnInit {
  readonly auth = inject(AuthService);
  readonly tenants = inject(TenantsService);
  private readonly ui = inject(UiFeedbackService);

  readonly showModal = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly lastInvite = signal<{ email: string; url: string; emailSent: boolean } | null>(null);

  form: NewTenantForm = this.emptyForm();
  featureMaterials = true;
  featurePromanage = false;

  ngOnInit(): void {
    void this.tenants.reload();
  }

  emptyForm(): NewTenantForm {
    return {
      name: '',
      slug: '',
      features: ['materials.quotes'],
      brandingName: '',
      brandingTagline: 'MATERIALES',
      adminName: '',
      adminEmail: '',
    };
  }

  openModal(): void {
    if (!this.auth.isSuperAdmin()) return;
    this.form = this.emptyForm();
    this.featureMaterials = true;
    this.featurePromanage = false;
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set('');
  }

  onNameChange(name: string): void {
    this.form.name = name;
    if (!this.form.slug || this.slugFrom(this.form.name) === this.form.slug) {
      this.form.slug = this.slugFrom(name);
    }
    if (!this.form.brandingName) {
      this.form.brandingName = name;
    }
  }

  slugFrom(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  featuresSelected(): TenantFeature[] {
    const features: TenantFeature[] = [];
    if (this.featurePromanage) features.push('promanage.full');
    if (this.featureMaterials) features.push('materials.quotes');
    return features;
  }

  async createTenant(): Promise<void> {
    if (this.busy()) return;
    if (!this.form.name.trim() || !this.form.slug.trim()) {
      this.error.set('Nombre y slug son obligatorios.');
      return;
    }
    const features = this.featuresSelected();
    if (!features.length) {
      this.error.set('Selecciona al menos un módulo (features).');
      return;
    }
    const adminEmail = this.form.adminEmail.trim();
    this.busy.set(true);
    this.error.set('');
    try {
      this.form.features = features;
      const result = await this.tenants.create(this.form);
      this.closeModal();
      this.ui.success(`Empresa “${result.tenant.name}” creada.`);
      if (result.inviteError) {
        this.ui.toast(
          `Empresa creada, pero el admin no se invitó: ${result.inviteError}`,
          'warning',
        );
      }
      // Siempre mostramos el enlace por si el correo no llega (spam, delay, etc.).
      if (result.inviteUrl && adminEmail) {
        const emailSent = Boolean(result.inviteEmailSent);
        this.lastInvite.set({ email: adminEmail, url: result.inviteUrl, emailSent });
        this.ui.toast(
          emailSent
            ? 'Correo de invitación enviado. Si no llega, usa el enlace de abajo.'
            : 'No hay SMTP configurado. Copia el enlace para que el admin cree su contraseña.',
          emailSent ? 'success' : 'warning',
        );
      }
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'No se pudo crear la empresa/tenant.'));
      void this.tenants.reload();
    } finally {
      this.busy.set(false);
    }
  }

  async copyInvite(): Promise<void> {
    const url = this.lastInvite()?.url;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    this.ui.success('Enlace copiado.');
  }

  async toggleActive(tenant: TenantInfo): Promise<void> {
    if (this.tenants.isDefault(tenant)) {
      this.ui.error('No se puede desactivar ProManage.');
      return;
    }
    const next = tenant.active === false;
    try {
      await this.tenants.setActive(tenant.id, next);
      this.ui.success(next ? 'Empresa activada.' : 'Empresa desactivada.');
    } catch (error) {
      this.ui.error(apiErrorMessage(error, 'No se pudo cambiar el estado.'));
    }
  }

  async deleteTenant(tenant: TenantInfo): Promise<void> {
    if (this.tenants.isDefault(tenant)) {
      this.ui.error('No se puede eliminar ProManage.');
      return;
    }
    const ok = window.confirm(
      `¿Eliminar la empresa “${tenant.name}” (${tenant.slug})?\nSe borrarán sus usuarios y datos. Esta acción no se puede deshacer.`,
    );
    if (!ok) return;
    try {
      await this.tenants.remove(tenant.id);
      this.ui.success('Empresa eliminada.');
    } catch (error) {
      this.ui.error(apiErrorMessage(error, 'No se pudo eliminar la empresa.'));
    }
  }
}
