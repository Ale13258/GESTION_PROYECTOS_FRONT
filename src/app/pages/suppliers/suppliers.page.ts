import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { NewSupplierForm } from '../../core/models/promanage.models';

@Component({
  selector: 'app-suppliers-page',
  imports: [FormsModule],
  templateUrl: './suppliers.page.html',
  styleUrl: './suppliers.page.scss',
})
export class SuppliersPage {
  readonly data = inject(DataService);
  readonly showModal = signal(false);

  form: NewSupplierForm = this.emptyForm();

  emptyForm(): NewSupplierForm {
    return {
      name: '',
      categories: '',
      contactName: '',
      email: '',
      phone: '',
      country: 'Colombia',
      rating: 4.5,
    };
  }

  openModal(): void {
    this.form = this.emptyForm();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  async createSupplier(): Promise<void> {
    if (!this.form.name.trim()) return;
    await this.data.addSupplier(this.form);
    this.closeModal();
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  categoryLabel(categories: string[]): string {
    return categories.join(' / ');
  }

  equipmentCount(name: string): number {
    return this.data.equipmentCountBySupplier(name);
  }
}
