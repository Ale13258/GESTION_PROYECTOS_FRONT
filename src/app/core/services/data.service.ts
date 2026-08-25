import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { FirebaseStorageService } from '../firebase/firebase-storage.service';
import { equipmentFileStoragePath, firebaseObjectPath, projectDocumentStoragePath, remapLegacyStoragePath, systemStoragePath } from '../firebase/storage-paths';
import {
  mapApproval,
  mapDocument,
  mapEquipment,
  mapProject,
  mapQuotation,
  mapSupplier,
} from '../api/mappers';
import {
  ApprovalRequest,
  DashboardStats,
  DocumentItem,
  Equipment,
  EquipmentCategory,
  NewEquipmentForm,
  NewQuotationForm,
  NewSupplierForm,
  Project,
  Quotation,
  Supplier,
} from '../models/promanage.models';
import { AuthService } from './auth.service';

export interface FilePreview {
  name: string;
  url: string;
  kind: 'image' | 'pdf' | 'cad' | 'spreadsheet' | 'other';
  remoteUrl?: string;
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly api = inject(ApiService);
  private readonly firebaseStorage = inject(FirebaseStorageService);
  private readonly auth = inject(AuthService);

  private tenantId(): string | null {
    return this.auth.tenant()?.id ?? this.auth.currentUser()?.tenantId ?? null;
  }

  private readonly projectsSignal = signal<Project[]>([]);
  private readonly equipmentSignal = signal<Equipment[]>([]);
  private readonly suppliersSignal = signal<Supplier[]>([]);
  private readonly quotationsSignal = signal<Quotation[]>([]);
  private readonly documentsSignal = signal<DocumentItem[]>([]);
  private readonly approvalsSignal = signal<ApprovalRequest[]>([]);
  private readonly statsSignal = signal<DashboardStats>({
    activeProjects: 0,
    registeredEquipment: 0,
    suppliers: 0,
    pendingQuotations: 0,
    approvedEquipment: 0,
    rejectedEquipment: 0,
  });
  private readonly plantProcessesSignal = signal<string[]>([]);
  private readonly equipmentCategoriesSignal = signal<EquipmentCategory[]>([]);
  private readonly notificationsUnread = signal(0);

  readonly searchQuery = signal('');
  readonly selectedEquipmentIds = signal<string[]>([]);
  readonly loading = signal(false);

  readonly projects = this.projectsSignal.asReadonly();
  readonly equipment = this.equipmentSignal.asReadonly();
  readonly suppliers = this.suppliersSignal.asReadonly();
  readonly quotations = this.quotationsSignal.asReadonly();
  readonly documents = this.documentsSignal.asReadonly();
  readonly approvals = this.approvalsSignal.asReadonly();
  readonly stats = this.statsSignal.asReadonly();
  readonly plantProcesses = this.plantProcessesSignal.asReadonly();
  readonly equipmentCategories = this.equipmentCategoriesSignal.asReadonly();
  readonly unreadNotifications = this.notificationsUnread.asReadonly();

  private readonly previewCache = new Map<string, FilePreview>();
  private readonly migratedProjectIds = new Set<string>();
  private migratingStorage = false;

  readonly searchHits = signal<{
    projects: { id: string; name: string }[];
    equipment: { id: string; name: string }[];
    suppliers: { id: string; name: string }[];
  } | null>(null);

  reset(): void {
    this.projectsSignal.set([]);
    this.equipmentSignal.set([]);
    this.suppliersSignal.set([]);
    this.quotationsSignal.set([]);
    this.documentsSignal.set([]);
    this.approvalsSignal.set([]);
    this.selectedEquipmentIds.set([]);
    this.searchHits.set(null);
    this.notificationsUnread.set(0);
    this.equipmentCategoriesSignal.set([]);
    this.previewCache.clear();
    this.migratedProjectIds.clear();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [projects, equipment, suppliers, quotations, approvals, stats, processes, categories, notifications] =
        await Promise.all([
          this.api.listAll<Parameters<typeof mapProject>[0]>('/projects'),
          this.api.listAll<Record<string, unknown>>('/equipment'),
          this.api.listAll<Parameters<typeof mapSupplier>[0]>('/suppliers'),
          this.api.listAll<Parameters<typeof mapQuotation>[0]>('/quotations'),
          this.api.listAll<Parameters<typeof mapApproval>[0]>('/approvals'),
          this.api.get<DashboardStats>('/dashboard/stats'),
          this.api.get<{ code: number; name: string }[]>('/catalogs/plant-processes'),
          this.api.get<EquipmentCategory[]>('/equipment/categories').catch(() => []),
          this.api.get<{ unread?: number }>('/notifications').catch(() => ({ unread: 0 })),
        ]);

      const mappedProjects = projects.map(mapProject);
      const mappedEquipment = equipment.map(mapEquipment);
      this.projectsSignal.set(mappedProjects);
      this.equipmentSignal.set(mappedEquipment);
      this.suppliersSignal.set(suppliers.map(mapSupplier));
      this.quotationsSignal.set(quotations.map(mapQuotation));
      this.approvalsSignal.set(
        approvals.map((row) =>
          mapApproval(row, {
            equipmentName: (row.equipmentIds?.length ? row.equipmentIds : [row.equipmentId])
              .map((id) => mappedEquipment.find((e) => e.id === id)?.name)
              .filter((name): name is string => Boolean(name))
              .join(', ') || mappedEquipment.find((e) => e.id === row.equipmentId)?.name,
            projectName: mappedProjects.find((p) => p.id === row.projectId)?.name,
          }),
        ),
      );
      this.statsSignal.set(stats);
      this.plantProcessesSignal.set(
        processes.map((p) => `${p.code}. ${p.name}`),
      );
      this.equipmentCategoriesSignal.set(Array.isArray(categories) ? categories : []);
      this.notificationsUnread.set(notifications.unread ?? 0);

      const docs = await Promise.all(
        mappedProjects.map((project) =>
          this.api
            .listAll<Parameters<typeof mapDocument>[0]>(`/projects/${project.id}/documents`)
            .catch(() => []),
        ),
      );
      this.documentsSignal.set(docs.flat().map(mapDocument));
      void Promise.all(
        mappedProjects.map((project) => this.firebaseStorage.ensureProjectFolders(project.id, project.name)),
      )
        .catch(() => undefined)
        .then(() => this.migrateLegacyProjectStorage());
    } finally {
      this.loading.set(false);
    }
  }

  getProject(id: string): Project | undefined {
    return this.projectsSignal().find((p) => p.id === id);
  }

  getEquipmentByProject(projectId: string): Equipment[] {
    return this.equipmentSignal().filter((e) => e.projectId === projectId);
  }

  getDocumentsByProject(projectId: string, folder?: string): DocumentItem[] {
    return this.documentsSignal().filter(
      (d) => d.projectId === projectId && (!folder || d.folder === folder),
    );
  }

  getQuotationsByProject(projectId: string): Quotation[] {
    return this.quotationsSignal().filter((q) => q.projectId === projectId);
  }

  async addProject(
    project: Omit<Project, 'id' | 'startDate' | 'status' | 'progress'> & { engineerId: string },
  ): Promise<Project> {
    const created = await this.api.post<Parameters<typeof mapProject>[0]>('/projects', {
      name: project.name,
      client: project.client,
      location: project.location,
      engineer: project.engineerId,
      description: project.description,
    });
    const mapped = mapProject(created);
    this.projectsSignal.update((list) => [mapped, ...list]);
    void this.firebaseStorage.ensureProjectFolders(mapped.id, mapped.name);
    return mapped;
  }

  async addSupplier(form: NewSupplierForm): Promise<Supplier> {
    const categories = form.categories
      .split(/[,/|]/)
      .map((c) => c.trim())
      .filter(Boolean);
    const created = await this.api.post<Parameters<typeof mapSupplier>[0]>('/suppliers', {
      name: form.name.trim(),
      categories: categories.length ? categories : ['General'],
      contactName: form.contactName.trim() || 'Por definir',
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      country: form.country.trim() || 'Colombia',
      rating: Number.isFinite(form.rating) ? Math.min(5, Math.max(0, form.rating)) : 0,
    });
    const mapped = mapSupplier(created);
    this.suppliersSignal.update((list) => [mapped, ...list]);
    return mapped;
  }

  async addQuotation(form: NewQuotationForm): Promise<Quotation> {
    const created = await this.api.post<Parameters<typeof mapQuotation>[0]>('/quotations', {
      projectId: form.projectId,
      equipmentId: form.equipmentId,
      supplierId: form.supplierId,
      amount: Number(form.amount) || 0,
      deliveryDays: Number(form.deliveryDays) || 0,
      status: form.status,
      date: form.date,
    });
    const mapped = mapQuotation(created);
    this.quotationsSignal.update((list) => [mapped, ...list]);
    return mapped;
  }

  getApproval(id: string): ApprovalRequest | undefined {
    return this.approvalsSignal().find((a) => a.id === id);
  }

  async addApprovalFromSelection(notes?: string, projectId?: string): Promise<ApprovalRequest | null> {
    let selected = this.getSelectedEquipment();
    if (projectId) selected = selected.filter((item) => item.projectId === projectId);
    if (!selected.length) return null;
    const sameProject = selected.filter((item) => item.projectId === selected[0].projectId);
    const names = sameProject.map((item) => item.name).join(', ');
    const created = await this.api.post<Parameters<typeof mapApproval>[0]>('/approvals', {
      equipmentId: sameProject[0].id,
      equipmentIds: sameProject.map((item) => item.id),
      notes:
        notes ??
        `Solicitud armada con los equipos elegidos para aprobación del proyecto: ${names}.`,
    });
    const mapped = mapApproval(created, {
      equipmentName: names,
      projectName: this.getProject(sameProject[0].projectId)?.name,
    });
    this.approvalsSignal.update((list) => [mapped, ...list]);
    await Promise.all(sameProject.map((item) => this.refreshEquipment(item.id)));
    return mapped;
  }

  async reviewApproval(
    id: string,
    payload: { code: number; comments: string; reviewedBy: string },
  ): Promise<void> {
    const updated = await this.api.post<Parameters<typeof mapApproval>[0]>(
      `/approvals/${id}/review`,
      payload,
    );
    const mapped = mapApproval(updated, {
      equipmentName: this.getApproval(id)?.equipmentName,
      projectName: this.getApproval(id)?.projectName,
    });
    this.approvalsSignal.update((list) => list.map((a) => (a.id === id ? mapped : a)));
  }

  async updateApproval(
    id: string,
    payload: { notes?: string; equipmentIds?: string[] },
  ): Promise<ApprovalRequest> {
    const current = this.getApproval(id);
    const updated = await this.api.patch<Parameters<typeof mapApproval>[0]>(`/approvals/${id}`, payload);
    const mapped = mapApproval(updated, {
      equipmentName: current?.equipmentName,
      projectName: current?.projectName,
    });
    this.approvalsSignal.update((list) => list.map((item) => (item.id === id ? mapped : item)));
    const ids = mapped.equipmentIds?.length ? mapped.equipmentIds : [mapped.equipmentId];
    await Promise.all(ids.map((equipmentId) => this.refreshEquipment(equipmentId)));
    return mapped;
  }

  async removeApproval(id: string): Promise<void> {
    const current = this.getApproval(id);
    const ids = current
      ? current.equipmentIds?.length
        ? current.equipmentIds
        : [current.equipmentId]
      : [];
    await this.api.delete(`/approvals/${id}`);
    this.approvalsSignal.update((list) => list.filter((item) => item.id !== id));
    await Promise.all(ids.filter(Boolean).map((equipmentId) => this.refreshEquipment(equipmentId)));
  }

  equipmentCountBySupplier(supplierName: string): number {
    return this.equipmentSignal().filter((e) => e.supplier === supplierName).length;
  }

  async addEquipmentCategory(name: string, description = ''): Promise<EquipmentCategory | null> {
    if (!name.trim()) return null;
    const created = await this.api.post<EquipmentCategory>('/equipment/categories', {
      name: name.trim(),
      description: description.trim() || undefined,
      active: true,
    });
    this.equipmentCategoriesSignal.update((list) =>
      [...list, created].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );
    return created;
  }

  async addEquipment(form: NewEquipmentForm): Promise<Equipment> {
    const created = await this.api.post<Record<string, unknown>>('/equipment', this.toEquipmentDto(form));
    let mapped = mapEquipment(created);
    const uploads = form.files.filter((f) => f.nativeFile);
    for (const file of uploads) {
      mapped = await this.uploadEquipmentFile(mapped.id, file.category, file.nativeFile!);
    }
    this.equipmentSignal.update((list) => [mapped, ...list.filter((e) => e.id !== mapped.id)]);
    void this.firebaseStorage.ensureEquipmentFolders(
      mapped.projectId,
      mapped.id,
      this.getProject(mapped.projectId)?.name,
      mapped.name,
    );
    return mapped;
  }

  async addEquipmentBatch(forms: NewEquipmentForm[]): Promise<Equipment[]> {
    if (!forms.length) return [];
    const projectId = forms[0].projectId;
    const result = await this.api.post<{ data: Record<string, unknown>[] }>('/equipment/import', {
      projectId,
      items: forms.map((form) => {
        const dto = this.toEquipmentDto(form);
        return {
          name: dto.name,
          model: dto.model,
          proceso: dto.proceso,
          nota: dto.nota,
          specs: dto.specs,
        };
      }),
    });
    const created = (result.data ?? []).map(mapEquipment);
    this.equipmentSignal.update((list) => [...created, ...list]);
    return created;
  }

  async updateEquipmentNote(id: string, nota: string): Promise<void> {
    const updated = await this.api.patch<Record<string, unknown>>(`/equipment/${id}/note`, {
      nota: nota.trim(),
    });
    this.replaceEquipment(mapEquipment(updated));
  }

  async updateEquipmentSpecs(
    id: string,
    payload: {
      caudal?: string;
      potencia?: number;
      voltaje?: string;
      rpm?: number;
      material?: string;
      garantia?: string;
      precio?: number;
    },
  ): Promise<Equipment> {
    const { precio, ...specs } = payload;
    const updated = await this.api.patch<Record<string, unknown>>(`/equipment/${id}`, {
      specs,
      precio,
    });
    const mapped = mapEquipment(updated);
    this.replaceEquipment(mapped);
    return mapped;
  }

  async addEquipmentFiles(id: string, files: Equipment['files']): Promise<Equipment | undefined> {
    let current: Equipment | undefined;
    for (const file of files) {
      if (!file.nativeFile) continue;
      current = await this.uploadEquipmentFile(id, file.category, file.nativeFile);
    }
    return current ?? this.getEquipmentById(id);
  }

  getEquipmentById(id: string): Equipment | undefined {
    return this.equipmentSignal().find((e) => e.id === id);
  }

  async refreshEquipment(id: string): Promise<Equipment | undefined> {
    const dto = await this.api.get<Record<string, unknown>>(`/equipment/${id}`);
    const mapped = mapEquipment(dto);
    await this.hydrateImages(mapped);
    this.replaceEquipment(mapped);
    return mapped;
  }

  async addDocumentFile(projectId: string, folder: string, file: File): Promise<void> {
    const stored = await this.firebaseStorage.upload(
      projectDocumentStoragePath(projectId, folder, this.getProject(projectId)?.name, this.tenantId()),
      file,
    );
    const created = await this.api.post<Parameters<typeof mapDocument>[0]>(
      `/projects/${projectId}/documents/remote`,
      {
        folder,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: stored.url,
      },
    );
    this.documentsSignal.update((list) => [mapDocument(created), ...list]);
  }

  async replaceDocumentFile(projectId: string, folder: string, file: File): Promise<void> {
    await this.addDocumentFile(projectId, folder, file);
    const extras = this.getDocumentsByProject(projectId, folder).slice(1);
    await Promise.all(extras.map((doc) => this.removeDocument(doc.id)));
  }

  async addGeneratedDocument(
    projectId: string,
    folder: string,
    blob: Blob,
    fileName: string,
  ): Promise<void> {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    await this.addDocumentFile(projectId, folder, file);
  }

  async addSystemFile(area: string, blob: Blob, fileName: string): Promise<void> {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    await this.firebaseStorage.upload(systemStoragePath(area, this.tenantId()), file);
  }

  async removeDocument(id: string): Promise<void> {
    await this.api.delete(`/documents/${id}`);
    this.documentsSignal.update((list) => list.filter((doc) => doc.id !== id));
    this.previewCache.delete(`doc:${id}`);
  }

  async documentBlob(id: string): Promise<Blob> {
    return this.fileBlobFromApi(`/documents/${id}/download`);
  }

  async previewDocument(id: string, name: string): Promise<FilePreview> {
    const key = `doc:${id}`;
    const cached = this.previewCache.get(key);
    if (cached) return cached;
    const remoteUrl = this.documentsSignal().find((doc) => doc.id === id)?.url;
    const blob = await this.documentBlob(id);
    const preview = this.toFilePreview(name, blob, remoteUrl);
    this.previewCache.set(key, preview);
    return preview;
  }

  async previewEquipmentFile(equipmentId: string, fileId: string, name: string): Promise<FilePreview> {
    const key = `eq:${equipmentId}:${fileId}`;
    const cached = this.previewCache.get(key);
    if (cached) return cached;

    const local = this.getEquipmentById(equipmentId)?.files.find((f) => f.id === fileId);
    if (local?.previewUrl) {
      const preview: FilePreview = { name, url: local.previewUrl, kind: 'image' };
      this.previewCache.set(key, preview);
      return preview;
    }
    if (local?.nativeFile) {
      const preview = this.toFilePreview(name, local.nativeFile);
      this.previewCache.set(key, preview);
      return preview;
    }

    const blob = await this.fileBlobFromApi(`/equipment/${equipmentId}/files/${fileId}/download`);
    const preview = this.toFilePreview(name, blob, local?.url);
    this.previewCache.set(key, preview);
    return preview;
  }

  async removeEquipmentFile(equipmentId: string, fileId: string): Promise<Equipment | undefined> {
    await this.api.delete(`/equipment/${equipmentId}/files/${fileId}`);
    this.previewCache.delete(`eq:${equipmentId}:${fileId}`);
    return this.refreshEquipment(equipmentId);
  }

  private async fileBlobFromApi(path: string): Promise<Blob> {
    const blob = await this.api.getBlob(path);
    const type = (blob.type || '').toLowerCase();
    if (!type.includes('json') && !type.includes('text/plain')) return blob;
    const text = await blob.text();
    try {
      const payload = JSON.parse(text) as { url?: string };
      if (payload.url) return this.blobFromStoredUrl(payload.url);
    } catch {
      /* el cuerpo no era JSON */
    }
    return new Blob([text], { type: blob.type || 'application/octet-stream' });
  }

  private async blobFromStoredUrl(url: string): Promise<Blob> {
    const absolute = url.startsWith('http')
      ? url
      : `${this.api.baseUrl.replace(/\/api\/v1$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
    const response = await fetch(absolute);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo (${response.status})`);
    }
    return response.blob();
  }

  private toFilePreview(name: string, blob: Blob, remoteUrl?: string): FilePreview {
    const mime = this.mimeFromName(name);
    const typed = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mime });
    const type = typed.type.toLowerCase();
    const kind: FilePreview['kind'] = this.isCadFile(name)
      ? 'cad'
      : this.isSpreadsheetFile(name)
        ? 'spreadsheet'
        : type.startsWith('image/')
          ? 'image'
          : type.includes('pdf')
            ? 'pdf'
            : 'other';
    return { name, url: URL.createObjectURL(typed), kind, remoteUrl };
  }

  private isCadFile(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ['dwg', 'dxf', 'dwf', 'dwt', 'bak'].includes(ext);
  }

  private isSpreadsheetFile(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ['xlsx', 'xls', 'csv'].includes(ext);
  }

  private mimeFromName(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      txt: 'text/plain',
      csv: 'text/csv',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dwg: 'application/acad',
      dxf: 'application/dxf',
      dwf: 'model/vnd.dwf',
      dwt: 'application/acad',
      bak: 'application/acad',
    };
    return map[ext] || 'application/octet-stream';
  }

  async saveComparison(projectId: string, equipmentIds: string[]): Promise<void> {
    await this.api.post('/comparisons', { projectId, equipmentIds });
  }

  async loadSettings(): Promise<{ theme: string; language: string; currency: string }> {
    return this.api.get('/settings');
  }

  async saveSettings(payload: { theme?: string; language?: string; currency?: string }): Promise<void> {
    await this.api.patch('/settings', payload);
  }

  async searchRemote(q: string): Promise<void> {
    if (!q.trim()) {
      this.searchHits.set(null);
      return;
    }
    const result = await this.api.get<{
      projects: { id: string; name: string }[];
      equipment: { id: string; name: string }[];
      suppliers: { id: string; name: string }[];
    }>('/search', { q: q.trim() });
    this.searchHits.set(result);
  }

  toggleCompareEquipment(id: string): void {
    this.selectedEquipmentIds.update((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= 3) return ids;
      return [...ids, id];
    });
  }

  clearCompareSelection(): void {
    this.selectedEquipmentIds.set([]);
  }

  getSelectedEquipment(): Equipment[] {
    const ids = this.selectedEquipmentIds();
    return this.equipmentSignal().filter((e) => ids.includes(e.id));
  }

  projectIndicators(projectId: string) {
    const equipment = this.getEquipmentByProject(projectId);
    const docs = this.getDocumentsByProject(projectId);
    const quotations = this.getQuotationsByProject(projectId);
    const approved = equipment.filter((e) => e.status === 'Aprobado').length;
    const pending = equipment.filter(
      (e) => e.status === 'Pendiente' || e.status === 'En evaluación',
    ).length;
    return {
      documentProgress: Math.min(100, Math.round((docs.length / 12) * 100)),
      registered: equipment.length,
      approved,
      pending,
      totalQuoted: quotations.reduce((sum, q) => sum + q.amount, 0),
      suppliersEvaluated: new Set(equipment.map((e) => e.supplier)).size,
      comparisons: Math.max(0, Math.floor(equipment.length / 2)),
      avgAnalysisDays: 4.5,
    };
  }

  private toEquipmentDto(form: NewEquipmentForm) {
    const noteParts = [
      form.nota.trim(),
      form.cantidad.trim() ? `Cantidad: ${form.cantidad.trim()}` : '',
      form.especificacionesTecnicas.trim(),
      form.dimensionesCapacidad.trim(),
      form.fuenteManual.trim() ? `Fuente: ${form.fuenteManual.trim()}` : '',
    ].filter(Boolean);
    return {
      projectId: form.projectId,
      name: form.name.trim(),
      model: form.model?.trim() || undefined,
      proceso: form.proceso.trim(),
      categoryId: form.categoryId || undefined,
      nota: noteParts.join('\n') || undefined,
      specs: {
        caudal: form.especificacionesTecnicas.trim() || undefined,
        material: form.material.trim() || undefined,
      },
    };
  }

  private async uploadEquipmentFile(
    equipmentId: string,
    category: string,
    file: File,
  ): Promise<Equipment> {
    const equipment = this.getEquipmentById(equipmentId);
    const project = equipment ? this.getProject(equipment.projectId) : undefined;
    const stored = await this.firebaseStorage.upload(
      equipmentFileStoragePath(
        equipment?.projectId || 'sin-proyecto',
        equipmentId,
        category,
        project?.name,
        equipment?.name,
        this.tenantId(),
      ),
      file,
    );
    const updated = await this.api.post<Record<string, unknown>>(
      `/equipment/${equipmentId}/files/remote`,
      {
        category,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: stored.url,
      },
    );
    const mapped = mapEquipment(updated);
    await this.hydrateImages(mapped);
    this.replaceEquipment(mapped);
    return mapped;
  }

  private replaceEquipment(item: Equipment): void {
    this.equipmentSignal.update((list) => {
      const index = list.findIndex((e) => e.id === item.id);
      if (index < 0) return [item, ...list];
      const next = [...list];
      next[index] = item;
      return next;
    });
  }

  private async hydrateImages(item: Equipment): Promise<void> {
    const images = item.files.filter((f) => f.category === 'imagen');
    for (const file of images) {
      const key = `eq:${item.id}:${file.id}`;
      const cached = this.previewCache.get(key);
      if (cached) {
        file.previewUrl = cached.url;
        continue;
      }
      try {
        const blob = await this.fileBlobFromApi(`/equipment/${item.id}/files/${file.id}/download`);
        const preview = this.toFilePreview(file.name, blob);
        this.previewCache.set(key, preview);
        file.previewUrl = preview.url;
      } catch {
        /* ignore */
      }
    }
    const preview = images.find((f) => f.previewUrl)?.previewUrl;
    if (preview) item.image = preview;
    else if (!item.image) item.image = PLACEHOLDER_IMAGE;
  }

  private async migrateLegacyProjectStorage(): Promise<void> {
    if (this.migratingStorage) return;
    this.migratingStorage = true;
    try {
      for (const project of this.projectsSignal()) {
        if (this.migratedProjectIds.has(project.id)) continue;
        try {
          const done = await this.migrateProjectFolder(project);
          if (done) this.migratedProjectIds.add(project.id);
        } catch (error) {
          console.warn(`[storage] No se pudo migrar el proyecto ${project.name}`, error);
        }
      }
    } finally {
      this.migratingStorage = false;
    }
  }

  private async migrateProjectFolder(project: Project): Promise<boolean> {
    const prefix = `proyectos/${project.id}/`;
    const equipment = this.equipmentSignal().filter((item) => item.projectId === project.id);
    const objects: { name: string; downloadTokens?: string; url?: string }[] = [];

    try {
      objects.push(...(await this.firebaseStorage.listPrefix(prefix)));
    } catch {
      const seen = new Set<string>();
      const addUrl = (url?: string) => {
        const path = firebaseObjectPath(url);
        if (!path?.startsWith(prefix) || seen.has(path)) return;
        seen.add(path);
        objects.push({ name: path, url });
      };
      this.documentsSignal()
        .filter((doc) => doc.projectId === project.id)
        .forEach((doc) => addUrl(doc.url));
      equipment.forEach((item) => item.files.forEach((file) => addUrl(file.url)));
    }

    if (!objects.length) return true;

    for (let i = 0; i < objects.length; i += 3) {
      await Promise.all(
        objects.slice(i, i + 3).map((item) => this.migrateStorageObject(project, equipment, item)),
      );
    }

    return !this.documentsSignal().some(
      (doc) => doc.projectId === project.id && firebaseObjectPath(doc.url)?.startsWith(prefix),
    ) && !this.equipmentSignal().some(
      (item) => item.projectId === project.id && item.files.some((file) => firebaseObjectPath(file.url)?.startsWith(prefix)),
    );
  }

  private async migrateStorageObject(
    project: Project,
    equipment: Equipment[],
    item: { name: string; downloadTokens?: string; url?: string },
  ): Promise<void> {
    const dest = remapLegacyStoragePath(item.name, project.id, project.name, equipment);
    if (!dest) return;

    if (item.name.endsWith('/.keep') || item.name.endsWith('.keep')) {
      await this.firebaseStorage.deleteObject(item.name).catch(() => undefined);
      return;
    }

    const knownUrl =
      item.url ??
      this.documentsSignal().find((doc) => firebaseObjectPath(doc.url) === item.name)?.url ??
      this.equipmentSignal()
        .flatMap((eq) => eq.files)
        .find((file) => firebaseObjectPath(file.url) === item.name)?.url;

    const copied = await this.firebaseStorage.copyObject({ ...item, url: knownUrl }, dest);
    const docs = this.documentsSignal().filter((doc) => firebaseObjectPath(doc.url) === item.name);
    const files: { equipmentId: string; fileId: string }[] = [];
    for (const eq of this.equipmentSignal()) {
      for (const file of eq.files) {
        if (firebaseObjectPath(file.url) === item.name) {
          files.push({ equipmentId: eq.id, fileId: file.id });
        }
      }
    }

    try {
      await Promise.all([
        ...docs.map(async (doc) => {
          await this.api.patch(`/documents/${doc.id}`, { storageKey: copied.url });
          this.applyDocumentUrl(doc.id, copied.url);
        }),
        ...files.map(async ({ equipmentId, fileId }) => {
          await this.api.patch(`/equipment/${equipmentId}/files/${fileId}`, { storageKey: copied.url });
          this.applyEquipmentFileUrl(equipmentId, fileId, copied.url);
        }),
      ]);
    } catch (error) {
      console.warn(`[storage] Copiado ${item.name}, pero no se actualizó la URL en el API`, error);
      return;
    }

    await this.firebaseStorage.deleteObject(item.name).catch(() => undefined);
  }

  private applyDocumentUrl(id: string, url: string): void {
    this.documentsSignal.update((list) =>
      list.map((doc) => (doc.id === id ? { ...doc, url } : doc)),
    );
    this.previewCache.delete(`doc:${id}`);
  }

  private applyEquipmentFileUrl(equipmentId: string, fileId: string, url: string): void {
    this.equipmentSignal.update((list) =>
      list.map((item) =>
        item.id === equipmentId
          ? { ...item, files: item.files.map((file) => (file.id === fileId ? { ...file, url } : file)) }
          : item,
      ),
    );
    this.previewCache.delete(`eq:${equipmentId}:${fileId}`);
  }
}
