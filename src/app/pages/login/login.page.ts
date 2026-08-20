import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly loading = signal(false);
  readonly showPassword = signal(false);

  email = '';
  password = '';

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa correo y contraseña.');
      return;
    }

    this.loading.set(true);
    try {
      const result = await this.auth.login(this.email, this.password);
      if (!result.ok) {
        this.error.set(
          result.reason === 'inactive'
            ? 'Esta cuenta está inactiva. Contacta al administrador.'
            : result.reason === 'network'
              ? 'No se pudo conectar con el servidor. Verifica que la API esté en marcha.'
              : 'Correo o contraseña incorrectos.',
        );
        return;
      }
      void this.router.navigateByUrl('/dashboard');
    } finally {
      this.loading.set(false);
    }
  }
}
