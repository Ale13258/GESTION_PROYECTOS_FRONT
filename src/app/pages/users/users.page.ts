import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NewUserForm } from '../../core/models/promanage.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-users-page',
  imports: [FormsModule],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
})
export class UsersPage {
  readonly auth = inject(AuthService);
  readonly showModal = signal(false);
  readonly error = signal('');

  form: NewUserForm = this.emptyForm();

  emptyForm(): NewUserForm {
    return {
      name: '',
      email: '',
      title: 'Ingeniero de Proyectos',
      password: '',
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

  async createUser(): Promise<void> {
    if (!this.auth.canManageUsers()) {
      this.error.set('No tienes permiso para crear usuarios.');
      return;
    }
    if (!this.form.name.trim() || !this.form.email.trim()) {
      this.error.set('Nombre y correo son obligatorios.');
      return;
    }
    if (!this.form.password.trim() || this.form.password.trim().length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const created = await this.auth.addCollaborator(this.form);
    if (!created) {
      this.error.set('No se pudo crear el usuario. Verifica que el correo no exista.');
      return;
    }
    this.closeModal();
  }

  async toggleActive(userId: string, active: boolean): Promise<void> {
    await this.auth.setUserActive(userId, active);
  }
}
