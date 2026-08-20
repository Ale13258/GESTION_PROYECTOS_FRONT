import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-projects-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './projects.page.html',
  styleUrl: './projects.page.scss',
})
export class ProjectsPage {
  private readonly data = inject(DataService);
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

  createProject(): void {
    if (!this.form.name.trim()) {
      return;
    }
    const created = this.data.addProject({
      name: this.form.name.trim(),
      client: this.form.client.trim() || 'Cliente por definir',
      location: this.form.location.trim() || 'Sin ubicación',
      engineer: this.form.engineer.trim() || 'Por asignar',
      startDate: new Date().toISOString().slice(0, 10),
      status: 'Activo',
      progress: 5,
      description: this.form.description.trim() || 'Nuevo proyecto de ingeniería.',
    });
    this.form = { name: '', client: '', location: '', engineer: '', description: '' };
    this.closeModal();
    void this.router.navigate(['/proyectos', created.id]);
  }
}
