import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import {
  Equipment,
  EquipmentFile,
  EquipmentFileCategory,
  NewEquipmentForm,
} from '../../core/models/promanage.models';

@Component({
  selector: 'app-inventory-page',
  imports: [FormsModule],
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.scss',
})
export class InventoryPage {
  readonly data = inject(DataService);
  private readonly router = inject(Router);

  readonly filterText = signal('');
  readonly filterProject = signal('');
  readonly filterCategory = signal('');
  readonly filterStatus = signal('');
  readonly selected = signal<Equipment | null>(null);
  readonly showModal = signal(false);
  readonly noteDraft = signal('');
  readonly uploadCategory = signal<EquipmentFileCategory>('ficha');
  readonly formUploadCategory = signal<EquipmentFileCategory>('imagen');

  readonly processOptions = [
    '1. Entrada / Canal de aproximación',
    '2. Cribado fino',
    '3. Filtro percolador (tratamiento biológico)',
    '4. Bombeo de lodos',
    '5. Aireación',
    '6. Clarificación secundaria',
    'Otro',
  ];

  readonly fileCategories: { value: EquipmentFileCategory; label: string }[] = [
    { value: 'imagen', label: 'Imagen visual' },
    { value: 'ficha', label: 'Ficha técnica' },
    { value: 'plano', label: 'Plano' },
    { value: 'manual', label: 'Manual' },
    { value: 'cotizacion', label: 'Cotización' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly statusOptions = ['Registrado', 'En evaluación', 'Pendiente', 'Aprobado', 'Rechazado'];

  form: NewEquipmentForm = this.emptyForm();

  readonly categories = computed(() => {
    const set = new Set(this.data.equipment().map((e) => e.category).filter(Boolean));
    return [...set].sort();
  });

  readonly processFilterOptions = computed(() => {
    const set = new Set(this.data.equipment().map((e) => e.proceso).filter(Boolean));
    return [...set].sort();
  });

  readonly list = computed(() => {
    const q = (this.filterText() || this.data.searchQuery()).toLowerCase();
    const projectId = this.filterProject();
    const proceso = this.filterCategory();
    const status = this.filterStatus();

    return this.data.equipment().filter((e) => {
      const matchProject = !projectId || e.projectId === projectId;
      const matchProcess = !proceso || e.proceso === proceso || e.category === proceso;
      const matchStatus = !status || e.status === status;
      const matchText =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.proceso.toLowerCase().includes(q) ||
        e.especificacionesTecnicas.toLowerCase().includes(q) ||
        e.dimensionesCapacidad.toLowerCase().includes(q) ||
        e.specs.material.toLowerCase().includes(q) ||
        e.fuenteManual.toLowerCase().includes(q) ||
        e.nota.toLowerCase().includes(q);
      return matchProject && matchProcess && matchStatus && matchText;
    });
  });

  emptyForm(): NewEquipmentForm {
    return {
      projectId: this.data.projects()[0]?.id ?? '',
      proceso: this.processOptions[0],
      name: '',
      cantidad: '1',
      especificacionesTecnicas: '',
      dimensionesCapacidad: '',
      material: '',
      fuenteManual: '',
      nota: '',
      files: [],
      imagePreview: undefined,
    };
  }

  openModal(): void {
    this.form = this.emptyForm();
    this.formUploadCategory.set('imagen');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  createEquipment(): void {
    if (!this.form.name.trim() || !this.form.projectId) return;
    const created = this.data.addEquipment(this.form);
    this.closeModal();
    this.openDetail(created);
  }

  openDetail(item: Equipment): void {
    this.selected.set(item);
    this.noteDraft.set(item.nota);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  saveNote(): void {
    const current = this.selected();
    if (!current) return;
    this.data.updateEquipmentNote(current.id, this.noteDraft());
    this.selected.set(this.data.getEquipmentById(current.id) ?? null);
  }

  statusClass(status: string): string {
    if (status === 'Aprobado') return 'st-ok';
    if (status === 'Rechazado') return 'st-bad';
    if (status === 'Pendiente' || status === 'En evaluación') return 'st-warn';
    return 'st-info';
  }

  statusLabel(status: string): string {
    return status;
  }

  projectName(projectId: string): string {
    return this.data.getProject(projectId)?.name ?? projectId;
  }

  formatPrice(value: number): string {
    if (!value) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private typeLabel(category: EquipmentFileCategory): string {
    return this.fileCategories.find((c) => c.value === category)?.label ?? 'Archivo';
  }

  private async readFiles(
    fileList: FileList,
    category: EquipmentFileCategory,
  ): Promise<EquipmentFile[]> {
    const files = Array.from(fileList);
    return Promise.all(
      files.map(
        (file) =>
          new Promise<EquipmentFile>((resolve) => {
            const isImage = file.type.startsWith('image/') || category === 'imagen';
            const base: EquipmentFile = {
              id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              category: isImage ? 'imagen' : category,
              typeLabel: this.typeLabel(isImage ? 'imagen' : category),
              size: this.formatSize(file.size),
              mimeType: file.type || 'application/octet-stream',
            };
            if (isImage) {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  ...base,
                  category: 'imagen',
                  typeLabel: 'Imagen visual',
                  previewUrl: String(reader.result),
                });
              reader.readAsDataURL(file);
            } else {
              resolve(base);
            }
          }),
      ),
    );
  }

  async onFormFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const uploaded = await this.readFiles(input.files, this.formUploadCategory());
    this.form.files = [...uploaded, ...this.form.files];
    const image = uploaded.find((f) => f.previewUrl);
    if (image?.previewUrl) this.form.imagePreview = image.previewUrl;
    input.value = '';
  }

  removeFormFile(id: string): void {
    const removed = this.form.files.find((f) => f.id === id);
    this.form.files = this.form.files.filter((f) => f.id !== id);
    if (removed?.previewUrl && this.form.imagePreview === removed.previewUrl) {
      this.form.imagePreview = this.form.files.find((f) => f.previewUrl)?.previewUrl;
    }
  }

  async onDetailFiles(event: Event): Promise<void> {
    const current = this.selected();
    const input = event.target as HTMLInputElement;
    if (!current || !input.files?.length) return;
    const uploaded = await this.readFiles(input.files, this.uploadCategory());
    const updated = this.data.addEquipmentFiles(current.id, uploaded);
    this.selected.set(updated ?? this.data.getEquipmentById(current.id) ?? null);
    input.value = '';
  }

  generateApproval(): void {
    const current = this.selected();
    if (!current) return;
    this.data.clearCompareSelection();
    this.data.toggleCompareEquipment(current.id);
    this.data.addApprovalFromSelection();
    void this.router.navigate(['/aprobaciones']);
  }
}
