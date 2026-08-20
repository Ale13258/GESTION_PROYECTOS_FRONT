import { Injectable, computed, signal } from '@angular/core';
import {
  ApprovalRequest,
  DashboardStats,
  DocumentItem,
  Equipment,
  NewEquipmentForm,
  NewQuotationForm,
  NewSupplierForm,
  Project,
  Quotation,
  Supplier,
} from '../models/promanage.models';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly projectsSignal = signal<Project[]>([
    {
      id: 'p1',
      name: 'PTAR Medellín',
      client: 'EPM',
      location: 'Medellín, Antioquia',
      engineer: 'Ing. Laura Restrepo',
      startDate: '2025-11-12',
      status: 'Activo',
      progress: 68,
      description: 'Planta de tratamiento de aguas residuales — ampliación de caudal y modernización de bombeo.',
    },
    {
      id: 'p2',
      name: 'PTAR Cali',
      client: 'Emcali',
      location: 'Cali, Valle del Cauca',
      engineer: 'Ing. Carlos Mejía',
      startDate: '2026-01-08',
      status: 'Activo',
      progress: 32,
      description: 'Sustitución de equipos electromecánicos y actualización documental técnica.',
    },
    {
      id: 'p3',
      name: 'PTAR Bogotá',
      client: 'Acueducto de Bogotá',
      location: 'Bogotá D.C.',
      engineer: 'Ing. Sofía Vargas',
      startDate: '2025-09-20',
      status: 'Cerrado',
      progress: 100,
      description: 'Evaluación comparativa de bombas sumergibles y generación de solicitudes de aprobación.',
    },
  ]);

  private readonly equipmentSignal = signal<Equipment[]>([
    {
      id: 'e1',
      projectId: 'p1',
      name: 'Bomba Sumergible X200',
      category: 'Bombeo',
      proceso: '4. Bombeo de lodos',
      cantidad: '2 (1+1 stand-by)',
      especificacionesTecnicas:
        'Bomba sumergible para transferencia de lodos; operación continua con reserva en stand-by.',
      dimensionesCapacidad: 'Caudal 120 L/s; Potencia 55 kW; Voltaje 460 V; RPM 1750',
      fuenteManual: 'Manual O&M X200, pág. 12',
      nota: 'Equipo aprobado en evaluación comparativa.',
      manufacturer: 'Flygt',
      supplier: 'Hidráulica Andina',
      model: 'X200-55',
      status: 'Aprobado',
      price: 28500000,
      registeredAt: '2026-02-14',
      image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop',
      specs: {
        caudal: 120,
        potencia: 55,
        voltaje: 460,
        rpm: 1750,
        material: 'Acero inoxidable 316',
        garantia: '24 meses',
        entregaDias: 35,
        cumplimiento: 96,
      },
      files: [
        { id: 'f1a', name: 'Ficha_X200.pdf', category: 'ficha', typeLabel: 'Ficha Técnica', size: '1.2 MB', mimeType: 'application/pdf' },
        { id: 'f1b', name: 'Plano_instalacion_X200.dwg', category: 'plano', typeLabel: 'Plano', size: '3.4 MB', mimeType: 'application/acad' },
        { id: 'f1c', name: 'Manual_operacion_X200.pdf', category: 'manual', typeLabel: 'Manual', size: '5.8 MB', mimeType: 'application/pdf' },
        { id: 'f1d', name: 'COT-HA-2026-014.pdf', category: 'cotizacion', typeLabel: 'Cotización', size: '420 KB', mimeType: 'application/pdf' },
      ],
      history: [
        { date: '2026-02-14', event: 'Registrado en el sistema', tone: 'blue' },
        { date: '2026-02-20', event: 'Evaluación técnica completada', tone: 'orange' },
        { date: '2026-03-01', event: 'Estado actual: Aprobado', tone: 'green' },
      ],
    },
    {
      id: 'e2',
      projectId: 'p1',
      name: 'Bomba Centrífuga AquaMax Pro',
      category: 'Bombeo',
      proceso: '4. Bombeo de lodos',
      cantidad: '1',
      especificacionesTecnicas: 'Bomba centrífuga para recirculación; eficiencia energética media.',
      dimensionesCapacidad: 'Caudal 110 L/s; Potencia 45 kW; Voltaje 460 V; RPM 1450',
      fuenteManual: 'Ficha técnica AquaMax, pág. 8',
      nota: '',
      manufacturer: 'KSB',
      supplier: 'Suministros Pacífico',
      model: 'AM-P 80-160',
      status: 'En evaluación',
      price: 24750000,
      registeredAt: '2026-02-18',
      image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop',
      specs: {
        caudal: 110,
        potencia: 45,
        voltaje: 460,
        rpm: 1450,
        material: 'Hierro fundido',
        garantia: '18 meses',
        entregaDias: 28,
        cumplimiento: 88,
      },
      files: [
        { id: 'f2a', name: 'Ficha_AquaMax.pdf', category: 'ficha', typeLabel: 'Ficha Técnica', size: '1.1 MB', mimeType: 'application/pdf' },
        { id: 'f2b', name: 'Plano_AquaMax.pdf', category: 'plano', typeLabel: 'Plano', size: '2.8 MB', mimeType: 'application/pdf' },
        { id: 'f2c', name: 'Manual_AquaMax.pdf', category: 'manual', typeLabel: 'Manual', size: '4.2 MB', mimeType: 'application/pdf' },
        { id: 'f2d', name: 'COT-SP-2026-022.pdf', category: 'cotizacion', typeLabel: 'Cotización', size: '380 KB', mimeType: 'application/pdf' },
      ],
      history: [
        { date: '2026-02-18', event: 'Registrado en el sistema', tone: 'blue' },
        { date: '2026-02-25', event: 'Comparación iniciada', tone: 'orange' },
      ],
    },
    {
      id: 'e3',
      projectId: 'p1',
      name: 'Bomba Helicoidal HydroFlow H7',
      category: 'Bombeo',
      proceso: '3. Filtro percolador (tratamiento biológico)',
      cantidad: '2 (1+1 stand-by)',
      especificacionesTecnicas:
        'Bomba de recirculación de filtro percolador; caudal según diseño biológico.',
      dimensionesCapacidad: 'Potencia 60 kW; Corriente según ficha; Altura máx. 12,5 m',
      fuenteManual: 'Tabla N°3, pág. 21',
      nota: 'Pendiente validar material duplex con cliente.',
      manufacturer: 'Wilo',
      supplier: 'TecnoAguas SAS',
      model: 'H7-W450',
      status: 'Pendiente',
      price: 31200000,
      registeredAt: '2026-03-02',
      image: 'https://images.unsplash.com/photo-1581094794329-cdde17ad13b4?w=400&h=300&fit=crop',
      specs: {
        caudal: 135,
        potencia: 60,
        voltaje: 480,
        rpm: 1800,
        material: 'Acero duplex',
        garantia: '36 meses',
        entregaDias: 45,
        cumplimiento: 92,
      },
      files: [
        { id: 'f3a', name: 'Ficha_H7.pdf', category: 'ficha', typeLabel: 'Ficha Técnica', size: '980 KB', mimeType: 'application/pdf' },
        { id: 'f3b', name: 'Isométrico_H7.pdf', category: 'plano', typeLabel: 'Plano', size: '2.1 MB', mimeType: 'application/pdf' },
        { id: 'f3c', name: 'Manual_H7.pdf', category: 'manual', typeLabel: 'Manual', size: '3.6 MB', mimeType: 'application/pdf' },
        { id: 'f3d', name: 'COT-TA-2026-031.pdf', category: 'cotizacion', typeLabel: 'Cotización', size: '410 KB', mimeType: 'application/pdf' },
      ],
      history: [
        { date: '2026-03-02', event: 'Registrado en el sistema', tone: 'blue' },
        { date: '2026-03-05', event: 'Documentación incompleta — pendiente ficha material', tone: 'orange' },
      ],
    },
    {
      id: 'e4',
      projectId: 'p2',
      name: 'Soplador Roots RB-900',
      category: 'Aireación',
      proceso: '5. Aireación',
      cantidad: '1',
      especificacionesTecnicas: 'Soplador de desplazamiento positivo para aireación de tanques.',
      dimensionesCapacidad: 'Caudal 900 m³/h; Potencia 75 kW; RPM 3600',
      fuenteManual: 'Manual RB-900, pág. 4',
      nota: 'Rechazado por nivel sonoro fuera de especificación.',
      manufacturer: 'Aerzen',
      supplier: 'Aire Industrial',
      model: 'RB-900',
      status: 'Rechazado',
      price: 41800000,
      registeredAt: '2026-01-22',
      image: 'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=400&h=300&fit=crop',
      specs: {
        caudal: 900,
        potencia: 75,
        voltaje: 460,
        rpm: 3600,
        material: 'Fundición',
        garantia: '12 meses',
        entregaDias: 60,
        cumplimiento: 71,
      },
      files: [
        { id: 'f4a', name: 'Ficha_RB900.pdf', category: 'ficha', typeLabel: 'Ficha Técnica', size: '1.0 MB', mimeType: 'application/pdf' },
        { id: 'f4b', name: 'Manual_RB900.pdf', category: 'manual', typeLabel: 'Manual', size: '4.5 MB', mimeType: 'application/pdf' },
        { id: 'f4c', name: 'COT-AI-2026-008.pdf', category: 'cotizacion', typeLabel: 'Cotización', size: '390 KB', mimeType: 'application/pdf' },
      ],
      history: [
        { date: '2026-01-22', event: 'Registrado en el sistema', tone: 'blue' },
        { date: '2026-02-10', event: 'Estado actual: Rechazado — nivel sonoro', tone: 'orange' },
      ],
    },
    {
      id: 'e5',
      projectId: 'p3',
      name: 'Clarificador Circular CC-45',
      category: 'Tratamiento',
      proceso: '6. Clarificación secundaria',
      cantidad: '1',
      especificacionesTecnicas: 'Clarificador circular con mecanismo de rastras y vertedero perimetral.',
      dimensionesCapacidad: 'Diámetro 45 m; Caudal 450 L/s; Potencia 15 kW',
      fuenteManual: 'Num. 6.1, pág. 40',
      nota: '',
      manufacturer: 'Ovivo',
      supplier: 'Procesos del Agua',
      model: 'CC-45',
      status: 'Aprobado',
      price: 67500000,
      registeredAt: '2025-12-05',
      image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop',
      specs: {
        caudal: 450,
        potencia: 15,
        voltaje: 220,
        rpm: 0.5,
        material: 'Acero al carbono + epóxico',
        garantia: '24 meses',
        entregaDias: 90,
        cumplimiento: 94,
      },
      files: [
        { id: 'f5a', name: 'Ficha_CC45.pdf', category: 'ficha', typeLabel: 'Ficha Técnica', size: '1.3 MB', mimeType: 'application/pdf' },
        { id: 'f5b', name: 'GA_CC45.pdf', category: 'plano', typeLabel: 'Plano', size: '4.1 MB', mimeType: 'application/pdf' },
        { id: 'f5c', name: 'Manual_CC45.pdf', category: 'manual', typeLabel: 'Manual', size: '6.2 MB', mimeType: 'application/pdf' },
        { id: 'f5d', name: 'COT-PA-2025-119.pdf', category: 'cotizacion', typeLabel: 'Cotización', size: '450 KB', mimeType: 'application/pdf' },
      ],
      history: [
        { date: '2025-12-05', event: 'Registrado en el sistema', tone: 'blue' },
        { date: '2026-01-15', event: 'Estado actual: Aprobado', tone: 'green' },
      ],
    },
  ]);

  private readonly suppliersSignal = signal<Supplier[]>([
    {
      id: 's1',
      name: 'Hidráulica Andina',
      country: 'Colombia',
      rating: 4.8,
      contacts: 'ventas@hidraulicaandina.com',
      categories: ['Bombeo', 'Válvulas'],
      contactName: 'Laura Restrepo',
      email: 'ventas@hidraulicaandina.com',
      phone: '+57 310 555 0142',
    },
    {
      id: 's2',
      name: 'Suministros Pacífico',
      country: 'Colombia',
      rating: 4.4,
      contacts: 'comercial@sumpacifico.co',
      categories: ['Bombeo', 'Instrumentación'],
      contactName: 'Carlos Mejía',
      email: 'comercial@sumpacifico.co',
      phone: '+57 300 441 2280',
    },
    {
      id: 's3',
      name: 'TecnoAguas SAS',
      country: 'Colombia',
      rating: 4.6,
      contacts: 'info@tecnoaguas.com',
      categories: ['Bombeo', 'Tratamiento'],
      contactName: 'Sofía Vargas',
      email: 'info@tecnoaguas.com',
      phone: '+57 315 889 1022',
    },
    {
      id: 's4',
      name: 'Aire Industrial',
      country: 'México',
      rating: 3.9,
      contacts: 'latam@aireindustrial.mx',
      categories: ['Aireación'],
      contactName: 'Miguel Torres',
      email: 'latam@aireindustrial.mx',
      phone: '+52 55 4488 1200',
    },
    {
      id: 's5',
      name: 'Procesos del Agua',
      country: 'España',
      rating: 4.7,
      contacts: 'export@procesosagua.es',
      categories: ['Tratamiento', 'Clarificación'],
      contactName: 'Ana Beltrán',
      email: 'export@procesosagua.es',
      phone: '+34 910 224 567',
    },
  ]);

  private readonly quotationsSignal = signal<Quotation[]>([
    {
      id: 'q1',
      projectId: 'p1',
      equipmentName: 'Bomba Centrífuga HD-500',
      supplier: 'ELECTROBOMBAS ANDINA',
      amount: 46200000,
      status: 'Rechazada',
      date: '2026-03-12',
      deliveryDays: 50,
    },
    {
      id: 'q2',
      projectId: 'p1',
      equipmentName: 'Bomba Centrífuga HD-500',
      supplier: 'HIDROTÉCNICA S.A.S',
      amount: 48500000,
      status: 'Aprobada',
      date: '2026-03-11',
      deliveryDays: 35,
      isFinal: true,
    },
    {
      id: 'q3',
      projectId: 'p1',
      equipmentName: 'Bomba Centrífuga HD-500',
      supplier: 'SUMINISTROS INDUSTRIALES DEL VALLE',
      amount: 49700000,
      status: 'En revisión',
      date: '2026-03-10',
      deliveryDays: 30,
    },
    {
      id: 'q4',
      projectId: 'p1',
      equipmentName: 'Bomba Sumergible AquaFlow',
      supplier: 'SUMINISTROS INDUSTRIALES DEL VALLE',
      amount: 41200000,
      status: 'En revisión',
      date: '2026-03-14',
      deliveryDays: 48,
    },
    {
      id: 'q5',
      projectId: 'p1',
      equipmentName: 'Bomba Sumergible AquaFlow',
      supplier: 'HIDROTÉCNICA S.A.S',
      amount: 43800000,
      status: 'En revisión',
      date: '2026-03-15',
      deliveryDays: 33,
    },
    {
      id: 'q6',
      projectId: 'p1',
      equipmentName: 'Bomba Helicoidal HydroFlow H7',
      supplier: 'TecnoAguas SAS',
      amount: 31200000,
      status: 'Pendiente',
      date: '2026-03-03',
      deliveryDays: 45,
    },
    {
      id: 'q7',
      projectId: 'p2',
      equipmentName: 'Soplador Roots RB-900',
      supplier: 'Aire Industrial',
      amount: 41800000,
      status: 'Rechazada',
      date: '2026-01-25',
      deliveryDays: 60,
    },
  ]);

  private readonly documentsSignal = signal<DocumentItem[]>([
    {
      id: 'd1',
      projectId: 'p1',
      folder: 'Documentos',
      name: 'Memoria_descriptiva_PTAR.pdf',
      type: 'PDF',
      size: '2.4 MB',
      updatedAt: '2026-02-10',
    },
    {
      id: 'd2',
      projectId: 'p1',
      folder: 'Planos',
      name: 'Planta_general_bombeo.dwg',
      type: 'DWG',
      size: '8.1 MB',
      updatedAt: '2026-02-12',
    },
    {
      id: 'd3',
      projectId: 'p1',
      folder: 'Fichas Técnicas',
      name: 'FT_Bomba_X200.pdf',
      type: 'PDF',
      size: '1.1 MB',
      updatedAt: '2026-02-15',
    },
    {
      id: 'd4',
      projectId: 'p1',
      folder: 'Cotizaciones',
      name: 'COT-HA-2026-014.pdf',
      type: 'PDF',
      size: '420 KB',
      updatedAt: '2026-02-16',
    },
    {
      id: 'd5',
      projectId: 'p1',
      folder: 'Solicitudes de Aprobación',
      name: 'SAE-PTAR-MED-001.docx',
      type: 'DOCX',
      size: '890 KB',
      updatedAt: '2026-03-01',
    },
    {
      id: 'd6',
      projectId: 'p1',
      folder: 'Fotografías',
      name: 'Sitio_visita_01.jpg',
      type: 'JPG',
      size: '3.2 MB',
      updatedAt: '2026-01-28',
    },
  ]);

  private readonly approvalsSignal = signal<ApprovalRequest[]>([
    {
      id: 'a1',
      equipmentId: 'e2',
      equipmentName: 'Bomba Centrífuga HD-500',
      projectId: 'p1',
      projectName: 'PTAR Medellín',
      requester: 'Ing. Andrés Torres',
      status: 'Aprobada',
      date: '2026-03-10',
      notes: 'Equipo evaluado conforme a especificaciones del proyecto.',
    },
    {
      id: 'a2',
      equipmentId: 'e3',
      equipmentName: 'Motor Eléctrico IE3',
      projectId: 'p2',
      projectName: 'PTAR Cali',
      requester: 'Ing. Andrés Torres',
      status: 'En revisión',
      date: '2026-03-12',
      notes: 'Pendiente validación de ficha técnica y cotización final.',
    },
  ]);

  readonly searchQuery = signal('');
  readonly selectedEquipmentIds = signal<string[]>([]);

  readonly projects = this.projectsSignal.asReadonly();
  readonly equipment = this.equipmentSignal.asReadonly();
  readonly suppliers = this.suppliersSignal.asReadonly();
  readonly quotations = this.quotationsSignal.asReadonly();
  readonly documents = this.documentsSignal.asReadonly();
  readonly approvals = this.approvalsSignal.asReadonly();

  readonly stats = computed<DashboardStats>(() => {
    const equipment = this.equipmentSignal();
    return {
      activeProjects: this.projectsSignal().filter((p) => p.status === 'Activo').length,
      registeredEquipment: equipment.length,
      suppliers: this.suppliersSignal().length,
      pendingQuotations: this.quotationsSignal().filter(
        (q) => q.status === 'Pendiente' || q.status === 'En revisión',
      ).length,
      approvedEquipment: equipment.filter((e) => e.status === 'Aprobado').length,
      rejectedEquipment: equipment.filter((e) => e.status === 'Rechazado').length,
    };
  });

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

  addProject(project: Omit<Project, 'id'>): Project {
    const created: Project = { ...project, id: `p${Date.now()}` };
    this.projectsSignal.update((list) => [created, ...list]);
    return created;
  }

  addSupplier(form: NewSupplierForm): Supplier {
    const categories = form.categories
      .split(/[,/|]/)
      .map((c) => c.trim())
      .filter(Boolean);
    const created: Supplier = {
      id: `s${Date.now()}`,
      name: form.name.trim(),
      country: form.country.trim() || 'Colombia',
      rating: Number.isFinite(form.rating) ? Math.min(5, Math.max(0, form.rating)) : 0,
      contacts: form.email.trim(),
      categories: categories.length ? categories : ['General'],
      contactName: form.contactName.trim() || 'Por definir',
      email: form.email.trim(),
      phone: form.phone.trim(),
    };
    this.suppliersSignal.update((list) => [created, ...list]);
    return created;
  }

  addQuotation(form: NewQuotationForm): Quotation {
    const created: Quotation = {
      id: `q${Date.now()}`,
      projectId: form.projectId,
      equipmentName: form.equipmentName.trim(),
      supplier: form.supplier.trim(),
      amount: Number(form.amount) || 0,
      status: form.status,
      date: form.date || new Date().toISOString().slice(0, 10),
      deliveryDays: Number(form.deliveryDays) || 0,
    };
    this.quotationsSignal.update((list) => [created, ...list]);
    return created;
  }

  getApproval(id: string): ApprovalRequest | undefined {
    return this.approvalsSignal().find((a) => a.id === id);
  }

  addApprovalFromSelection(requester = 'Ing. Andrés Torres'): ApprovalRequest | null {
    const selected = this.getSelectedEquipment();
    const eq = selected[0] ?? this.equipmentSignal()[0];
    if (!eq) return null;
    const project = this.getProject(eq.projectId);
    const created: ApprovalRequest = {
      id: `a${Date.now()}`,
      equipmentId: eq.id,
      equipmentName: eq.name,
      projectId: eq.projectId,
      projectName: project?.name ?? 'Sin proyecto',
      requester,
      status: 'En revisión',
      date: new Date().toISOString().slice(0, 10),
      notes: 'Solicitud generada automáticamente desde la matriz comparativa.',
    };
    this.approvalsSignal.update((list) => [created, ...list]);
    return created;
  }

  equipmentCountBySupplier(supplierName: string): number {
    return this.equipmentSignal().filter((e) => e.supplier === supplierName).length;
  }

  addEquipment(form: NewEquipmentForm): Equipment {
    const material = form.material.trim() || 'Por definir';
    const image =
      form.imagePreview ||
      form.files.find((f) => f.category === 'imagen' && f.previewUrl)?.previewUrl ||
      'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop';
    const created: Equipment = {
      id: `e${Date.now()}`,
      projectId: form.projectId,
      name: form.name.trim(),
      category: form.proceso.trim() || 'Sin proceso',
      proceso: form.proceso.trim(),
      cantidad: form.cantidad.trim() || '1',
      especificacionesTecnicas: form.especificacionesTecnicas.trim(),
      dimensionesCapacidad: form.dimensionesCapacidad.trim(),
      fuenteManual: form.fuenteManual.trim(),
      nota: form.nota.trim(),
      manufacturer: 'Por definir',
      supplier: 'Por definir',
      model: 'N/D',
      status: 'Registrado',
      price: 20000000 + Math.floor(Math.random() * 30000000),
      registeredAt: new Date().toISOString().slice(0, 10),
      image,
      specs: {
        caudal: 80 + Math.floor(Math.random() * 60),
        potencia: 30 + Math.floor(Math.random() * 40),
        voltaje: 440,
        rpm: 1450 + Math.floor(Math.random() * 400),
        material,
        garantia: '24 meses',
        entregaDias: 25 + Math.floor(Math.random() * 30),
        cumplimiento: 75 + Math.floor(Math.random() * 20),
      },
      files: [...form.files],
      history: [
        {
          date: new Date().toISOString().slice(0, 10),
          event: 'Registrado en el sistema',
          tone: 'blue',
        },
        ...(form.files.length
          ? [
              {
                date: new Date().toISOString().slice(0, 10),
                event: `${form.files.length} archivo(s) adjunto(s)`,
                tone: 'orange' as const,
              },
            ]
          : []),
      ],
    };
    this.equipmentSignal.update((list) => [created, ...list]);
    return created;
  }

  updateEquipmentNote(id: string, nota: string): void {
    this.equipmentSignal.update((list) =>
      list.map((item) => (item.id === id ? { ...item, nota: nota.trim() } : item)),
    );
  }

  addEquipmentFiles(id: string, files: Equipment['files']): Equipment | undefined {
    let updated: Equipment | undefined;
    this.equipmentSignal.update((list) =>
      list.map((item) => {
        if (item.id !== id) return item;
        const imageFromUpload = files.find((f) => f.category === 'imagen' && f.previewUrl)?.previewUrl;
        updated = {
          ...item,
          image: imageFromUpload || item.image,
          files: [...files, ...item.files],
          history: [
            {
              date: new Date().toISOString().slice(0, 10),
              event: `Archivos cargados: ${files.map((f) => f.name).join(', ')}`,
              tone: 'orange',
            },
            ...item.history,
          ],
        };
        return updated;
      }),
    );
    return updated;
  }

  getEquipmentById(id: string): Equipment | undefined {
    return this.equipmentSignal().find((e) => e.id === id);
  }

  addDocument(doc: Omit<DocumentItem, 'id'>): void {
    this.documentsSignal.update((list) => [{ ...doc, id: `d${Date.now()}` }, ...list]);
  }

  toggleCompareEquipment(id: string): void {
    this.selectedEquipmentIds.update((ids) => {
      if (ids.includes(id)) {
        return ids.filter((x) => x !== id);
      }
      if (ids.length >= 3) {
        return ids;
      }
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
      comparisons: Math.max(1, Math.floor(equipment.length / 2)),
      avgAnalysisDays: 4.5,
    };
  }
}
