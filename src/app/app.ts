import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DataService } from './core/services/data.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  readonly projectsOpen = signal(true);

  readonly navItems = computed(() => {
    const items = [
      { path: '/inventario', icon: 'inventory_2', label: 'Inventario Técnico' },
      { path: '/proveedores', icon: 'local_shipping', label: 'Proveedores' },
      { path: '/matrices', icon: 'grid_view', label: 'Matrices Comparativas' },
      { path: '/cotizaciones', icon: 'description', label: 'Cotizaciones' },
      { path: '/aprobaciones', icon: 'assignment_turned_in', label: 'Solicitudes de Aprobación' },
      { path: '/reportes', icon: 'bar_chart', label: 'Reportes' },
    ];
    if (this.auth.canManageUsers()) {
      items.push({ path: '/usuarios', icon: 'group', label: 'Usuarios' });
    }
    items.push({ path: '/configuracion', icon: 'settings', label: 'Configuración' });
    return items;
  });

  toggleProjects(): void {
    this.projectsOpen.update((open) => !open);
  }

  onSearch(value: string): void {
    this.data.searchQuery.set(value);
  }
}
