import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { mapMaterial, mapMaterialCategory, mapMaterialQuote, mapSupplier } from '../api/mappers';
import {
  Material,
  MaterialCategory,
  MaterialQuote,
  NewMaterialCategoryForm,
  NewMaterialForm,
  NewMaterialQuoteForm,
  Supplier,
} from '../models/promanage.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly materialsSignal = signal<Material[]>([]);
  private readonly categoriesSignal = signal<MaterialCategory[]>([]);
  private readonly quotesSignal = signal<MaterialQuote[]>([]);
  private readonly suppliersSignal = signal<Supplier[]>([]);
  private readonly loadingSignal = signal(false);

  readonly materials = this.materialsSignal.asReadonly();
  readonly categories = this.categoriesSignal.asReadonly();
  readonly quotes = this.quotesSignal.asReadonly();
  readonly suppliers = this.suppliersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  reset(): void {
    this.materialsSignal.set([]);
    this.categoriesSignal.set([]);
    this.quotesSignal.set([]);
    this.suppliersSignal.set([]);
  }

  async reload(): Promise<void> {
    if (!this.auth.hasFeature('materials.quotes')) {
      this.reset();
      return;
    }
    this.loadingSignal.set(true);
    try {
      const [materials, categories, quotes, suppliers] = await Promise.all([
        this.api.listAll<Parameters<typeof mapMaterial>[0]>('/materials').catch(() => []),
        this.api
          .get<Parameters<typeof mapMaterialCategory>[0][]>('/material-categories')
          .catch(() => []),
        this.api.listAll<Parameters<typeof mapMaterialQuote>[0]>('/material-quotes').catch(() => []),
        this.api.listAll<Parameters<typeof mapSupplier>[0]>('/suppliers').catch(() => []),
      ]);
      this.materialsSignal.set(materials.map(mapMaterial));
      this.categoriesSignal.set(
        (Array.isArray(categories) ? categories : []).map(mapMaterialCategory),
      );
      this.quotesSignal.set(quotes.map(mapMaterialQuote));
      this.suppliersSignal.set(suppliers.map(mapSupplier));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  getMaterial(id: string): Material | undefined {
    return this.materialsSignal().find((m) => m.id === id);
  }

  async addCategory(form: NewMaterialCategoryForm): Promise<MaterialCategory | null> {
    if (!form.name.trim()) return null;
    const created = await this.api.post<Parameters<typeof mapMaterialCategory>[0]>(
      '/material-categories',
      {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        active: true,
      },
    );
    const category = mapMaterialCategory(created);
    this.categoriesSignal.update((list) =>
      [...list, category].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );
    return category;
  }

  async addMaterial(form: NewMaterialForm): Promise<Material | null> {
    if (!form.name.trim()) return null;
    const created = await this.api.post<Parameters<typeof mapMaterial>[0]>('/materials', {
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.unit.trim() || 'und',
      categoryId: form.categoryId || undefined,
      category: form.category.trim() || 'General',
      description: form.description.trim() || undefined,
      price: Number(form.price) || 0,
      stockQty: Number(form.stockQty) || 0,
      active: true,
    });
    const material = mapMaterial(created);
    this.materialsSignal.update((list) => [material, ...list]);
    // Si el backend creó la categoría al vuelo, refrescar lista
    if (material.categoryId && !this.categoriesSignal().some((c) => c.id === material.categoryId)) {
      void this.reload();
    }
    return material;
  }

  async updateStock(id: string, stockQty: number): Promise<Material | null> {
    const updated = await this.api.patch<Parameters<typeof mapMaterial>[0]>(`/materials/${id}`, {
      stockQty: Number(stockQty) || 0,
    });
    const material = mapMaterial(updated);
    this.materialsSignal.update((list) => list.map((m) => (m.id === id ? material : m)));
    return material;
  }

  async addQuote(form: NewMaterialQuoteForm): Promise<MaterialQuote | null> {
    if (!form.materialId || !form.supplierId) return null;
    const created = await this.api.post<Parameters<typeof mapMaterialQuote>[0]>('/material-quotes', {
      materialId: form.materialId,
      supplierId: form.supplierId,
      unitPrice: Number(form.unitPrice) || 0,
      quantity: Number(form.quantity) || 0,
      unit: form.unit,
      deliveryDays: Number(form.deliveryDays) || 0,
      status: form.status,
      date: form.date,
      notes: form.notes.trim() || undefined,
    });
    const quote = mapMaterialQuote({
      ...created,
      materialName: form.materialName || created.materialName,
      materialCode: form.materialCode || created.materialCode,
      supplier: form.supplier || created.supplier,
      unit: form.unit || created.unit,
    });
    this.quotesSignal.update((list) => [quote, ...list]);
    return quote;
  }
}
