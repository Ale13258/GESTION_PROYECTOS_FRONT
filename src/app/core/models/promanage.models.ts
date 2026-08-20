export type EquipmentStatus = 'Registrado' | 'En evaluación' | 'Aprobado' | 'Rechazado' | 'Pendiente';

export type EquipmentFileCategory =
  | 'imagen'
  | 'ficha'
  | 'plano'
  | 'manual'
  | 'cotizacion'
  | 'otro';

export interface EquipmentFile {
  id: string;
  name: string;
  category: EquipmentFileCategory;
  typeLabel: string;
  size: string;
  mimeType: string;
  /** Vista previa local (object URL / data URL) para imágenes */
  previewUrl?: string;
  /** URL pública en Firebase (necesaria para el visor DWG) */
  url?: string;
  /** Archivo nativo pendiente de subir al API */
  nativeFile?: File;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  engineer: string;
  startDate: string;
  status: 'Activo' | 'En revisión' | 'Cerrado';
  progress: number;
  description: string;
}

export interface Equipment {
  id: string;
  projectId: string;
  name: string;
  category: string;
  /** Proceso del listado técnico (ej. Entrada / Canal de aproximación) */
  proceso: string;
  /** Cantidad (puede incluir nota operativa, ej. 2 (1+1 stand-by)) */
  cantidad: string;
  especificacionesTecnicas: string;
  dimensionesCapacidad: string;
  fuenteManual: string;
  nota: string;
  manufacturer: string;
  supplier: string;
  model: string;
  status: EquipmentStatus;
  price: number;
  registeredAt: string;
  image: string;
  specs: {
    caudal: number;
    potencia: number;
    voltaje: number;
    rpm: number;
    material: string;
    garantia: string;
    entregaDias: number;
    cumplimiento: number;
  };
  files: EquipmentFile[];
  history: { date: string; event: string; tone?: 'blue' | 'orange' | 'green' | 'gray' }[];
}

export interface NewEquipmentForm {
  projectId: string;
  proceso: string;
  name: string;
  cantidad: string;
  especificacionesTecnicas: string;
  dimensionesCapacidad: string;
  material: string;
  fuenteManual: string;
  nota: string;
  files: EquipmentFile[];
  imagePreview?: string;
  manufacturer?: string;
  supplier?: string;
  model?: string;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  rating: number;
  contacts: string;
  categories: string[];
  contactName: string;
  email: string;
  phone: string;
}

export interface NewSupplierForm {
  name: string;
  categories: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  rating: number;
}

export interface Quotation {
  id: string;
  projectId: string;
  equipmentId?: string;
  equipmentName: string;
  supplierId?: string;
  supplier: string;
  amount: number;
  status: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'En revisión';
  date: string;
  deliveryDays: number;
  isFinal?: boolean;
}

export interface NewQuotationForm {
  projectId: string;
  equipmentId: string;
  equipmentName: string;
  supplierId: string;
  supplier: string;
  amount: number;
  deliveryDays: number;
  status: Quotation['status'];
  date: string;
}

export type ApprovalStatus = 'Aprobada' | 'En revisión' | 'Rechazada' | 'Borrador';

export interface ApprovalRequest {
  id: string;
  equipmentId: string;
  equipmentIds: string[];
  equipmentName: string;
  projectId: string;
  projectName: string;
  requester: string;
  status: ApprovalStatus;
  date: string;
  notes?: string;
}

export interface DocumentItem {
  id: string;
  projectId: string;
  folder: string;
  name: string;
  type: string;
  size: string;
  updatedAt: string;
  url?: string;
}

export interface DashboardStats {
  activeProjects: number;
  registeredEquipment: number;
  suppliers: number;
  pendingQuotations: number;
  approvedEquipment: number;
  rejectedEquipment: number;
}

/** Rol del sistema: solo admin puede gestionar usuarios. */
export type UserRole = 'admin' | 'collaborator';

export type AppPermission =
  | 'manageUsers'
  | 'manageProjects'
  | 'manageInventory'
  | 'manageSuppliers'
  | 'manageMatrices'
  | 'manageQuotations'
  | 'manageApprovals'
  | 'viewReports'
  | 'manageSettings';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface NewUserForm {
  name: string;
  email: string;
  title: string;
  /** En prototipo se guarda solo como referencia; no hay auth real. */
  password: string;
}
