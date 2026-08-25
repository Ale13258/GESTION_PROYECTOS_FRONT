import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialQuote, NewMaterialQuoteForm } from '../../core/models/promanage.models';
import { MaterialsService } from '../../core/services/materials.service';
import { UiFeedbackService } from '../../shared/ui-feedback/ui-feedback.service';

interface MaterialQuoteGroup {
  materialId: string;
  materialName: string;
  materialCode: string;
  unit: string;
  offers: MaterialQuote[];
  finalOffer?: MaterialQuote;
  minAmount: number;
  maxAmount: number;
}

@Component({
  selector: 'app-material-quotes-page',
  imports: [FormsModule],
  templateUrl: './material-quotes.page.html',
  styleUrl: './material-quotes.page.scss',
})
export class MaterialQuotesPage {
  readonly materials = inject(MaterialsService);
  private readonly ui = inject(UiFeedbackService);

  readonly showModal = signal(false);
  form: NewMaterialQuoteForm = this.emptyForm();

  readonly groups = computed<MaterialQuoteGroup[]>(() => {
    const map = new Map<string, MaterialQuote[]>();
    for (const quote of this.materials.quotes()) {
      const key = quote.materialId || quote.materialName;
      const list = map.get(key) ?? [];
      list.push(quote);
      map.set(key, list);
    }
    return [...map.entries()].map(([, offers]) => {
      const amounts = offers.map((o) => o.amount);
      const sample = offers[0];
      return {
        materialId: sample.materialId,
        materialName: sample.materialName,
        materialCode: sample.materialCode,
        unit: sample.unit,
        offers: [...offers].sort((a, b) => a.amount - b.amount),
        finalOffer: offers.find((o) => o.isFinal || o.status === 'Aprobada'),
        minAmount: Math.min(...amounts),
        maxAmount: Math.max(...amounts),
      };
    });
  });

  readonly stats = computed(() => {
    const quotes = this.materials.quotes();
    const materialsCount = new Set(quotes.map((q) => q.materialId || q.materialName)).size;
    const approved = quotes.filter((q) => q.isFinal || q.status === 'Aprobada');
    const approvedValue = approved.reduce((sum, q) => sum + q.amount, 0);
    return {
      materialsCount,
      received: quotes.length,
      approvedValue,
      pending: quotes.filter((q) => q.status === 'Pendiente' || q.status === 'En revisión').length,
    };
  });

  emptyForm(): NewMaterialQuoteForm {
    const first = this.materials.materials()[0];
    return {
      materialId: first?.id ?? '',
      materialName: first?.name ?? '',
      materialCode: first?.code ?? '',
      supplierId: '',
      supplier: '',
      unitPrice: 0,
      quantity: 1,
      unit: first?.unit ?? 'und',
      deliveryDays: 15,
      status: 'En revisión',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    };
  }

  openModal(): void {
    this.form = this.emptyForm();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  onMaterialChange(materialId: string): void {
    const material = this.materials.getMaterial(materialId);
    this.form.materialId = materialId;
    this.form.materialName = material?.name ?? '';
    this.form.materialCode = material?.code ?? '';
    this.form.unit = material?.unit ?? 'und';
  }

  onSupplierChange(supplierId: string): void {
    const supplier = this.materials.suppliers().find((s) => s.id === supplierId);
    this.form.supplierId = supplierId;
    this.form.supplier = supplier?.name ?? '';
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  async createQuote(): Promise<void> {
    if (!this.form.materialId || !this.form.supplierId) {
      this.ui.error('Selecciona material y proveedor.');
      return;
    }
    try {
      await this.materials.addQuote(this.form);
      this.ui.success('Cotización registrada.');
      this.closeModal();
    } catch {
      this.ui.error(
        'No se pudo crear la cotización. Verifica que la API exponga POST /material-quotes.',
      );
    }
  }
}
