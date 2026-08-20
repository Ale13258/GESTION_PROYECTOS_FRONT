import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../core/api/http-error';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  readonly auth = inject(AuthService);
  private readonly data = inject(DataService);

  theme = 'light';
  language = 'es';
  currency = 'COP';
  currentPassword = '';
  newPassword = '';
  readonly message = signal('');
  readonly error = signal('');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const settings = await this.data.loadSettings();
      this.theme = settings.theme || 'light';
      this.language = settings.language || 'es';
      this.currency = settings.currency || 'COP';
    } catch {
      /* defaults */
    }
  }

  async savePreferences(): Promise<void> {
    this.error.set('');
    this.message.set('');
    try {
      await this.data.saveSettings({
        theme: this.theme,
        language: this.language,
        currency: this.currency,
      });
      this.message.set('Preferencias guardadas.');
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    }
  }

  async savePassword(): Promise<void> {
    this.error.set('');
    this.message.set('');
    if (this.newPassword.trim().length < 6) {
      this.error.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    try {
      await this.auth.changePassword(this.currentPassword, this.newPassword);
      this.currentPassword = '';
      this.newPassword = '';
      this.message.set('Contraseña actualizada.');
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'No se pudo cambiar la contraseña.'));
    }
  }
}
