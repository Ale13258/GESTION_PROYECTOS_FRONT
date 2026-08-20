import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-projects-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './projects.page.html',
  styleUrl: './projects.page.scss',
})
export class ProjectsPage {
  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly projects = this.data.projects;
  readonly showModal = signal(false);

  form = {
    name: '',
    client: '',
    location: '',
    engineer: '',
    description: '',
  };

  openModal(): void {
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  async createProject(): Promise<void> {
    if (!this.form.name.trim()) {
      return;
    }
    const engineerId = this.auth.currentUser()?.id;
    if (!engineerId) return;
    const created = await this.data.addProject({
      name: this.form.name.trim(),
      client: this.form.client.trim() || 'Cliente por definir',
      location: this.form.location.trim() || 'Sin ubicación',
      engineer: this.form.engineer.trim() || this.auth.currentUser()?.name || 'Por asignar',
      engineerId,
      description: this.form.description.trim() || 'Nuevo proyecto de ingeniería.',
    });
    this.form = { name: '', client: '', location: '', engineer: '', description: '' };
    this.closeModal();
    void this.router.navigate(['/proyectos', created.id]);
  }
}
