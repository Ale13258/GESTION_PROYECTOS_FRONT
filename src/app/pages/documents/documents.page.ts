import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DocumentItem } from '../../core/models/promanage.models';
import { DataService, FilePreview } from '../../core/services/data.service';
import { CadPreviewComponent } from '../../shared/cad-preview/cad-preview.component';
import { SpreadsheetPreviewComponent } from '../../shared/spreadsheet-preview/spreadsheet-preview.component';

interface DocumentRow extends DocumentItem {
  projectName: string;
}

interface DocumentGroup {
  projectId: string;
  projectName: string;
  docs: DocumentRow[];
}

@Component({
  selector: 'app-documents-page',
  imports: [DatePipe, FormsModule, RouterLink, CadPreviewComponent, SpreadsheetPreviewComponent],
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
})
export class DocumentsPage {
  readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly filterProject = signal('');
  readonly filterFolder = signal('');
  readonly filterText = signal('');
  readonly preview = signal<(FilePreview & { safeUrl: SafeResourceUrl }) | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal('');

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

  constructor() {
    const projectId = this.route.snapshot.queryParamMap.get('proyecto');
    if (projectId) this.filterProject.set(projectId);
  }

  readonly filtered = computed((): DocumentRow[] => {
    const projectId = this.filterProject();
    const folder = this.filterFolder();
    const text = this.filterText().toLowerCase().trim();
    return this.data
      .documents()
      .filter((doc) => {
        const matchProject = !projectId || doc.projectId === projectId;
        const matchFolder = !folder || doc.folder === folder;
        const matchText =
          !text ||
          doc.name.toLowerCase().includes(text) ||
          doc.type.toLowerCase().includes(text) ||
          doc.folder.toLowerCase().includes(text);
        return matchProject && matchFolder && matchText;
      })
      .map((doc) => ({
        ...doc,
        projectName: this.data.getProject(doc.projectId)?.name ?? 'Proyecto',
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
  });

  readonly groups = computed((): DocumentGroup[] => {
    const docs = this.filtered();
    const grouped = new Map<string, DocumentGroup>();
    for (const doc of docs) {
      const current = grouped.get(doc.projectId);
      if (current) {
        current.docs.push(doc);
      } else {
        grouped.set(doc.projectId, {
          projectId: doc.projectId,
          projectName: doc.projectName,
          docs: [doc],
        });
      }
    }
    return [...grouped.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
  });

  readonly stats = computed(() => {
    const docs = this.data.documents();
    return {
      total: docs.length,
      projects: new Set(docs.map((doc) => doc.projectId)).size,
      folders: new Set(docs.map((doc) => doc.folder)).size,
    };
  });

  fileIcon(doc: DocumentItem): string {
    const ext = this.extension(doc);
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'table_chart';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (['dwg', 'dxf', 'bak', 'dwt'].includes(ext)) return 'architecture';
    if (['doc', 'docx'].includes(ext)) return 'description';
    return 'draft';
  }

  fileTone(doc: DocumentItem): string {
    const ext = this.extension(doc);
    if (ext === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (['dwg', 'dxf', 'bak', 'dwt'].includes(ext)) return 'cad';
    if (['doc', 'docx'].includes(ext)) return 'description';
    return 'file';
  }

  async viewDocument(doc: DocumentItem): Promise<void> {
    this.previewError.set('');
    this.previewLoading.set(true);
    try {
      const next = await this.data.previewDocument(doc.id, doc.name);
      this.preview.set({
        ...next,
        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(next.url),
      });
    } catch (error) {
      this.previewError.set(
        error instanceof Error ? error.message : 'No se pudo abrir el archivo.',
      );
    } finally {
      this.previewLoading.set(false);
    }
  }

  closePreview(): void {
    this.preview.set(null);
  }

  private extension(doc: DocumentItem): string {
    return (doc.name.split('.').pop() ?? doc.type).toLowerCase();
  }
}
