import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DataService } from './core/services/data.service';
import { AuthService } from './core/services/auth.service';
import { MaterialsService } from './core/services/materials.service';
import { UiFeedbackComponent } from './shared/ui-feedback/ui-feedback.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, UiFeedbackComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  readonly materials = inject(MaterialsService);
  private readonly router = inject(Router);
  readonly projectsOpen = signal(true);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        if (this.auth.hasOpsAccess()) {
          void this.data.reload();
        } else {
          this.data.reset();
        }
        if (this.auth.hasMaterialsQuotes()) {
          void this.materials.reload();
        } else {
          this.materials.reset();
        }
      } else {
        this.data.reset();
        this.materials.reset();
      }
    });
  }

  readonly searchPlaceholder = computed(() =>
    this.auth.isMaterialsTenant()
      ? 'Buscar proyectos, materiales, proveedores, documentos...'
      : 'Buscar proyectos, equipos, proveedores, cotizaciones...',
  );

  readonly navItems = computed(() => {
    const items: { path: string; icon: string; label: string }[] = [];
    const materialsOnly = this.auth.isMaterialsTenant();

    if (this.auth.hasOpsAccess()) {
      if (materialsOnly) {
        // Misma estructura operativa, pero inventario/cotizaciones = materiales (no equipos).
        items.push(
          { path: '/materiales', icon: 'inventory_2', label: 'Inventario' },
          { path: '/documentos', icon: 'folder_open', label: 'Documentos' },
          { path: '/proveedores', icon: 'local_shipping', label: 'Proveedores' },
          { path: '/materiales/cotizaciones', icon: 'request_quote', label: 'Cotizaciones' },
          { path: '/aprobaciones', icon: 'assignment_turned_in', label: 'Solicitudes de Aprobación' },
          { path: '/reportes', icon: 'bar_chart', label: 'Reportes' },
        );
      } else {
        items.push(
          { path: '/inventario', icon: 'precision_manufacturing', label: 'Inventario Técnico' },
          { path: '/documentos', icon: 'folder_open', label: 'Documentos' },
          { path: '/proveedores', icon: 'local_shipping', label: 'Proveedores' },
          { path: '/matrices', icon: 'grid_view', label: 'Matrices Comparativas' },
          { path: '/cotizaciones', icon: 'description', label: 'Cotizaciones' },
          { path: '/aprobaciones', icon: 'assignment_turned_in', label: 'Solicitudes de Aprobación' },
          { path: '/reportes', icon: 'bar_chart', label: 'Reportes' },
        );
        if (this.auth.hasMaterialsQuotes()) {
          items.push(
            { path: '/materiales', icon: 'inventory_2', label: 'Inventario materiales' },
            { path: '/materiales/cotizaciones', icon: 'request_quote', label: 'Cotiz. materiales' },
          );
        }
      }
    }

    if (this.auth.canManageUsers()) {
      items.push({ path: '/usuarios', icon: 'group', label: 'Usuarios' });
    }
    if (this.auth.isSuperAdmin()) {
      items.push({ path: '/empresas', icon: 'apartment', label: 'Empresas' });
    }
    items.push({ path: '/configuracion', icon: 'settings', label: 'Configuración' });
    return items;
  });

  toggleProjects(): void {
    this.projectsOpen.update((open) => !open);
  }

  onSearch(value: string): void {
    this.data.searchQuery.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.data.searchRemote(value);
    }, 350);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
