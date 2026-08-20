import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { DataService, FilePreview } from '../../core/services/data.service';
import { CadPreviewComponent } from '../../shared/cad-preview/cad-preview.component';
import { SpreadsheetPreviewComponent } from '../../shared/spreadsheet-preview/spreadsheet-preview.component';
import {
  Equipment,
  EquipmentFile,
  EquipmentFileCategory,
  NewEquipmentForm,
} from '../../core/models/promanage.models';

interface SpecDraft {
  caudal: string;
  potencia: string;
  voltaje: string;
  rpm: string;
  material: string;
  garantia: string;
}

interface ExcelImportRow {
  line: number;
  form: NewEquipmentForm | null;
  projectName: string;
  name: string;
  proceso: string;
  cantidad: string;
  especificacionesTecnicas: string;
  dimensionesCapacidad: string;
  material: string;
  fuenteManual: string;
  error?: string;
}

@Component({
  selector: 'app-inventory-page',
  imports: [FormsModule, CadPreviewComponent, SpreadsheetPreviewComponent],
  templateUrl: './inventory.page.html',
  styleUrl: './inventory.page.scss',
})
export class InventoryPage {
  readonly data = inject(DataService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  readonly preview = signal<(FilePreview & { safeUrl: SafeResourceUrl }) | null>(null);
  readonly previewLoading = signal(false);

  readonly filterText = signal('');
  readonly filterProject = signal('');
  readonly filterCategory = signal('');
  readonly filterStatus = signal('');
  readonly selected = signal<Equipment | null>(null);
  readonly showModal = signal(false);
  readonly showImport = signal(false);
  readonly importRows = signal<ExcelImportRow[]>([]);
  readonly importFileName = signal('');
  readonly importResult = signal('');
  readonly importDragging = signal(false);
  readonly importProjectId = signal('');
  readonly importTitle = signal('');
  readonly noteDraft = signal('');
  readonly specSaving = signal(false);
  readonly specSaved = signal(false);
  specDraft: SpecDraft = this.emptySpecDraft();
  readonly uploadCategory = signal<EquipmentFileCategory>('ficha');
  readonly formUploadCategory = signal<EquipmentFileCategory>('imagen');

  readonly processOptions = computed(() => {
    const fromApi = this.data.plantProcesses();
    return fromApi.length
      ? [...fromApi, 'Otro']
      : [
          '1. Entrada / Canal de aproximación',
          '2. Cribado fino',
          '3. Filtro percolador (tratamiento biológico)',
          '4. Bombeo de lodos',
          '5. Aireación',
          '6. Clarificación secundaria',
          'Otro',
        ];
  });

  readonly fileCategories: { value: EquipmentFileCategory; label: string }[] = [
    { value: 'imagen', label: 'Imagen visual' },
    { value: 'ficha', label: 'Ficha técnica' },
    { value: 'plano', label: 'Plano' },
    { value: 'manual', label: 'Manual' },
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

  readonly validImportCount = computed(
    () => this.importRows().filter((r) => !r.error && r.form).length,
  );

  readonly invalidImportCount = computed(
    () => this.importRows().filter((r) => r.error).length,
  );

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
      proceso: this.processOptions()[0] ?? '',
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

  openImport(): void {
    this.importRows.set([]);
    this.importFileName.set('');
    this.importResult.set('');
    this.importDragging.set(false);
    this.importTitle.set('');
    this.importProjectId.set(this.filterProject() || this.data.projects()[0]?.id || '');
    this.showImport.set(true);
  }

  closeImport(): void {
    this.showImport.set(false);
    this.importDragging.set(false);
  }

  downloadTemplate(): void {
    const project = this.data.getProject(this.importProjectId()) ?? this.data.projects()[0];
    const title = `LISTADO DE EQUIPOS POR PROCESO - ${project?.name ?? 'PTAR'} (Contrato 000 de 2026)`;
    const headers = [
      'Proceso',
      'Equipo',
      'Cantidad',
      'Especificaciones Técnicas',
      'Dimensiones / Capacidad de Diseño',
      'Material',
      'Fuente (Manual O&M)',
    ];
    const rows: (string | number)[][] = [
      [title, '', '', '', '', '', ''],
      headers,
      [
        '1. Entrada / Canal de aproximación',
        'Cámara de aquietamiento',
        1,
        'Disipa energía del bombeo y homogeneiza el caudal de llegada.',
        'Ancho 1,6 m; altura disipación 1,3 m; área 2,08 m²',
        'Concreto',
        'Num. 1.4.1, pág. 17',
      ],
      [
        '',
        'Canal de aproximación',
        1,
        'Conduce el caudal hacia el cribado fino.',
        'Ancho 0,80 m; longitud 6,0 m',
        'Concreto',
        'Num. 1.4.1, pág. 18',
      ],
      [
        '2. Cribado fino',
        'Reja de cribado automática (autolimpiante)',
        1,
        'Remoción de partículas ≥ 3,0 mm; operación continua.',
        'Q diseño = 180 L/s; paso 3 mm',
        'Acero inoxidable',
        'Tabla N°3, pág. 21',
      ],
      [
        '',
        'Reja de cribado manual (respaldo/bypass)',
        1,
        'Respaldo para mantenimiento de la reja automática.',
        'Paso 6 mm',
        'Acero inoxidable',
        'Tabla N°3, pág. 21',
      ],
      [
        '3. Filtro percolador (tratamiento biológico)',
        'Filtro percolador',
        2,
        'Tratamiento biológico por lecho percolador.',
        'Área superficial 238 m²; altura 2,4 m',
        'Concreto / medio plástico',
        'Cap. 4, pág. 33',
      ],
      [
        '',
        'Bomba de recirculación de filtro percolador',
        '2 (1+1 stand-by)',
        'Recirculación al filtro; operación continua con reserva.',
        'Potencia 30 HP; corriente máx. 64 A; Q = 90 L/s',
        'Acero inoxidable / fundición',
        'Cap. 4, pág. 36',
      ],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } },
    ];
    sheet['!cols'] = [
      { wch: 38 },
      { wch: 42 },
      { wch: 18 },
      { wch: 48 },
      { wch: 42 },
      { wch: 28 },
      { wch: 22 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Equipos');
    XLSX.writeFile(book, 'Plantilla_Listado_Equipos.xlsx');
  }

  onImportDragOver(event: DragEvent): void {
    event.preventDefault();
    this.importDragging.set(true);
  }

  onImportDragLeave(): void {
    this.importDragging.set(false);
  }

  async onImportDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.importDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.parseExcelFile(file);
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await this.parseExcelFile(file);
    input.value = '';
  }

  private async parseExcelFile(file: File): Promise<void> {
    this.importResult.set('');
    this.importFileName.set(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      this.importRows.set([]);
      this.importResult.set('El archivo no contiene hojas.');
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    this.applyMerges(sheet);
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });

    const headerIndex = matrix.findIndex((row) => this.isHeaderRow(row));
    if (headerIndex < 0) {
      this.importRows.set([]);
      this.importResult.set('No se encontró la fila de encabezados (Proceso, Equipo, Cantidad…).');
      return;
    }

    const titleText = matrix
      .slice(0, headerIndex)
      .map((row) => this.cellText(row[0]))
      .find((text) => text.length > 8);
    this.importTitle.set(titleText ?? '');

    const fromTitle = this.projectFromTitle(titleText ?? '');
    if (fromTitle) this.importProjectId.set(fromTitle);

    const headers = (matrix[headerIndex] ?? []).map((cell) => this.normalizeHeader(this.cellText(cell)));
    const col = (...names: string[]) => {
      const needles = names.map((n) => this.normalizeHeader(n));
      return headers.findIndex((h) => needles.some((n) => h === n || h.includes(n)));
    };

    const procesoCol = col('proceso');
    const equipoCol = col('equipo', 'nombre');
    const cantidadCol = col('cantidad');
    const specsCol = col('especificaciones tecnicas', 'especificaciones');
    const dimsCol = col('dimensiones / capacidad de diseno', 'dimensiones capacidad', 'dimensiones');
    const materialCol = col('material');
    const fuenteCol = col('fuente (manual o&m)', 'fuente', 'manual');
    const proyectoCol = col('proyecto');

    let currentProceso = '';
    const mapped: ExcelImportRow[] = [];

    for (let i = headerIndex + 1; i < matrix.length; i++) {
      const row = matrix[i] ?? [];
      const procesoCell = this.cellText(procesoCol >= 0 ? row[procesoCol] : '');
      const name = this.cellText(equipoCol >= 0 ? row[equipoCol] : '');
      const cantidad = this.cellText(cantidadCol >= 0 ? row[cantidadCol] : '') || '1';
      const especificacionesTecnicas = this.cellText(specsCol >= 0 ? row[specsCol] : '');
      const dimensionesCapacidad = this.cellText(dimsCol >= 0 ? row[dimsCol] : '');
      const material = this.cellText(materialCol >= 0 ? row[materialCol] : '');
      const fuenteManual = this.cellText(fuenteCol >= 0 ? row[fuenteCol] : '');
      const projectCell = this.cellText(proyectoCol >= 0 ? row[proyectoCol] : '');

      if (procesoCell) currentProceso = procesoCell;

      const isSectionRow =
        procesoCell &&
        !name &&
        !especificacionesTecnicas &&
        !material &&
        !dimensionesCapacidad;
      if (isSectionRow) continue;

      if (!name && !especificacionesTecnicas && !material && !dimensionesCapacidad) continue;

      mapped.push(
        this.buildImportRow({
          line: i + 1,
          name,
          proceso: currentProceso,
          cantidad,
          especificacionesTecnicas,
          dimensionesCapacidad,
          material,
          fuenteManual,
          projectHint: projectCell,
        }),
      );
    }

    this.importRows.set(mapped);
    if (!mapped.length) {
      this.importResult.set('No se encontraron filas de equipos en el archivo.');
    }
  }

  private applyMerges(sheet: XLSX.WorkSheet): void {
    const merges = sheet['!merges'] ?? [];
    for (const merge of merges) {
      const start = XLSX.utils.encode_cell(merge.s);
      const value = sheet[start]?.v;
      if (value === undefined || value === null || value === '') continue;
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!sheet[addr]) sheet[addr] = { t: 's', v: value };
          else if (sheet[addr].v === undefined || sheet[addr].v === '') sheet[addr].v = value;
        }
      }
    }
  }

  private isHeaderRow(row: (string | number | null)[]): boolean {
    const cells = row.map((cell) => this.normalizeHeader(this.cellText(cell)));
    return cells.includes('equipo') && (cells.includes('cantidad') || cells.includes('proceso'));
  }

  private cellText(value: unknown): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private projectFromTitle(title: string): string {
    const cleaned = title
      .replace(/listado de equipos por proceso/i, '')
      .replace(/contrato[^)]*/gi, '')
      .replace(/[()]/g, ' ')
      .replace(/[-–—]/g, ' ');
    return this.resolveProjectId(cleaned) || this.resolveProjectId(title);
  }

  private buildImportRow(input: {
    line: number;
    name: string;
    proceso: string;
    cantidad: string;
    especificacionesTecnicas: string;
    dimensionesCapacidad: string;
    material: string;
    fuenteManual: string;
    projectHint: string;
  }): ExcelImportRow {
    const projectId =
      this.resolveProjectId(input.projectHint) ||
      this.importProjectId() ||
      this.resolveProjectId(this.importTitle());
    const projectName =
      this.data.getProject(projectId)?.name ||
      input.projectHint ||
      this.importTitle() ||
      '—';

    const base = {
      line: input.line,
      projectName,
      name: input.name || '—',
      proceso: input.proceso || '—',
      cantidad: input.cantidad,
      especificacionesTecnicas: input.especificacionesTecnicas,
      dimensionesCapacidad: input.dimensionesCapacidad,
      material: input.material,
      fuenteManual: input.fuenteManual,
    };

    if (!input.name) {
      return { ...base, form: null, error: 'Falta el nombre del equipo' };
    }
    if (!projectId) {
      return {
        ...base,
        form: null,
        error: 'Selecciona el proyecto destino o indícalo en el título del Excel',
      };
    }

    return {
      ...base,
      form: {
        projectId,
        proceso: input.proceso || 'Otro',
        name: input.name,
        cantidad: input.cantidad,
        especificacionesTecnicas: input.especificacionesTecnicas,
        dimensionesCapacidad: input.dimensionesCapacidad,
        material: input.material,
        fuenteManual: input.fuenteManual,
        nota: '',
        files: [],
      },
    };
  }

  private normalizeHeader(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private resolveProjectId(value: string): string {
    if (!value) return '';
    const projects = this.data.projects();
    const byId = projects.find((p) => p.id.toLowerCase() === value.toLowerCase());
    if (byId) return byId.id;
    const needle = this.normalizeHeader(value);
    const byName = projects.find((p) => this.normalizeHeader(p.name) === needle);
    if (byName) return byName.id;
    return (
      projects.find((p) => this.normalizeHeader(p.name).includes(needle) || needle.includes(this.normalizeHeader(p.name)))
        ?.id ?? ''
    );
  }

  onImportProjectChange(projectId: string): void {
    this.importProjectId.set(projectId);
    this.importRows.update((rows) =>
      rows.map((row) =>
        this.buildImportRow({
          line: row.line,
          name: row.name === '—' ? '' : row.name,
          proceso: row.proceso === '—' ? '' : row.proceso,
          cantidad: row.cantidad,
          especificacionesTecnicas: row.especificacionesTecnicas,
          dimensionesCapacidad: row.dimensionesCapacidad,
          material: row.material,
          fuenteManual: row.fuenteManual,
          projectHint: '',
        }),
      ),
    );
  }

  async confirmImport(): Promise<void> {
    const forms = this.importRows()
      .map((row) => row.form)
      .filter((form): form is NewEquipmentForm => !!form);
    if (!forms.length) return;
    const created = await this.data.addEquipmentBatch(forms);
    this.importResult.set(`${created.length} equipo(s) importados correctamente.`);
    this.importRows.set([]);
    this.importFileName.set('');
  }

  async createEquipment(): Promise<void> {
    if (!this.form.name.trim() || !this.form.projectId) return;
    const created = await this.data.addEquipment(this.form);
    this.closeModal();
    await this.openDetail(created);
  }

  emptySpecDraft(): SpecDraft {
    return { caudal: '', potencia: '', voltaje: '', rpm: '', material: '', garantia: '' };
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

  async openDetail(item: Equipment): Promise<void> {
    const hydrated = await this.data.refreshEquipment(item.id);
    const current = hydrated ?? item;
    this.selected.set(current);
    this.noteDraft.set(current.nota);
    this.fillSpecDraft(current);
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  async viewFile(file: EquipmentFile, event?: Event): Promise<void> {
    event?.stopPropagation();
    const current = this.selected();
    if (!current) return;
    this.previewLoading.set(true);
    try {
      const next = await this.data.previewEquipmentFile(current.id, file.id, file.name);
      this.preview.set({
        ...next,
        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(next.url),
      });
    } finally {
      this.previewLoading.set(false);
    }
  }

  closePreview(): void {
    this.preview.set(null);
  }

  async saveSpecs(): Promise<void> {
    const current = this.selected();
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
      this.selected.set(updated);
      this.fillSpecDraft(updated);
      this.specSaved.set(true);
    } finally {
      this.specSaving.set(false);
    }
  }

  private toOptionalNumber(value: string): number | undefined {
    const n = Number(value);
    return value.trim() && Number.isFinite(n) ? n : undefined;
  }

  async saveNote(): Promise<void> {
    const current = this.selected();
    if (!current) return;
    await this.data.updateEquipmentNote(current.id, this.noteDraft());
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
              nativeFile: file,
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

  async onBudgetFiles(event: Event): Promise<void> {
    const current = this.selected();
    const input = event.target as HTMLInputElement;
    if (!current || !input.files?.length) return;
    const uploaded = await this.readFiles(input.files, 'cotizacion');
    const withLabel = uploaded.map((file) => ({ ...file, typeLabel: 'Presupuesto' }));
    const updated = await this.data.addEquipmentFiles(current.id, withLabel);
    this.selected.set(updated ?? this.data.getEquipmentById(current.id) ?? null);
    input.value = '';
  }

  budgetFiles(item: Equipment): EquipmentFile[] {
    return item.files.filter((file) => file.category === 'cotizacion');
  }

  technicalFiles(item: Equipment): EquipmentFile[] {
    return item.files.filter((file) => file.category !== 'cotizacion');
  }

  async onDetailFiles(event: Event): Promise<void> {
    const current = this.selected();
    const input = event.target as HTMLInputElement;
    if (!current || !input.files?.length) return;
    const uploaded = await this.readFiles(input.files, this.uploadCategory());
    const updated = await this.data.addEquipmentFiles(current.id, uploaded);
    this.selected.set(updated ?? this.data.getEquipmentById(current.id) ?? null);
    input.value = '';
  }

  async generateApproval(): Promise<void> {
    const current = this.selected();
    if (!current) return;
    this.data.clearCompareSelection();
    this.data.toggleCompareEquipment(current.id);
    await this.data.addApprovalFromSelection();
    void this.router.navigate(['/aprobaciones']);
  }
}
