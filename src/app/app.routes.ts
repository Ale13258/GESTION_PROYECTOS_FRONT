import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { ProjectsPage } from './pages/projects/projects.page';
import { ProjectDetailPage } from './pages/project-detail/project-detail.page';
import { InventoryPage } from './pages/inventory/inventory.page';
import { SuppliersPage } from './pages/suppliers/suppliers.page';
import { MatricesPage } from './pages/matrices/matrices.page';
import { QuotationsPage } from './pages/quotations/quotations.page';
import { ApprovalsPage } from './pages/approvals/approvals.page';
import { ReportsPage } from './pages/reports/reports.page';
import { SettingsPage } from './pages/settings/settings.page';
import { ComparatorPage } from './pages/comparator/comparator.page';
import { UsersPage } from './pages/users/users.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardPage },
  { path: 'proyectos', component: ProjectsPage },
  { path: 'proyectos/:id', component: ProjectDetailPage },
  { path: 'inventario', component: InventoryPage },
  { path: 'proveedores', component: SuppliersPage },
  { path: 'matrices', component: MatricesPage },
  { path: 'comparador', component: ComparatorPage },
  { path: 'cotizaciones', component: QuotationsPage },
  { path: 'aprobaciones', component: ApprovalsPage },
  { path: 'reportes', component: ReportsPage },
  { path: 'usuarios', component: UsersPage },
  { path: 'configuracion', component: SettingsPage },
  { path: '**', redirectTo: 'dashboard' },
];
