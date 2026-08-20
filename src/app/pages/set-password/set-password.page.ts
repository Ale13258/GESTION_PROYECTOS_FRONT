import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/api/http-error';
import { UiFeedbackService } from '../../shared/ui-feedback/ui-feedback.service';

@Component({
  selector: 'app-set-password-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './set-password.page.html',
  styleUrls: ['../login/login.page.scss', './set-password.page.scss'],
})
export class SetPasswordPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ui = inject(UiFeedbackService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly invitee = signal<{ name: string; email: string } | null>(null);
  readonly showPassword = signal(false);

  password = '';
  confirm = '';
  private token = '';

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.loading.set(false);
      this.error.set('Falta el enlace de invitación. Pídele uno nuevo al administrador.');
      return;
    }
    try {
      const preview = await this.auth.previewInvite(this.token);
      this.invitee.set({ name: preview.name, email: preview.email });
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'El enlace no es válido o ya venció.'));
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (this.password.trim().length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.saving.set(true);
    try {
      const result = await this.auth.setPasswordFromInvite(this.token, this.password);
      if (!result.ok) {
        this.error.set(result.message);
        this.ui.error(result.message);
        return;
      }
      this.ui.success('Contraseña creada. Ya puedes usar el sistema.');
      void this.router.navigateByUrl('/dashboard');
    } finally {
      this.saving.set(false);
    }
  }
}
