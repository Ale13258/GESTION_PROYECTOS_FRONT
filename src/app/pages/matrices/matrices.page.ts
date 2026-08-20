import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { Equipment } from '../../core/models/promanage.models';

type SpecKey =
  | 'caudal'
  | 'potencia'
  | 'voltaje'
  | 'rpm'
  | 'material'
  | 'garantia'
  | 'entregaDias'
  | 'precio'
  | 'cumplimiento';

interface CompareRow {
  key: SpecKey;
  label: string;
  higherIsBetter: boolean;
  format: (equipment: Equipment) => string | number;
  numeric: (equipment: Equipment) => number;
}

@Component({
  selector: 'app-matrices-page',
  imports: [FormsModule],
  templateUrl: './matrices.page.html',
  styleUrl: './matrices.page.scss',
})
export class MatricesPage {
  readonly data = inject(DataService);
  private readonly router = inject(Router);
  readonly filter = signal('');
  readonly matrixReady = signal(false);
  readonly generateError = signal('');

  readonly rows: CompareRow[] = [
    {
      key: 'caudal',
      label: 'Caudal',
      higherIsBetter: true,
      format: (e) => `${e.specs.caudal || '—'} L/s`,
      numeric: (e) => e.specs.caudal,
    },
    {
      key: 'potencia',
      label: 'Potencia',
      higherIsBetter: false,
      format: (e) => `${e.specs.potencia || '—'} kW`,
      numeric: (e) => e.specs.potencia,
    },
    {
      key: 'voltaje',
      label: 'Voltaje',
      higherIsBetter: true,
      format: (e) => `${e.specs.voltaje || '—'} V`,
      numeric: (e) => e.specs.voltaje,
    },
    {
      key: 'rpm',
      label: 'RPM',
      higherIsBetter: true,
      format: (e) => e.specs.rpm || '—',
      numeric: (e) => e.specs.rpm,
    },
    {
      key: 'material',
      label: 'Material',
      higherIsBetter: true,
      format: (e) => e.specs.material,
      numeric: (e) =>
        e.specs.material.toLowerCase().includes('inox') ||
        e.specs.material.toLowerCase().includes('duplex')
          ? 2
          : 1,
    },
    {
      key: 'garantia',
      label: 'Garantía',
      higherIsBetter: true,
      format: (e) => e.specs.garantia,
      numeric: (e) => parseInt(e.specs.garantia, 10) || 0,
    },
    {
      key: 'entregaDias',
      label: 'Tiempo de entrega',
      higherIsBetter: false,
      format: (e) => `${e.specs.entregaDias || '—'} días`,
      numeric: (e) => e.specs.entregaDias,
    },
    {
      key: 'precio',
      label: 'Precio',
      higherIsBetter: false,
      format: (e) => e.price,
      numeric: (e) => e.price,
    },
    {
      key: 'cumplimiento',
      label: 'Cumplimiento técnico',
      higherIsBetter: true,
      format: (e) => `${e.specs.cumplimiento || 0}%`,
      numeric: (e) => e.specs.cumplimiento,
    },
  ];

  readonly catalog = computed(() => {
    const q = this.filter().toLowerCase();
    return this.data.equipment().filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.proceso.toLowerCase().includes(q) ||
        e.manufacturer.toLowerCase().includes(q) ||
        e.supplier.toLowerCase().includes(q),
    );
  });

  readonly selected = computed(() => this.data.getSelectedEquipment());

  readonly recommendation = computed(() => {
    const list = this.selected();
    if (list.length < 2) {
      return 'Selecciona al menos 2 equipos del inventario para generar la matriz y la recomendación.';
    }
    const ranked = [...list].sort((a, b) => {
      const scoreA = a.specs.cumplimiento * 2 - a.specs.entregaDias + (100 - a.specs.potencia);
      const scoreB = b.specs.cumplimiento * 2 - b.specs.entregaDias + (100 - b.specs.potencia);
      return scoreB - scoreA;
    });
    const best = ranked[0];
    return `El sistema recomienda el ${best.name} porque presenta el mayor cumplimiento técnico, mejor eficiencia energética y menor tiempo de entrega.`;
  });

  toggle(id: string): void {
    this.data.toggleCompareEquipment(id);
    this.matrixReady.set(false);
  }

  isSelected(id: string): boolean {
    return this.data.selectedEquipmentIds().includes(id);
  }

  async generateMatrix(): Promise<void> {
    const selected = this.selected();
    if (selected.length < 2) return;
    this.matrixReady.set(true);
    const projectId = selected[0].projectId;
    await this.data.saveComparison(
      projectId,
      selected.map((e: Equipment) => e.id),
    );
  }

  clearSelection(): void {
    this.data.clearCompareSelection();
    this.matrixReady.set(false);
  }

  cellClass(row: CompareRow, equipment: Equipment): string {
    const list = this.selected();
    if (list.length < 2) return '';
    const values = list.map((item: Equipment) => row.numeric(item));
    const current = row.numeric(equipment);
    const best = row.higherIsBetter ? Math.max(...values) : Math.min(...values);
    const worst = row.higherIsBetter ? Math.min(...values) : Math.max(...values);
    if (current === best && best !== worst) return 'compare-best';
    if (current === worst && best !== worst) return 'compare-worst';
    return '';
  }

  displayValue(row: CompareRow, equipment: Equipment): string {
    const value = row.format(equipment);
    if (row.key === 'precio' && typeof value === 'number') {
      if (!value) return '—';
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(value);
    }
    return String(value);
  }

  projectName(projectId: string): string {
    return this.data.getProject(projectId)?.name ?? projectId;
  }

  async generateRequest(): Promise<void> {
    this.generateError.set('');
    const created = await this.data.addApprovalFromSelection();
    if (!created) {
      this.generateError.set(
        'Elige los equipos de la matriz para armar la solicitud de aprobación del proyecto.',
      );
      return;
    }
    await this.router.navigate(['/aprobaciones'], { queryParams: { solicitud: created.id } });
  }
}
