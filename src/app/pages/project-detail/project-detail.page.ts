import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import {
  Equipment,
  EquipmentFile,
  EquipmentFileCategory,
} from '../../core/models/promanage.models';

type TabId =
  | 'info'
  | 'documentos'
  | 'equipos'
  | 'proveedores'
  | 'matrices'
  | 'cotizaciones'
  | 'reportes'
  | 'dashboard';

@Component({
  selector: 'app-project-detail-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './project-detail.page.html',
  styleUrl: './project-detail.page.scss',
})
export class ProjectDetailPage {
  private readonly route = inject(ActivatedRoute);
  readonly data = inject(DataService);

  readonly activeTab = signal<TabId>('info');
  readonly selectedEquipment = signal<Equipment | null>(null);
  readonly docFolder = signal('Documentos');
  readonly dragOver = signal(false);
  readonly filterStatus = signal('');
  readonly filterText = signal('');
  readonly clientLogoName = signal('logo-cliente.png');
  readonly uploadCategory = signal<EquipmentFileCategory>('ficha');

  readonly fileCategories: { value: EquipmentFileCategory; label: string }[] = [
    { value: 'imagen', label: 'Imagen visual' },
    { value: 'ficha', label: 'Ficha técnica' },
    { value: 'plano', label: 'Plano' },
    { value: 'manual', label: 'Manual' },
    { value: 'cotizacion', label: 'Cotización' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly folders = [
    'Documentos',
    'Planos',
    'Fichas Técnicas',
    'Cotizaciones',
    'Solicitudes de Aprobación',
    'Fotografías',
  ];

  readonly tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Información General' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'equipos', label: 'Equipos' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'matrices', label: 'Matrices' },
    { id: 'cotizaciones', label: 'Cotizaciones' },
    { id: 'reportes', label: 'Reportes' },
    { id: 'dashboard', label: 'Dashboard del Proyecto' },
  ];

  readonly projectId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly project = computed(() => this.data.getProject(this.projectId()));

  readonly equipment = computed(() => {
    const list = this.data.getEquipmentByProject(this.projectId());
    const status = this.filterStatus();
    const text = this.filterText().toLowerCase();
    return list.filter((item) => {
      const matchStatus = !status || item.status === status;
      const matchText =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.manufacturer.toLowerCase().includes(text) ||
        item.supplier.toLowerCase().includes(text);
      return matchStatus && matchText;
    });
  });

  readonly documents = computed(() =>
    this.data.getDocumentsByProject(this.projectId(), this.docFolder()),
  );

  readonly quotations = computed(() => this.data.getQuotationsByProject(this.projectId()));

  readonly indicators = computed(() => this.data.projectIndicators(this.projectId()));

  readonly projectSuppliers = computed(() => {
    const names = new Set(this.data.getEquipmentByProject(this.projectId()).map((e) => e.supplier));
    return this.data.suppliers().filter((s) => names.has(s.name));
  });

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  openEquipment(item: Equipment): void {
    this.selectedEquipment.set(item);
  }

  closeEquipment(): void {
    this.selectedEquipment.set(null);
  }

  fileIcon(category: EquipmentFileCategory): string {
    switch (category) {
      case 'imagen':
        return 'image';
      case 'plano':
        return 'architecture';
      case 'manual':
        return 'menu_book';
      case 'cotizacion':
        return 'request_quote';
      case 'ficha':
        return 'description';
      default:
        return 'attach_file';
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async onEquipmentFiles(event: Event): Promise<void> {
    const current = this.selectedEquipment();
    const input = event.target as HTMLInputElement;
    if (!current || !input.files?.length) return;

    const category = this.uploadCategory();
    const typeLabel =
      this.fileCategories.find((c) => c.value === category)?.label ?? 'Archivo';

    const uploaded = await Promise.all(
      Array.from(input.files).map(
        (file) =>
          new Promise<EquipmentFile>((resolve) => {
            const isImage = file.type.startsWith('image/') || category === 'imagen';
            const base: EquipmentFile = {
              id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              category: isImage ? 'imagen' : category,
              typeLabel: isImage ? 'Imagen visual' : typeLabel,
              size: this.formatSize(file.size),
              mimeType: file.type || 'application/octet-stream',
            };
            if (isImage) {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ ...base, previewUrl: String(reader.result) });
              reader.readAsDataURL(file);
            } else {
              resolve(base);
            }
          }),
      ),
    );

    const updated = this.data.addEquipmentFiles(current.id, uploaded);
    this.selectedEquipment.set(updated ?? this.data.getEquipmentById(current.id) ?? null);
    input.value = '';
  }

  toggleCompare(id: string, event: Event): void {
    event.stopPropagation();
    this.data.toggleCompareEquipment(id);
  }

  isSelected(id: string): boolean {
    return this.data.selectedEquipmentIds().includes(id);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files?.length) {
      return;
    }
    Array.from(files).forEach((file) => {
      this.data.addDocument({
        projectId: this.projectId(),
        folder: this.docFolder(),
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    });
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }
    Array.from(files).forEach((file) => {
      this.data.addDocument({
        projectId: this.projectId(),
        folder: this.docFolder(),
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    });
    input.value = '';
  }

  statusClass(status: string): string {
    if (status === 'Aprobado' || status === 'Aprobada') return 'badge-success';
    if (status === 'Rechazado' || status === 'Rechazada') return 'badge-danger';
    if (status === 'Pendiente' || status === 'En evaluación') return 'badge-warning';
    return 'badge-info';
  }

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.clientLogoName.set(file.name);
    }
  }

  exportDocument(format: 'pdf' | 'word'): void {
    const project = this.project();
    if (!project) return;
    const selected = this.data.getSelectedEquipment();
    const equipment = selected[0] ?? this.data.getEquipmentByProject(project.id)[0];
    const content = `
SOLICITUD DE APROBACIÓN DE EQUIPOS
Proyecto: ${project.name}
Cliente: ${project.client}
Ubicación: ${project.location}
Ingeniero: ${project.engineer}
Logo cliente: ${this.clientLogoName()}

Equipo propuesto: ${equipment?.name ?? 'N/D'}
Modelo: ${equipment?.model ?? 'N/D'}
Fabricante: ${equipment?.manufacturer ?? 'N/D'}
Proveedor: ${equipment?.supplier ?? 'N/D'}
Precio: ${equipment?.price ?? 0}
Cumplimiento técnico: ${equipment?.specs.cumplimiento ?? 0}%

Generado automáticamente por ProManage Engineering
Formato: ${format.toUpperCase()}
Fecha: ${new Date().toLocaleString('es-CO')}
`;
    const blob = new Blob([content], {
      type: format === 'pdf' ? 'application/pdf' : 'application/msword',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAE_${project.name.replace(/\s+/g, '_')}.${format === 'pdf' ? 'txt' : 'doc'}`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
