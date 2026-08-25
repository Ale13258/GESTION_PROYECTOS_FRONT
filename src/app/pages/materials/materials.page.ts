import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NewMaterialCategoryForm, NewMaterialForm } from '../../core/models/promanage.models';
import { MaterialsService } from '../../core/services/materials.service';
import { UiFeedbackService } from '../../shared/ui-feedback/ui-feedback.service';

@Component({
  selector: 'app-materials-page',
  imports: [FormsModule],
  templateUrl: './materials.page.html',
  styleUrl: './materials.page.scss',
})
export class MaterialsPage {
  readonly materials = inject(MaterialsService);
  private readonly ui = inject(UiFeedbackService);

  readonly showMaterialModal = signal(false);
  readonly showCategoryModal = signal(false);
  readonly categoryFilter = signal('');
  readonly search = signal('');

  form: NewMaterialForm = this.emptyForm();
  categoryForm: NewMaterialCategoryForm = { name: '', description: '' };

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    return this.materials.materials().filter((item) => {
      const matchCat = !cat || item.categoryId === cat || item.category === cat;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  });

  readonly stats = computed(() => {
    const items = this.materials.materials();
    const categories = this.materials.categories();
    const totalStock = items.reduce((sum, m) => sum + (m.stockQty || 0), 0);
    const lowStock = items.filter((m) => m.active && m.stockQty <= 0).length;
    return {
      materials: items.length,
      categories: categories.length,
      totalStock,
      lowStock,
    };
  });

  emptyForm(): NewMaterialForm {
    const first = this.materials.categories()[0];
    return {
      code: '',
      name: '',
      unit: 'und',
      category: first?.name || '',
      categoryId: first?.id || '',
      description: '',
      price: 0,
      stockQty: 0,
    };
  }

  openMaterialModal(): void {
    this.form = this.emptyForm();
    this.showMaterialModal.set(true);
  }

  closeMaterialModal(): void {
    this.showMaterialModal.set(false);
  }

  openCategoryModal(): void {
    this.categoryForm = { name: '', description: '' };
    this.showCategoryModal.set(true);
  }

  closeCategoryModal(): void {
    this.showCategoryModal.set(false);
  }

  onCategorySelect(categoryId: string): void {
    this.form.categoryId = categoryId;
    const cat = this.materials.categories().find((c) => c.id === categoryId);
    this.form.category = cat?.name || '';
  }

  async createCategory(): Promise<void> {
    if (!this.categoryForm.name.trim()) {
      this.ui.error('Indica el nombre de la categoría.');
      return;
    }
    try {
      const created = await this.materials.addCategory(this.categoryForm);
      this.ui.success('Categoría creada.');
      this.closeCategoryModal();
      if (created) {
        this.form.categoryId = created.id;
        this.form.category = created.name;
      }
    } catch {
      this.ui.error('No se pudo crear la categoría (¿nombre duplicado?).');
    }
  }

  async createMaterial(): Promise<void> {
    if (!this.form.name.trim()) {
      this.ui.error('Indica el nombre del material.');
      return;
    }
    if (!this.form.categoryId && !this.form.category.trim()) {
      this.ui.error('Selecciona o crea una categoría.');
      return;
    }
    try {
      await this.materials.addMaterial(this.form);
      this.ui.success('Material agregado al inventario.');
      this.closeMaterialModal();
    } catch {
      this.ui.error('No se pudo crear el material.');
    }
  }

  async adjustStock(id: string, delta: number): Promise<void> {
    const item = this.materials.getMaterial(id);
    if (!item) return;
    const next = Math.max(0, (item.stockQty || 0) + delta);
    try {
      await this.materials.updateStock(id, next);
    } catch {
      this.ui.error('No se pudo actualizar el stock.');
    }
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  formatQty(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value || 0);
  }
}
