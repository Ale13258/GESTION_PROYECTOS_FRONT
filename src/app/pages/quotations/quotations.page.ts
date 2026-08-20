import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { NewQuotationForm, Quotation } from '../../core/models/promanage.models';

interface QuoteGroup {
  equipmentName: string;
  projectId: string;
  projectName: string;
  offers: Quotation[];
  finalOffer?: Quotation;
  minAmount: number;
  maxAmount: number;
}

@Component({
  selector: 'app-quotations-page',
  imports: [FormsModule],
  templateUrl: './quotations.page.html',
  styleUrl: './quotations.page.scss',
})
export class QuotationsPage {
  readonly data = inject(DataService);
  readonly showModal = signal(false);

  form: NewQuotationForm = this.emptyForm();
  selectedEquipmentId = '';

  readonly equipmentOptions = computed(() =>
    [...this.data.equipment()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
  );

  readonly groups = computed<QuoteGroup[]>(() => {
    const map = new Map<string, Quotation[]>();
    for (const quote of this.data.quotations()) {
      const key = `${quote.projectId}::${quote.equipmentName}`;
      const list = map.get(key) ?? [];
      list.push(quote);
      map.set(key, list);
    }

    return [...map.entries()].map(([, offers]) => {
      const amounts = offers.map((o) => o.amount);
      const sample = offers[0];
      return {
        equipmentName: sample.equipmentName,
        projectId: sample.projectId,
        projectName: this.data.getProject(sample.projectId)?.name ?? sample.projectId,
        offers: [...offers].sort((a, b) => a.amount - b.amount),
        finalOffer: offers.find((o) => o.isFinal || o.status === 'Aprobada'),
        minAmount: Math.min(...amounts),
        maxAmount: Math.max(...amounts),
      };
    });
  });

  readonly stats = computed(() => {
    const quotes = this.data.quotations();
    const equipmentCount = new Set(quotes.map((q) => q.equipmentName)).size;
    const finalQuotes = quotes.filter((q) => q.isFinal || q.status === 'Aprobada');
    const finalValue = finalQuotes.reduce((sum, q) => sum + q.amount, 0);
    const avgOffered =
      quotes.length > 0 ? quotes.reduce((sum, q) => sum + q.amount, 0) / quotes.length : 0;
    const avgFinal =
      finalQuotes.length > 0 ? finalValue / finalQuotes.length : 0;
    const savings = Math.max(0, avgOffered - avgFinal) * Math.max(finalQuotes.length, 1);

    return {
      equipmentCount,
      received: quotes.length,
      finalValue,
      savings,
    };
  });

  emptyForm(): NewQuotationForm {
    return {
      projectId: this.data.projects()[0]?.id ?? '',
      equipmentId: '',
      equipmentName: '',
      supplierId: '',
      supplier: '',
      amount: 0,
      deliveryDays: 30,
      status: 'En revisión',
      date: new Date().toISOString().slice(0, 10),
    };
  }

  openModal(): void {
    this.form = this.emptyForm();
    this.selectedEquipmentId = '';
    this.form.supplierId = '';
    this.form.supplier = '';
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  onEquipmentChange(equipmentId: string): void {
    this.selectedEquipmentId = equipmentId;
    const equipment = this.data.equipment().find((item) => item.id === equipmentId);
    if (!equipment) {
      this.form.equipmentName = '';
      return;
    }
    this.form.equipmentName = equipment.name;
    this.form.projectId = equipment.projectId;
    this.form.equipmentId = equipment.id;
  }

  projectName(projectId: string): string {
    return this.data.getProject(projectId)?.name ?? projectId;
  }

  onSupplierChange(supplierId: string): void {
    this.form.supplierId = supplierId;
    this.form.supplier = this.data.suppliers().find((s) => s.id === supplierId)?.name ?? '';
  }

  async createQuotation(): Promise<void> {
    if (!this.form.equipmentId || !this.form.supplierId || !this.form.projectId) {
      return;
    }
    await this.data.addQuotation(this.form);
    this.closeModal();
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  statusClass(status: string): string {
    if (status === 'Aprobada') return 'st-ok';
    if (status === 'Rechazada') return 'st-bad';
    return 'st-warn';
  }

  statusLabel(status: string): string {
    if (status === 'Aprobada') return '✓ Aprobada';
    if (status === 'Rechazada') return '× Rechazada';
    if (status === 'En revisión') return '◔ En revisión';
    return `◔ ${status}`;
  }

  valueClass(amount: number, group: QuoteGroup): string {
    if (group.offers.length < 2) return '';
    if (amount === group.minAmount) return 'val-best';
    if (amount === group.maxAmount) return 'val-worst';
    return '';
  }
}
