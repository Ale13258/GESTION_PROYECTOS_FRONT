import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { parseBudgetWorkbook, ParsedBudget } from '../../core/budget/parse-budget';
import { projectDocumentStoragePath } from '../../core/firebase/storage-paths';
import { AuthService } from '../../core/services/auth.service';
import { DataService, FilePreview } from '../../core/services/data.service';
import { UiFeedbackService } from '../../shared/ui-feedback/ui-feedback.service';
import { CadPreviewComponent } from '../../shared/cad-preview/cad-preview.component';
import { SpreadsheetPreviewComponent } from '../../shared/spreadsheet-preview/spreadsheet-preview.component';
import {
  DocumentItem,
  Equipment,
  EquipmentFile,
  EquipmentFileCategory,
} from '../../core/models/promanage.models';

type TabId =
  | 'info'
  | 'documentos'
  | 'equipos'
  | 'presupuesto'
  | 'proveedores'
  | 'matrices'
  | 'cotizaciones'
  | 'reportes'
  | 'dashboard';

@Component({
  selector: 'app-project-detail-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, CadPreviewComponent, SpreadsheetPreviewComponent],
  templateUrl: './project-detail.page.html',
  styleUrl: './project-detail.page.scss',
})
export class ProjectDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ui = inject(UiFeedbackService);

  readonly preview = signal<(FilePreview & { safeUrl: SafeResourceUrl }) | null>(null);
  readonly previewLoading = signal(false);
  readonly parsedBudget = signal<ParsedBudget | null>(null);
  readonly budgetDocument = signal<DocumentItem | null>(null);
  readonly budgetLoading = signal(false);
  readonly budgetError = signal('');

  readonly activeTab = signal<TabId>('info');
  readonly selectedEquipment = signal<Equipment | null>(null);
  readonly specSaving = signal(false);
  readonly specSaved = signal(false);
  specDraft = {
    caudal: '',
    potencia: '',
    voltaje: '',
    rpm: '',
    material: '',
    garantia: '',
  };
  readonly docFolder = signal('Documentos');
  readonly dragOver = signal(false);
  readonly docUploading = signal(false);
  readonly docError = signal('');
  readonly generateError = signal('');
  readonly filterStatus = signal('');
  readonly filterText = signal('');
  readonly clientLogoName = signal('logo-cliente.png');
  readonly uploadCategory = signal<EquipmentFileCategory>('ficha');

  readonly fileCategories: { value: EquipmentFileCategory; label: string }[] = [
    { value: 'imagen', label: 'Imagen visual' },
    { value: 'ficha', label: 'Ficha técnica' },
    { value: 'plano', label: 'Plano' },
    { value: 'manual', label: 'Manual' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly folders = [
    'Documentos',
    'Planos',
    'Fichas Técnicas',
    'Cotizaciones',
    'Presupuestos',
    'Solicitudes de Aprobación',
    'Fotografías',
    'Logo cliente',
    'Reportes',
  ];

  readonly allTabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Información General' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'equipos', label: 'Equipos' },
    { id: 'presupuesto', label: 'Presupuesto' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'matrices', label: 'Matrices' },
    { id: 'cotizaciones', label: 'Cotizaciones' },
    { id: 'reportes', label: 'Reportes' },
    { id: 'dashboard', label: 'Dashboard del Proyecto' },
  ];

  /** En tenant de materiales no se muestran pestañas de equipos de construcción. */
  readonly tabs = computed(() => {
    if (!this.auth.isMaterialsTenant()) return this.allTabs;
    const keep: TabId[] = ['info', 'documentos', 'presupuesto', 'proveedores', 'reportes', 'dashboard'];
    return this.allTabs.filter((t) => keep.includes(t.id));
  });

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

  readonly projectEquipment = computed(() => this.data.getEquipmentByProject(this.projectId()));

  readonly indicators = computed(() => this.data.projectIndicators(this.projectId()));

  readonly projectSuppliers = computed(() => {
    const names = new Set(this.data.getEquipmentByProject(this.projectId()).map((e) => e.supplier));
    return this.data.suppliers().filter((s) => names.has(s.name));
  });

  readonly clientLogo = computed((): DocumentItem | undefined =>
    this.data.getDocumentsByProject(this.projectId(), 'Logo cliente')[0],
  );

  readonly firebaseFolderPath = computed(() =>
    projectDocumentStoragePath(
      this.projectId() || '…',
      this.docFolder(),
      this.project()?.name,
      this.auth.tenant()?.id,
    ),
  );

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
    if (tab === 'presupuesto') {
      void this.loadProjectBudget();
    }
  }

  private budgetDocuments(): DocumentItem[] {
    return this.data.getDocumentsByProject(this.projectId()).filter(
      (doc) =>
        doc.folder === 'Presupuestos' ||
        (doc.folder === 'Cotizaciones' &&
          (/\.(xlsx|xls|csv)$/i.test(doc.name) || /presupuesto|propuesta/i.test(doc.name))),
    );
  }

  private latestBudgetDocument(): DocumentItem | undefined {
    return this.budgetDocuments().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
  }

  async removeBudgetDocument(): Promise<void> {
    this.budgetLoading.set(true);
    this.budgetError.set('');
    try {
      await this.deleteBudgetFiles();
      this.budgetDocument.set(null);
      this.parsedBudget.set(null);
    } catch {
      this.budgetError.set('No se pudo quitar el documento de presupuesto.');
    } finally {
      this.budgetLoading.set(false);
    }
  }

  private async deleteBudgetFiles(): Promise<void> {
    const docs = this.budgetDocuments();
    await Promise.all(docs.map((doc) => this.data.removeDocument(doc.id)));
  }

  async loadProjectBudget(): Promise<void> {
    this.budgetLoading.set(true);
    this.budgetError.set('');
    try {
      await this.hydrateProjectEquipment();
      const doc = this.latestBudgetDocument();
      this.budgetDocument.set(doc ?? null);
      if (!doc) {
        this.parsedBudget.set(null);
        return;
      }
      if (!/\.(xlsx|xls)$/i.test(doc.name)) {
        this.parsedBudget.set(null);
        return;
      }
      const blob = await this.data.documentBlob(doc.id);
      const parsed = parseBudgetWorkbook(
        await blob.arrayBuffer(),
        doc.name,
        this.data.getEquipmentByProject(this.projectId()),
      );
      this.parsedBudget.set(parsed);
    } catch {
      this.budgetError.set('No se pudo leer el Excel de presupuesto.');
      this.parsedBudget.set(null);
    } finally {
      this.budgetLoading.set(false);
    }
  }

  async uploadProjectBudget(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.budgetLoading.set(true);
    this.budgetError.set('');
    try {
      await this.deleteBudgetFiles();
      await this.data.addDocumentFile(this.projectId(), 'Presupuestos', file);
      if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
        const parsed = parseBudgetWorkbook(
          await file.arrayBuffer(),
          file.name,
          this.data.getEquipmentByProject(this.projectId()),
        );
        this.parsedBudget.set(parsed);
        this.budgetDocument.set(this.latestBudgetDocument() ?? null);
      } else {
        await this.loadProjectBudget();
      }
    } catch (error) {
      this.budgetError.set(error instanceof Error ? error.message : 'No se pudo subir el presupuesto.');
    } finally {
      this.budgetLoading.set(false);
      input.value = '';
    }
  }

  async viewBudgetDocument(): Promise<void> {
    const doc = this.budgetDocument();
    if (!doc) return;
    await this.viewDocument(doc);
  }

  openRelatedEquipment(id: string): void {
    const item = this.data.getEquipmentById(id);
    if (item) void this.openEquipment(item);
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private async hydrateProjectEquipment(): Promise<void> {
    const list = this.data.getEquipmentByProject(this.projectId());
    await Promise.all(list.map((item) => this.data.refreshEquipment(item.id)));
  }

  budgetFiles(item: Equipment): EquipmentFile[] {
    return item.files.filter((file) => file.category === 'cotizacion');
  }

  technicalFiles(item: Equipment): EquipmentFile[] {
    return item.files.filter((file) => file.category !== 'cotizacion');
  }

  async uploadBudget(item: Equipment, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const uploaded = Array.from(input.files).map((file) => ({
      id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      category: 'cotizacion' as const,
      typeLabel: 'Presupuesto',
      size: this.formatSize(file.size),
      mimeType: file.type || 'application/octet-stream',
      nativeFile: file,
    }));
    await this.data.addEquipmentFiles(item.id, uploaded);
    await this.data.refreshEquipment(item.id);
    input.value = '';
  }

  async viewBudgetFile(item: Equipment, file: EquipmentFile, event?: Event): Promise<void> {
    this.selectedEquipment.set(item);
    await this.viewEquipmentFile(file, event);
  }

  async openEquipment(item: Equipment): Promise<void> {
    const hydrated = await this.data.refreshEquipment(item.id);
    const current = hydrated ?? item;
    this.selectedEquipment.set(current);
    this.fillSpecDraft(current);
  }

  closeEquipment(): void {
    this.selectedEquipment.set(null);
  }

  async saveSpecs(): Promise<void> {
    const current = this.selectedEquipment();
    if (!current) return;
    this.specSaving.set(true);
    this.specSaved.set(false);
    try {
      const updated = await this.data.updateEquipmentSpecs(current.id, {
        caudal: this.specDraft.caudal.trim() || undefined,
        potencia: this.toOptionalNumber(this.specDraft.potencia),
        voltaje: this.specDraft.voltaje.trim() || undefined,
        rpm: this.toOptionalNumber(this.specDraft.rpm),
        material: this.specDraft.material.trim() || undefined,
        garantia: this.specDraft.garantia.trim() || undefined,
      });
      this.selectedEquipment.set(updated);
      this.fillSpecDraft(updated);
      this.specSaved.set(true);
    } finally {
      this.specSaving.set(false);
    }
  }

  private fillSpecDraft(item: Equipment): void {
    this.specDraft = {
      caudal: item.specs.caudal ? String(item.specs.caudal) : '',
      potencia: item.specs.potencia ? String(item.specs.potencia) : '',
      voltaje: item.specs.voltaje ? String(item.specs.voltaje) : '',
      rpm: item.specs.rpm ? String(item.specs.rpm) : '',
      material: item.specs.material ?? '',
      garantia: item.specs.garantia ?? '',
    };
    this.specSaved.set(false);
  }

  private toOptionalNumber(value: string): number | undefined {
    const n = Number(value);
    return value.trim() && Number.isFinite(n) ? n : undefined;
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
              nativeFile: file,
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

    const updated = await this.data.addEquipmentFiles(current.id, uploaded);
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

  async generateRequest(): Promise<void> {
    this.generateError.set('');
    const created = await this.data.addApprovalFromSelection(undefined, this.projectId());
    if (!created) {
      this.generateError.set(
        'Elige en el comparador los equipos de este proyecto que se van a aprobar (hasta 3).',
      );
      return;
    }
    await this.router.navigate(['/aprobaciones'], { queryParams: { solicitud: created.id } });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files?.length) {
      return;
    }
    await this.uploadProjectFiles(Array.from(files));
  }

  async onFileInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }
    await this.uploadProjectFiles(Array.from(files));
    input.value = '';
  }

  private async uploadProjectFiles(files: File[]): Promise<void> {
    const existingNames = new Set(
      this.data.getDocumentsByProject(this.projectId(), this.docFolder()).map((doc) =>
        doc.name.toLowerCase(),
      ),
    );
    const seen = new Set<string>();
    const unique: File[] = [];
    const duplicates: string[] = [];

    for (const file of files) {
      const key = file.name.toLowerCase();
      if (existingNames.has(key) || seen.has(key)) {
        duplicates.push(file.name);
        continue;
      }
      seen.add(key);
      unique.push(file);
    }

    if (duplicates.length) {
      const listed = duplicates.map((name) => `“${name}”`).join(', ');
      this.docError.set(
        duplicates.length === 1
          ? `El archivo ${listed} ya está en esta carpeta. No se puede subir el mismo archivo otra vez.`
          : `Estos archivos ya están en esta carpeta y no se volvieron a subir: ${listed}.`,
      );
    } else {
      this.docError.set('');
    }

    if (!unique.length) return;

    this.docUploading.set(true);
    try {
      for (const file of unique) {
        await this.data.addDocumentFile(this.projectId(), this.docFolder(), file);
      }
    } catch (error) {
      this.docError.set(error instanceof Error ? error.message : 'No se pudo subir el archivo a Firebase.');
    } finally {
      this.docUploading.set(false);
    }
  }

  async viewDocument(doc: DocumentItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.docError.set('');
    await this.showPreview(this.data.previewDocument(doc.id, doc.name));
  }

  async removeProjectDocument(doc: DocumentItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    const ok = await this.ui.confirm({
      title: 'Quitar documento',
      message: `¿Quitar “${doc.name}” de esta carpeta? Esta acción no se puede deshacer.`,
      confirmLabel: 'Quitar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    this.docError.set('');
    try {
      await this.data.removeDocument(doc.id);
      if (this.preview()?.name === doc.name) this.closePreview();
      this.ui.success('Documento eliminado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo quitar el archivo.';
      this.docError.set(message);
      this.ui.error(message);
    }
  }

  async viewEquipmentFile(file: EquipmentFile, event?: Event): Promise<void> {
    event?.stopPropagation();
    const equipment = this.selectedEquipment();
    if (!equipment) return;
    await this.showPreview(this.data.previewEquipmentFile(equipment.id, file.id, file.name));
  }

  async removeEquipmentFile(file: EquipmentFile, event?: Event): Promise<void> {
    event?.stopPropagation();
    const equipment = this.selectedEquipment();
    if (!equipment) return;
    const ok = await this.ui.confirm({
      title: 'Quitar archivo',
      message: `¿Quitar “${file.name}” de este equipo?`,
      confirmLabel: 'Quitar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!ok) return;
    const updated = await this.data.removeEquipmentFile(equipment.id, file.id);
    this.selectedEquipment.set(updated ?? this.data.getEquipmentById(equipment.id) ?? null);
    this.ui.success('Archivo eliminado.');
  }

  closePreview(): void {
    this.preview.set(null);
  }

  private async showPreview(load: Promise<FilePreview>): Promise<void> {
    this.previewLoading.set(true);
    try {
      const next = await load;
      this.preview.set({
        ...next,
        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(next.url),
      });
    } catch (error) {
      this.docError.set(
        error instanceof Error ? error.message : 'No se pudo abrir el archivo. Reinicia el backend e inténtalo de nuevo.',
      );
    } finally {
      this.previewLoading.set(false);
    }
  }

  statusClass(status: string): string {
    if (status === 'Aprobado' || status === 'Aprobada') return 'badge-success';
    if (status === 'Rechazado' || status === 'Rechazada') return 'badge-danger';
    if (status === 'Pendiente' || status === 'En evaluación') return 'badge-warning';
    return 'badge-info';
  }

  async onLogoChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.clientLogoName.set(file.name);
    try {
      await this.data.replaceDocumentFile(this.projectId(), 'Logo cliente', file);
    } catch (error) {
      this.docError.set(error instanceof Error ? error.message : 'No se pudo guardar el logo en Firebase.');
    }
  }

  async exportDocument(format: 'pdf' | 'word'): Promise<void> {
    const project = this.project();
    if (!project) return;
    const selected = this.data.getSelectedEquipment().filter((item) => item.projectId === project.id);
    if (!selected.length) {
      this.generateError.set(
        'Elige en el comparador los equipos de este proyecto que se van a aprobar (hasta 3).',
      );
      return;
    }
    const created = await this.data.addApprovalFromSelection(undefined, project.id);
    if (created) {
      await this.router.navigate(['/aprobaciones'], { queryParams: { solicitud: created.id } });
    }
  }
}
