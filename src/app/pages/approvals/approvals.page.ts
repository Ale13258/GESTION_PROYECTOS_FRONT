import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { ApprovalRequest, ApprovalStatus } from '../../core/models/promanage.models';
import { DataService } from '../../core/services/data.service';

type InterventoriaCode = 1 | 2 | 3 | 4 | 5 | null;

@Component({
  selector: 'app-approvals-page',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './approvals.page.html',
  styleUrl: './approvals.page.scss',
})
export class ApprovalsPage {
  readonly data = inject(DataService);

  readonly logoName = signal('LOGO DEL CLIENTE');
  readonly viewingId = signal<string | null>(null);
  readonly interventoriaCode = signal<InterventoriaCode>(null);
  readonly interventoriaComments = signal('');
  readonly reviewedBy = signal('Ing. Andrés Torres');
  readonly today = new Date();

  readonly requests = computed(() => this.data.approvals());

  readonly activeRequest = computed(() => {
    const id = this.viewingId();
    if (!id) return null;
    return this.data.getApproval(id) ?? null;
  });

  readonly project = computed(() => {
    const req = this.activeRequest();
    if (!req) return undefined;
    return this.data.getProject(req.projectId);
  });

  readonly equipment = computed(() => {
    const req = this.activeRequest();
    if (!req) return null;
    return (
      this.data.equipment().find((e) => e.id === req.equipmentId) ??
      this.data.equipment().find((e) => e.name === req.equipmentName) ??
      null
    );
  });

  readonly docCode = computed(() => {
    const req = this.activeRequest();
    const project = this.project();
    if (!req || !project) return 'SAE-000';
    const short = project.name.replace(/\s+/g, '-').toUpperCase().slice(0, 12);
    return `SAE-${short}-EQ${req.id.replace(/\D/g, '').slice(-1) || '1'}`;
  });

  readonly contractCode = computed(() => {
    const project = this.project();
    if (!project) return 'CT-2026-0000';
    const n = project.id.replace(/\D/g, '') || '1';
    return `CT-2026-011${n}`;
  });

  readonly recommendation = computed(() => {
    const eq = this.equipment();
    const project = this.project();
    const name = eq?.name ?? this.activeRequest()?.equipmentName ?? 'el equipo seleccionado';
    const projectName = project?.name ?? this.activeRequest()?.projectName ?? 'el proyecto';
    const compliance = eq?.specs.cumplimiento ?? 96;
    return `El equipo ${name} cumple con los requerimientos técnicos del proyecto ${projectName}, presentando un cumplimiento técnico del ${compliance}% frente a las alternativas evaluadas en la matriz comparativa. Se recomienda su aprobación para continuar con el proceso de adquisición.`;
  });

  readonly techRows = computed(() => {
    const eq = this.equipment();
    if (!eq) {
      return [
        { feature: 'Tipo de equipo', description: 'Equipo electromecánico', material: 'Según ficha técnica' },
        { feature: 'Caudal de diseño', description: 'Según especificación de contrato', material: '—' },
      ];
    }
    return [
      {
        feature: 'Tipo de equipo',
        description: eq.category || eq.proceso,
        material: eq.specs.material,
      },
      {
        feature: 'Caudal de diseño',
        description: `${eq.specs.caudal} L/s`,
        material: eq.specs.material,
      },
      {
        feature: 'Potencia / Voltaje',
        description: `${eq.specs.potencia} kW · ${eq.specs.voltaje} V`,
        material: 'Bobinado clase F',
      },
      {
        feature: 'Velocidad de giro',
        description: `${eq.specs.rpm} RPM`,
        material: '—',
      },
      {
        feature: 'Dimensiones / Capacidad',
        description: eq.dimensionesCapacidad || 'Según plano de fabricante',
        material: eq.specs.material,
      },
      {
        feature: 'Garantía y entrega',
        description: `${eq.specs.garantia} · ${eq.specs.entregaDias} días`,
        material: '—',
      },
    ];
  });

  readonly attachedDocs = computed(() => {
    const eq = this.equipment();
    if (eq?.files?.length) {
      return eq.files.map((f) => f.typeLabel || f.name);
    }
    return ['Ficha técnica', 'Plano del equipo', 'Cotización del proveedor'];
  });

  readonly interventoriaOptions = [
    { code: 1 as const, label: 'Aprobado sin comentarios' },
    { code: 2 as const, label: 'Aprobado con comentarios' },
    { code: 3 as const, label: 'Rectificar y someter de nuevo' },
    { code: 4 as const, label: 'Rechazado' },
    { code: 5 as const, label: 'Sometido únicamente para información' },
  ];

  generateNew(): void {
    const created = this.data.addApprovalFromSelection();
    if (created) this.open(created);
  }

  view(request: ApprovalRequest): void {
    this.open(request);
  }

  open(request: ApprovalRequest): void {
    this.viewingId.set(request.id);
    this.interventoriaCode.set(request.status === 'Aprobada' ? 1 : null);
    this.interventoriaComments.set('');
    this.reviewedBy.set(request.requester);
  }

  closeDetail(): void {
    this.viewingId.set(null);
  }

  statusClass(status: ApprovalStatus): string {
    if (status === 'Aprobada') return 'st-ok';
    if (status === 'En revisión') return 'st-warn';
    if (status === 'Rechazada') return 'st-bad';
    return 'st-draft';
  }

  displayDate(value?: string): string {
    if (!value) return new Date().toLocaleDateString('es-CO');
    const [y, m, d] = value.split('-');
    if (y && m && d) return `${Number(d)}/${Number(m)}/${y}`;
    return value;
  }

  onLogoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.logoName.set(file.name);
  }

  private buildExportData() {
    const project = this.project();
    const equipment = this.equipment();
    const request = this.activeRequest();
    if (!request) return null;

    const eqName = equipment?.name ?? request.equipmentName;
    const projectName = project?.name ?? request.projectName;
    const code = this.interventoriaCode();
    const codeLabel = this.interventoriaOptions.find((o) => o.code === code)?.label ?? 'Sin respuesta';

    return {
      request,
      project,
      equipment,
      eqName,
      projectName,
      code,
      codeLabel,
      fileBase: `Solicitud_Aprobacion_${projectName.replace(/\s+/g, '_')}`,
    };
  }

  export(format: 'pdf' | 'word'): void {
    const data = this.buildExportData();
    if (!data) return;

    if (format === 'pdf') {
      this.exportPdf(data);
      return;
    }
    this.exportWord(data);
  }

  private exportPdf(data: NonNullable<ReturnType<ApprovalsPage['buildExportData']>>): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 14;
    const contentW = pageW - margin * 2;
    const pageBottom = 270;
    const navy: [number, number, number] = [18, 58, 99];
    const ink: [number, number, number] = [15, 39, 68];
    const muted: [number, number, number] = [100, 116, 139];
    const line: [number, number, number] = [226, 232, 240];
    const soft: [number, number, number] = [248, 250, 252];
    let y = 12;

    const ensureSpace = (need: number) => {
      if (y + need > pageBottom) {
        doc.addPage();
        y = 16;
      }
    };

    const clamp = (text: string, max = 140) => {
      const t = this.pdfSafe(text || '-');
      return t.length > max ? `${t.slice(0, max - 1)}...` : t;
    };

    const title = (text: string) => {
      ensureSpace(12);
      y += 2;
      doc.setFillColor(...navy);
      doc.roundedRect(margin, y, contentW, 7, 1.2, 1.2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(this.pdfSafe(text), margin + 3, y + 4.7);
      y += 9.5;
    };

    const kv = (pairs: [string, string][], cols = 2) => {
      const rows = Math.ceil(pairs.length / cols);
      const colW = contentW / cols;
      const rowH = 9;
      ensureSpace(rows * rowH + 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= pairs.length) continue;
          const [label, value] = pairs[idx];
          const x = margin + c * colW;
          const labelW = Math.min(36, colW * 0.36);
          doc.setFillColor(...soft);
          doc.setDrawColor(...line);
          doc.rect(x, y + r * rowH, labelW, rowH, 'FD');
          doc.setFillColor(255, 255, 255);
          doc.rect(x + labelW, y + r * rowH, colW - labelW, rowH, 'FD');
          doc.setTextColor(...muted);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.text(this.pdfSafe(label.toUpperCase()), x + 2, y + r * rowH + 5.6);
          doc.setTextColor(...ink);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          const lines = doc.splitTextToSize(clamp(value, cols === 1 ? 120 : 50), colW - labelW - 4);
          doc.text(lines[0], x + labelW + 2, y + r * rowH + 5.6);
        }
      }
      y += rows * rowH + 3;
    };

    const paragraphBox = (text: string, fill: [number, number, number] = [234, 243, 251]) => {
      const lines = doc.splitTextToSize(this.pdfSafe(text), contentW - 8);
      const h = lines.length * 4.4 + 8;
      ensureSpace(h + 2);
      doc.setFillColor(...fill);
      doc.setDrawColor(201, 215, 232);
      doc.roundedRect(margin, y, contentW, h, 2, 2, 'FD');
      doc.setTextColor(...ink);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(lines, margin + 4, y + 6);
      y += h + 3;
    };

    const selectedEquipments = (() => {
      const fromCompare = this.data.getSelectedEquipment();
      if (fromCompare.length > 0) return fromCompare;
      return data.equipment ? [data.equipment] : [];
    })();

    // Header
    doc.setFillColor(...navy);
    doc.roundedRect(margin, y, 40, 18, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('LOGO', margin + 20, y + 8, { align: 'center' });
    doc.text('CLIENTE', margin + 20, y + 13, { align: 'center' });

    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(this.pdfSafe('SOLICITUD DE APROBACION DE EQUIPOS'), pageW - margin, y + 7, {
      align: 'right',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(this.pdfSafe(`Codigo: ${this.docCode()}`), pageW - margin, y + 13, { align: 'right' });
    doc.text(`Fecha: ${this.displayDate(data.request.date)}`, pageW - margin, y + 18, {
      align: 'right',
    });
    y += 24;
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    doc.setLineWidth(0.2);
    y += 5;

    title('1. INFORMACION DEL PROYECTO');
    kv([
      ['Proyecto', data.projectName],
      ['Contrato', this.contractCode()],
      ['Cliente', data.project?.client ?? '-'],
      ['Ubicacion', data.project?.location ?? '-'],
    ]);

    const renderEquipmentBlock = (
      eq: NonNullable<typeof data.equipment> | (typeof selectedEquipments)[number],
      index: number,
      total: number,
    ) => {
      const sectionLabel =
        total > 1
          ? `2.${index + 1} INFORMACION DEL EQUIPO (${index + 1}/${total})`
          : '2. INFORMACION DEL EQUIPO';
      title(sectionLabel);
      kv([
        ['Equipo', eq.name],
        ['Categoria', eq.category ?? '-'],
        ['Fabricante', eq.manufacturer ?? '-'],
        ['Modelo', eq.model ?? '-'],
        ['Proveedor', eq.supplier ?? '-'],
        ['Precio', `$ ${eq.price.toLocaleString('es-CO')}`],
      ]);
      kv(
        [
          ['Actividad', eq.proceso || 'Instalacion y puesta en marcha'],
          [
            'Descripcion',
            eq.especificacionesTecnicas || eq.nota || 'Segun especificaciones del contrato',
          ],
        ],
        1,
      );

      title(total > 1 ? `3.${index + 1} ESPECIFICACIONES TECNICAS` : '3. ESPECIFICACIONES TECNICAS');
      kv([
        ['Caudal', `${eq.specs.caudal} L/s`],
        ['Potencia', `${eq.specs.potencia} kW`],
        ['Voltaje', `${eq.specs.voltaje} V`],
        ['RPM', `${eq.specs.rpm}`],
        ['Material', eq.specs.material],
        ['Garantia', eq.specs.garantia],
        ['Entrega', `${eq.specs.entregaDias} dias`],
        ['Cumplimiento', `${eq.specs.cumplimiento}%`],
        ['Clase', 'F'],
        ['Factor servicio', '1.1'],
        ['Apto VDF', 'SI'],
        ['Protocolo', 'Ethernet'],
      ]);

      const techRows = [
        {
          feature: 'Tipo de equipo',
          description: eq.category || eq.proceso,
          material: eq.specs.material,
        },
        {
          feature: 'Caudal de diseno',
          description: `${eq.specs.caudal} L/s`,
          material: eq.specs.material,
        },
        {
          feature: 'Potencia / Voltaje',
          description: `${eq.specs.potencia} kW / ${eq.specs.voltaje} V`,
          material: 'Bobinado clase F',
        },
        {
          feature: 'Velocidad de giro',
          description: `${eq.specs.rpm} RPM`,
          material: '-',
        },
        {
          feature: 'Dimensiones / Capacidad',
          description: eq.dimensionesCapacidad || 'Segun plano de fabricante',
          material: eq.specs.material,
        },
        {
          feature: 'Garantia y entrega',
          description: `${eq.specs.garantia} / ${eq.specs.entregaDias} dias`,
          material: '-',
        },
      ];

      ensureSpace(14 + techRows.length * 7);
      doc.setTextColor(...ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Caracteristicas tecnicas de las partes del equipo', margin, y);
      y += 3;
      const widths = [52, 78, contentW - 130];
      doc.setFillColor(...navy);
      doc.rect(margin, y, contentW, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      let hx = margin + 2;
      ['Caracteristica tecnica', 'Descripcion', 'Material'].forEach((h, i) => {
        doc.text(h, hx, y + 4.3);
        hx += widths[i];
      });
      y += 6.5;
      techRows.forEach((row, i) => {
        ensureSpace(8);
        const bg = i % 2 === 0 ? soft : ([255, 255, 255] as [number, number, number]);
        doc.setFillColor(...bg);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setDrawColor(...line);
        doc.line(margin, y + 7, margin + contentW, y + 7);
        doc.setTextColor(...ink);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        let cx = margin + 2;
        [row.feature, row.description, row.material].forEach((cell, ci) => {
          const t = doc.splitTextToSize(clamp(cell, 60), widths[ci] - 3);
          doc.text(t[0], cx, y + 4.6);
          cx += widths[ci];
        });
        y += 7;
      });
      y += 3;

      const docs =
        eq.files?.length > 0
          ? eq.files.map((f) => f.typeLabel || f.name)
          : ['Ficha tecnica', 'Plano del equipo', 'Cotizacion del proveedor'];
      title(total > 1 ? `DOCUMENTOS ADJUNTOS - Equipo ${index + 1}` : 'DOCUMENTOS ADJUNTOS');
      ensureSpace(12);
      doc.setFillColor(...soft);
      doc.setDrawColor(...line);
      const docsText = docs.join('  |  ');
      const docLines = doc.splitTextToSize(this.pdfSafe(docsText), contentW - 8);
      const docsH = docLines.length * 4.2 + 6;
      doc.roundedRect(margin, y, contentW, docsH, 1.5, 1.5, 'FD');
      doc.setTextColor(...ink);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(docLines, margin + 4, y + 5);
      y += docsH + 3;
    };

    if (selectedEquipments.length > 0) {
      selectedEquipments.forEach((eq, i) =>
        renderEquipmentBlock(eq, i, selectedEquipments.length),
      );
    } else {
      // Fallback con datos del request
      title('2. INFORMACION DEL EQUIPO');
      kv([
        ['Equipo', data.eqName],
        ['Categoria', '-'],
        ['Fabricante', '-'],
        ['Modelo', '-'],
        ['Proveedor', '-'],
        ['Precio', '-'],
      ]);
    }

    // Bloque final: siempre junto (recomendacion + interventoria + firmas)
    const recText =
      selectedEquipments.length > 1
        ? `Se evaluaron ${selectedEquipments.length} equipos en la matriz comparativa. ${this.recommendation()}`
        : this.recommendation();
    const recLines = doc.splitTextToSize(this.pdfSafe(recText), contentW - 8);
    const recH = recLines.length * 4.4 + 8;
    const closingNeed = 12 + recH + 12 + 9 * 2 + 4 + 22;
    ensureSpace(closingNeed);

    const titleNoBreak = (text: string) => {
      y += 2;
      doc.setFillColor(...navy);
      doc.roundedRect(margin, y, contentW, 7, 1.2, 1.2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(this.pdfSafe(text), margin + 3, y + 4.7);
      y += 9.5;
    };

    titleNoBreak('4. RECOMENDACION TECNICA');
    doc.setFillColor(234, 243, 251);
    doc.setDrawColor(201, 215, 232);
    doc.roundedRect(margin, y, contentW, recH, 2, 2, 'FD');
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(recLines, margin + 4, y + 6);
    y += recH + 3;

    titleNoBreak('RESPUESTA DE LA INTERVENTORIA');
    {
      const pairs: [string, string][] = [
        ['Codigo', `${data.code ?? '-'} - ${data.codeLabel}`],
        ['Revisado por', this.reviewedBy()],
        ['Comentarios', this.interventoriaComments() || '-'],
        ['Fecha', new Date().toLocaleDateString('es-CO')],
      ];
      const cols = 2;
      const rows = 2;
      const colW = contentW / cols;
      const rowH = 9;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const [label, value] = pairs[idx];
          const x = margin + c * colW;
          const labelW = Math.min(36, colW * 0.36);
          doc.setFillColor(...soft);
          doc.setDrawColor(...line);
          doc.rect(x, y + r * rowH, labelW, rowH, 'FD');
          doc.setFillColor(255, 255, 255);
          doc.rect(x + labelW, y + r * rowH, colW - labelW, rowH, 'FD');
          doc.setTextColor(...muted);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          doc.text(this.pdfSafe(label.toUpperCase()), x + 2, y + r * rowH + 5.6);
          doc.setTextColor(...ink);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          const lines = doc.splitTextToSize(clamp(value, 50), colW - labelW - 4);
          doc.text(lines[0], x + labelW + 2, y + r * rowH + 5.6);
        }
      }
      y += rows * rowH + 6;
    }

    const sigW = (contentW - 8) / 3;
    ['Elaboro', 'Reviso', 'Aprobo'].forEach((label, i) => {
      const x = margin + i * (sigW + 4);
      doc.setDrawColor(...muted);
      doc.line(x + 4, y + 12, x + sigW - 4, y + 12);
      doc.setTextColor(...muted);
      doc.setFontSize(7.5);
      doc.text(label, x + sigW / 2, y + 17, { align: 'center' });
    });

    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(...line);
      doc.line(margin, 285, pageW - margin, 285);
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text('ProManage Engineering  |  Solicitud de aprobacion de equipos', margin, 291);
      doc.text(`Pagina ${p} de ${pageCount}`, pageW - margin, 291, { align: 'right' });
    }

    doc.save(`${data.fileBase}.pdf`);
  }

  private pdfSafe(text: string): string {
    return text
      .replace(/[—–]/g, '-')
      .replace(/[•·]/g, '-')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
  }

  private exportWord(data: NonNullable<ReturnType<ApprovalsPage['buildExportData']>>): void {
    const rows = this.techRows()
      .map(
        (r) =>
          `<tr><td>${r.feature}</td><td>${r.description}</td><td>${r.material}</td></tr>`,
      )
      .join('');
    const docs = this.attachedDocs()
      .map((d) => `<li>${d}</li>`)
      .join('');

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${data.fileBase}</title></head>
<body style="font-family: Arial, sans-serif; color: #0f2744;">
  <h1 style="text-align:center;">SOLICITUD DE APROBACIÓN DE EQUIPOS</h1>
  <p style="text-align:center;">Código: ${this.docCode()} · Fecha: ${this.displayDate(data.request.date)}</p>
  <h2>1. INFORMACIÓN DEL PROYECTO</h2>
  <p><b>Proyecto:</b> ${data.projectName}<br/>
  <b>Contrato:</b> ${this.contractCode()}<br/>
  <b>Cliente:</b> ${data.project?.client ?? '—'}<br/>
  <b>Ubicación:</b> ${data.project?.location ?? '—'}</p>
  <h2>2. INFORMACIÓN DEL EQUIPO</h2>
  <p><b>Equipo:</b> ${data.eqName}<br/>
  <b>Categoría:</b> ${data.equipment?.category ?? '—'}<br/>
  <b>Fabricante:</b> ${data.equipment?.manufacturer ?? '—'}<br/>
  <b>Modelo:</b> ${data.equipment?.model ?? '—'}<br/>
  <b>Proveedor:</b> ${data.equipment?.supplier ?? '—'}<br/>
  <b>Precio:</b> ${data.equipment ? `$ ${data.equipment.price.toLocaleString('es-CO')}` : '—'}</p>
  <h2>3. ESPECIFICACIONES TÉCNICAS</h2>
  <p><b>Caudal:</b> ${data.equipment?.specs.caudal ?? '—'} L/s ·
  <b>Potencia:</b> ${data.equipment?.specs.potencia ?? '—'} kW ·
  <b>Voltaje:</b> ${data.equipment?.specs.voltaje ?? '—'} V ·
  <b>RPM:</b> ${data.equipment?.specs.rpm ?? '—'}<br/>
  <b>Material:</b> ${data.equipment?.specs.material ?? '—'} ·
  <b>Garantía:</b> ${data.equipment?.specs.garantia ?? '—'} ·
  <b>Entrega:</b> ${data.equipment?.specs.entregaDias ?? '—'} días ·
  <b>Cumplimiento:</b> ${data.equipment?.specs.cumplimiento ?? '—'}%</p>
  <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%;">
    <thead><tr><th>Característica técnica</th><th>Descripción</th><th>Material</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>DOCUMENTOS ADJUNTOS</h2>
  <ul>${docs}</ul>
  <h2>4. RECOMENDACIÓN TÉCNICA</h2>
  <p>${this.recommendation()}</p>
  <h2>RESPUESTA DE LA INTERVENTORÍA</h2>
  <p><b>Código:</b> ${data.code ?? '—'} — ${data.codeLabel}<br/>
  <b>Comentarios:</b> ${this.interventoriaComments() || '—'}<br/>
  <b>Revisado / Aprobado por:</b> ${this.reviewedBy()}<br/>
  <b>Fecha:</b> ${new Date().toLocaleDateString('es-CO')}</p>
  <p style="color:#64748b; font-size:12px;">Documento generado por ProManage Engineering</p>
</body>
</html>`;

    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.fileBase}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
