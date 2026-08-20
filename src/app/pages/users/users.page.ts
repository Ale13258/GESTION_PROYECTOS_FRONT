import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppUser, NewUserForm } from '../../core/models/promanage.models';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/api/http-error';
import { UiFeedbackService } from '../../shared/ui-feedback/ui-feedback.service';

@Component({
  selector: 'app-users-page',
  imports: [FormsModule],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
})
export class UsersPage {
  readonly auth = inject(AuthService);
  private readonly ui = inject(UiFeedbackService);
  readonly showModal = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly lastInvite = signal<{ email: string; url: string } | null>(null);

  form: NewUserForm = this.emptyForm();

  emptyForm(): NewUserForm {
    return {
      name: '',
      email: '',
      title: 'Ingeniero de Proyectos',
      role: 'collaborator',
    };
  }

  openModal(): void {
    if (!this.auth.canManageUsers()) return;
    this.form = this.emptyForm();
    this.error.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set('');
  }

  statusLabel(user: AppUser): string {
    if (!user.active) return 'Inactivo';
    if (user.mustSetPassword) return 'Pendiente';
    return 'Activo';
  }

  async createUser(): Promise<void> {
    if (!this.auth.canManageUsers()) {
      this.error.set('No tienes permiso para crear usuarios.');
      return;
    }
    if (!this.form.name.trim() || !this.form.email.trim()) {
      this.error.set('Nombre y correo son obligatorios.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.auth.addCollaborator(this.form);
      if (!created) {
        this.error.set('No se pudo crear el usuario.');
        return;
      }
      if (created.inviteEmailSent) {
        this.ui.success(`Usuario creado. Se está enviando el correo a ${created.email}.`);
        this.lastInvite.set(null);
      } else if (created.inviteUrl) {
        this.lastInvite.set({ email: created.email, url: created.inviteUrl });
        this.ui.toast(
          'El usuario se creó, pero el correo no salió. Copia el enlace de invitación.',
          'warning',
        );
      } else {
        this.ui.success('Usuario creado. Pídele que revise su correo.');
      }
      this.closeModal();
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'No se pudo crear el usuario. Verifica que el correo no exista.'));
    } finally {
      this.busy.set(false);
    }
  }

  async resendInvite(user: AppUser): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.auth.resendInvite(user.id);
      if (result.inviteEmailSent) {
        this.ui.success(`Se reenvió la invitación a ${user.email}.`);
        this.lastInvite.set(null);
      } else if (result.inviteUrl) {
        this.lastInvite.set({ email: user.email, url: result.inviteUrl });
        this.ui.toast('No se pudo enviar el correo. Copia el enlace de invitación.', 'warning');
      }
    } catch (error) {
      this.ui.error(apiErrorMessage(error, 'No se pudo reenviar la invitación.'));
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

  async toggleActive(userId: string, active: boolean): Promise<void> {
    await this.auth.setUserActive(userId, active);
  }
}
