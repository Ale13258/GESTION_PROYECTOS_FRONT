import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly data = inject(DataService);

  readonly projects = this.data.projects;

  readonly overview = computed(() => {
    const equipment = this.data.equipment();
    const quotations = this.data.quotations();
    const projects = this.data.projects();
    const approved = equipment.filter((e) => e.status === 'Aprobado').length;
    const rejected = equipment.filter((e) => e.status === 'Rechazado').length;
    const pending = equipment.filter(
      (e) => e.status === 'Pendiente' || e.status === 'En evaluación' || e.status === 'Registrado',
    ).length;
    const total = equipment.length || 1;
    const totalQuoted = quotations.reduce((sum, q) => sum + q.amount, 0);
    const pendingQuotes = quotations.filter(
      (q) => q.status === 'Pendiente' || q.status === 'En revisión',
    ).length;

    return {
      activeProjects: projects.filter((p) => p.status === 'Activo').length,
      registered: equipment.length,
      suppliers: this.data.suppliers().length,
      pendingQuotes,
      approved,
      rejected,
      pending,
      totalQuoted,
      projectCount: projects.length,
      approvedPct: Math.round((approved / total) * 100),
      rejectedPct: Math.round((rejected / total) * 100),
    };
  });

  readonly cards = computed(() => {
    const o = this.overview();
    return [
      {
        label: 'Proyectos activos',
        value: String(o.activeProjects),
        icon: 'folder',
        tone: 'blue',
        badge: '+1 este mes',
        badgeTone: 'ok',
      },
      {
        label: 'Equipos registrados',
        value: String(o.registered),
        icon: 'inventory_2',
        tone: 'blue',
        badge: '+3 esta semana',
        badgeTone: 'ok',
      },
      {
        label: 'Proveedores',
        value: String(o.suppliers),
        icon: 'local_shipping',
        tone: 'green',
        badge: 'estable',
        badgeTone: 'ok',
      },
      {
        label: 'Cotizaciones pendientes',
        value: String(o.pendingQuotes),
        icon: 'description',
        tone: 'orange',
        badge: '-2 vs. semana ant.',
        badgeTone: 'bad',
      },
      {
        label: 'Equipos aprobados',
        value: String(o.approved),
        icon: 'check_circle',
        tone: 'green',
        badge: `${o.approvedPct}% del total`,
        badgeTone: 'ok',
      },
      {
        label: 'Equipos rechazados',
        value: String(o.rejected),
        icon: 'cancel',
        tone: 'red',
        badge: `${o.rejectedPct}% del total`,
        badgeTone: 'bad',
      },
      {
        label: 'Equipos pendientes',
        value: String(o.pending),
        icon: 'schedule',
        tone: 'orange',
        badge: 'requieren revisión',
        badgeTone: 'warn',
      },
      {
        label: 'Valor total cotizado',
        value: this.formatMoney(o.totalQuoted),
        icon: 'bar_chart',
        tone: 'blue',
        badge: `${o.projectCount} proyectos`,
        badgeTone: 'ok',
      },
    ];
  });

  readonly barData = computed(() =>
    this.projects().map((p, index) => ({
      name: p.name.replace('PTAR ', ''),
      value: p.progress,
      tone: index === 0 ? 'mid' : index === 1 ? 'light' : 'dark',
    })),
  );

  readonly equipmentState = computed(() => {
    const o = this.overview();
    const total = o.registered || 1;
    return {
      total: o.registered,
      slices: [
        { label: 'Aprobados', value: o.approved, color: '#22c55e' },
        { label: 'Pendientes', value: o.pending, color: '#f59e0b' },
        { label: 'Rechazados', value: o.rejected, color: '#ef4444' },
      ],
      approvedPct: (o.approved / total) * 100,
      pendingPct: (o.pending / total) * 100,
      rejectedPct: (o.rejected / total) * 100,
    };
  });

  donutGradient(): string {
    const state = this.equipmentState();
    const a = state.approvedPct * 3.6;
    const p = state.pendingPct * 3.6;
    const r = state.rejectedPct * 3.6;
    return `conic-gradient(#22c55e 0deg ${a}deg, #f59e0b ${a}deg ${a + p}deg, #ef4444 ${a + p}deg ${a + p + r}deg)`;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  equipmentCount(projectId: string): number {
    return this.data.getEquipmentByProject(projectId).length;
  }

  statusMeta(projectId: string, progress: number, status: string): { label: string; tone: string } {
    if (progress >= 100 || status === 'Cerrado') {
      return { label: 'Finalizado', tone: 'done' };
    }
    if (progress < 40) {
      return { label: 'En diseño', tone: 'design' };
    }
    return { label: 'En ejecución', tone: 'run' };
  }
}
