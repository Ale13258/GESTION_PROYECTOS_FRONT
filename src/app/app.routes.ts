import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { featureAnyGuard, featureGuard } from './core/guards/feature.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { ProjectsPage } from './pages/projects/projects.page';
import { ProjectDetailPage } from './pages/project-detail/project-detail.page';
import { InventoryPage } from './pages/inventory/inventory.page';
import { DocumentsPage } from './pages/documents/documents.page';
import { SuppliersPage } from './pages/suppliers/suppliers.page';
import { MatricesPage } from './pages/matrices/matrices.page';
import { QuotationsPage } from './pages/quotations/quotations.page';
import { ApprovalsPage } from './pages/approvals/approvals.page';
import { ReportsPage } from './pages/reports/reports.page';
import { SettingsPage } from './pages/settings/settings.page';
import { ComparatorPage } from './pages/comparator/comparator.page';
import { UsersPage } from './pages/users/users.page';
import { LoginPage } from './pages/login/login.page';
import { SetPasswordPage } from './pages/set-password/set-password.page';
import { MaterialsPage } from './pages/materials/materials.page';
import { MaterialQuotesPage } from './pages/materials/material-quotes.page';
import { HomeRedirectPage } from './pages/home-redirect/home-redirect.page';
import { TenantsPage } from './pages/tenants/tenants.page';

/** Módulos comunes: proyectos, docs, presupuesto, proveedores, reportes… */
const sharedOpsGuard = featureAnyGuard('promanage.full', 'materials.quotes');

const sharedOpsRoutes: Routes = [
  { path: 'dashboard', component: DashboardPage, canActivate: [sharedOpsGuard] },
  { path: 'proyectos', component: ProjectsPage, canActivate: [sharedOpsGuard] },
  { path: 'proyectos/:id', component: ProjectDetailPage, canActivate: [sharedOpsGuard] },
  { path: 'documentos', component: DocumentsPage, canActivate: [sharedOpsGuard] },
  { path: 'aprobaciones', component: ApprovalsPage, canActivate: [sharedOpsGuard] },
  { path: 'reportes', component: ReportsPage, canActivate: [sharedOpsGuard] },
];

/** Solo ProManage: flujo de equipos de construcción / trabajo. */
const equipmentRoutes: Routes = [
  { path: 'inventario', component: InventoryPage, canActivate: [featureGuard('promanage.full')] },
  { path: 'matrices', component: MatricesPage, canActivate: [featureGuard('promanage.full')] },
  { path: 'comparador', component: ComparatorPage, canActivate: [featureGuard('promanage.full')] },
  { path: 'cotizaciones', component: QuotationsPage, canActivate: [featureGuard('promanage.full')] },
];

const sharedRoutes: Routes = [
  { path: 'proveedores', component: SuppliersPage },
  { path: 'usuarios', component: UsersPage },
  { path: 'empresas', component: TenantsPage, canActivate: [superAdminGuard] },
  { path: 'configuracion', component: SettingsPage },
];

/** Solo tenant de materiales: inventario y cotizaciones de materiales. */
const materialsRoutes: Routes = [
  {
    path: 'materiales',
    component: MaterialsPage,
    canActivate: [featureGuard('materials.quotes')],
  },
  {
    path: 'materiales/cotizaciones',
    component: MaterialQuotesPage,
    canActivate: [featureGuard('materials.quotes')],
  },
];

const appRoutes: Routes = [
  { path: '', pathMatch: 'full', component: HomeRedirectPage },
  ...sharedOpsRoutes,
  ...equipmentRoutes,
  ...sharedRoutes,
  ...materialsRoutes,
];

export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  { path: 'invitar', component: SetPasswordPage },
  {
    path: '',
    canActivate: [authGuard],
    children: [...appRoutes, { path: '**', component: HomeRedirectPage }],
  },
];
