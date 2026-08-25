import {
  AppPermission,
  AppUser,
  ApprovalRequest,
  DEFAULT_TENANT_FEATURES,
  DEFAULT_TENANT_ID,
  DocumentItem,
  Equipment,
  EquipmentFile,
  EquipmentFileCategory,
  EquipmentStatus,
  Material,
  MaterialCategory,
  MaterialQuote,
  Project,
  Quotation,
  Supplier,
  TenantFeature,
  TenantInfo,
  UserRole,
} from '../models/promanage.models';

export interface TenantDto {
  id: string;
  name: string;
  slug?: string;
  features?: TenantFeature[];
  branding?: {
    name?: string;
    tagline?: string;
    logoUrl?: string;
  };
}

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: UserRole;
  active: boolean;
  mustSetPassword?: boolean;
  createdAt: string;
  updatedAt?: string;
  permissions?: AppPermission[];
  inviteEmailSent?: boolean;
  inviteUrl?: string;
  /** Presente cuando el backend ya es multi-tenant. */
  tenantId?: string;
  tenant?: TenantDto;
  features?: TenantFeature[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
  tenant?: TenantDto;
}

export interface NamedRef {
  id: string;
  name?: string;
  email?: string;
}

export function mapTenant(dto?: TenantDto | null, fallbackUser?: AuthUserDto): TenantInfo {
  const id = dto?.id || fallbackUser?.tenantId || DEFAULT_TENANT_ID;
  const features =
    dto?.features?.length
      ? dto.features
      : fallbackUser?.features?.length
        ? fallbackUser.features
        : [...DEFAULT_TENANT_FEATURES];
  const name = dto?.name || (id === DEFAULT_TENANT_ID ? 'ProManage Engineering' : id);
  return {
    id,
    name,
    slug: dto?.slug || id,
    features,
    branding: dto?.branding
      ? {
          name: dto.branding.name || name,
          tagline: dto.branding.tagline,
          logoUrl: dto.branding.logoUrl,
        }
      : undefined,
  };
}

export function mapUser(dto: AuthUserDto): AppUser {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: dto.role,
    title: dto.title ?? '',
    active: dto.active,
    mustSetPassword: Boolean(dto.mustSetPassword),
    createdAt: String(dto.createdAt).slice(0, 10),
    createdBy: '',
    tenantId: dto.tenantId || dto.tenant?.id || DEFAULT_TENANT_ID,
  };
}

export function mapMaterialCategory(dto: {
  id: string;
  tenantId?: string;
  name: string;
  description?: string | null;
  active?: boolean;
}): MaterialCategory {
  return {
    id: dto.id,
    tenantId: dto.tenantId || DEFAULT_TENANT_ID,
    name: dto.name,
    description: dto.description ?? '',
    active: dto.active !== false,
  };
}

export function mapMaterial(dto: {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  categoryId?: string | null;
  description?: string | null;
  price?: number | string | null;
  stockQty?: number | string | null;
  active?: boolean;
}): Material {
  return {
    id: dto.id,
    tenantId: dto.tenantId || DEFAULT_TENANT_ID,
    code: dto.code,
    name: dto.name,
    unit: dto.unit,
    category: dto.category,
    categoryId: dto.categoryId || undefined,
    description: dto.description ?? '',
    price: Number(dto.price) || 0,
    stockQty: Number(dto.stockQty) || 0,
    active: dto.active !== false,
  };
}

export function mapMaterialQuote(dto: {
  id: string;
  tenantId?: string;
  materialId: string;
  materialName?: string;
  materialCode?: string;
  material?: { id?: string; name?: string; code?: string; unit?: string };
  supplierId?: string | null;
  supplier?: string | { id?: string; name?: string };
  unitPrice: number;
  quantity: number;
  amount?: number;
  unit?: string;
  status: MaterialQuote['status'];
  date: string;
  deliveryDays?: number;
  notes?: string | null;
  isFinal?: boolean;
}): MaterialQuote {
  const supplierName =
    typeof dto.supplier === 'string' ? dto.supplier : (dto.supplier?.name ?? '—');
  const supplierId =
    dto.supplierId || (typeof dto.supplier === 'object' ? dto.supplier?.id : undefined);
  const unitPrice = Number(dto.unitPrice) || 0;
  const quantity = Number(dto.quantity) || 0;
  return {
    id: dto.id,
    tenantId: dto.tenantId || DEFAULT_TENANT_ID,
    materialId: dto.materialId || dto.material?.id || '',
    materialName: dto.materialName || dto.material?.name || '—',
    materialCode: dto.materialCode || dto.material?.code || '',
    supplierId,
    supplier: supplierName,
    unitPrice,
    quantity,
    amount: dto.amount != null ? Number(dto.amount) : unitPrice * quantity,
    unit: dto.unit || dto.material?.unit || 'und',
    status: dto.status,
    date: String(dto.date).slice(0, 10),
    deliveryDays: Number(dto.deliveryDays) || 0,
    notes: dto.notes ?? undefined,
    isFinal: dto.isFinal,
  };
}

export function mapProject(dto: {
  id: string;
  name: string;
  client: string;
  location: string;
  engineer?: string | NamedRef;
  startDate: string;
  status: Project['status'];
  progress?: number;
  description?: string | null;
}): Project {
  const engineer =
    typeof dto.engineer === 'string' ? dto.engineer : (dto.engineer?.name ?? 'Por asignar');
  return {
    id: dto.id,
    name: dto.name,
    client: dto.client,
    location: dto.location,
    engineer,
    startDate: String(dto.startDate).slice(0, 10),
    status: dto.status,
    progress: dto.progress ?? 0,
    description: dto.description ?? '',
  };
}

const FILE_LABELS: Record<EquipmentFileCategory, string> = {
  imagen: 'Imagen visual',
  ficha: 'Ficha Técnica',
  plano: 'Plano',
  manual: 'Manual',
  cotizacion: 'Presupuesto',
  otro: 'Otro',
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapEquipmentFile(dto: {
  id: string;
  name: string;
  category: EquipmentFileCategory;
  type?: string;
  size?: number;
  url?: string;
  storageKey?: string;
}): EquipmentFile {
  const remote = dto.url || (dto.storageKey?.startsWith('http') ? dto.storageKey : undefined);
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    typeLabel: FILE_LABELS[dto.category] ?? 'Archivo',
    size: formatBytes(Number(dto.size) || 0),
    mimeType: dto.type ?? 'application/octet-stream',
    url: remote,
  };
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const TONE_MAP: Record<string, Equipment['history'][number]['tone']> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  danger: 'gray',
};

export function mapEquipment(dto: Record<string, unknown>): Equipment {
  const specs = (dto['specs'] as Record<string, unknown> | undefined) ?? {};
  const supplier = dto['supplier'] as NamedRef | null | undefined;
  const files = Array.isArray(dto['files']) ? dto['files'].map(mapEquipmentFile) : [];
  const history = Array.isArray(dto['history'])
    ? dto['history'].map((ev: { date?: string; event?: string; tone?: string }) => ({
        date: String(ev.date ?? '').slice(0, 10),
        event: ev.event ?? '',
        tone: TONE_MAP[ev.tone ?? ''] ?? 'blue',
      }))
    : [];

  return {
    id: String(dto['id']),
    projectId: String(dto['projectId']),
    name: String(dto['name'] ?? ''),
    category: String(dto['proceso'] ?? ''),
    categoryId: dto['categoryId'] ? String(dto['categoryId']) : undefined,
    proceso: String(dto['proceso'] ?? ''),
    cantidad: '',
    especificacionesTecnicas: specs['caudal'] != null ? String(specs['caudal']) : '',
    dimensionesCapacidad: '',
    fuenteManual: '',
    nota: String(dto['nota'] ?? ''),
    manufacturer: String(dto['model'] ?? 'Por definir'),
    supplier: supplier?.name ?? 'Por definir',
    model: String(dto['model'] ?? 'N/D'),
    status: (dto['status'] as EquipmentStatus) ?? 'Registrado',
    price: num(dto['precio']),
    registeredAt: String(dto['createdAt'] ?? '').slice(0, 10),
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop',
    specs: {
      caudal: num(specs['caudal']),
      potencia: num(specs['potencia']),
      voltaje: num(specs['voltaje']),
      rpm: num(specs['rpm']),
      material: String(specs['material'] ?? ''),
      garantia: String(specs['garantia'] ?? ''),
      entregaDias: num(specs['entregaDias']),
      cumplimiento: num(specs['cumplimiento']),
    },
    files,
    history,
  };
}

export function mapSupplier(dto: {
  id: string;
  name: string;
  country?: string;
  rating?: number;
  categories?: string[];
  contactName?: string;
  email?: string;
  phone?: string | null;
}): Supplier {
  return {
    id: dto.id,
    name: dto.name,
    country: dto.country ?? 'Colombia',
    rating: dto.rating ?? 0,
    contacts: dto.email ?? '',
    categories: dto.categories?.length ? dto.categories : ['General'],
    contactName: dto.contactName ?? '',
    email: dto.email ?? '',
    phone: dto.phone ?? '',
  };
}

export function mapQuotation(dto: {
  id: string;
  projectId: string;
  equipmentId?: string;
  equipmentName: string;
  supplierId?: string;
  supplier?: NamedRef | string | null;
  amount: number;
  status: Quotation['status'];
  date: string;
  deliveryDays: number;
  isFinal?: boolean;
}): Quotation {
  const supplierName =
    typeof dto.supplier === 'string' ? dto.supplier : (dto.supplier?.name ?? '');
  return {
    id: dto.id,
    projectId: dto.projectId,
    equipmentId: dto.equipmentId,
    equipmentName: dto.equipmentName,
    supplierId: dto.supplierId,
    supplier: supplierName,
    amount: Number(dto.amount) || 0,
    status: dto.status,
    date: String(dto.date).slice(0, 10),
    deliveryDays: dto.deliveryDays,
    isFinal: dto.isFinal,
  };
}

export function mapDocument(dto: {
  id: string;
  projectId: string;
  folder: string;
  name: string;
  type: string;
  size: number | string;
  updatedAt: string;
  url?: string;
}): DocumentItem {
  const sizeNum = typeof dto.size === 'number' ? dto.size : Number(dto.size);
  const type = dto.type?.includes('/') ? dto.name.split('.').pop()?.toUpperCase() || 'FILE' : dto.type;
  return {
    id: dto.id,
    projectId: dto.projectId,
    folder: dto.folder,
    name: dto.name,
    type,
    size: Number.isFinite(sizeNum) ? formatBytes(sizeNum) : String(dto.size),
    updatedAt: String(dto.updatedAt).slice(0, 10),
    url: dto.url,
  };
}

export function mapApproval(
  dto: {
    id: string;
    equipmentId: string;
    equipmentIds?: string[];
    projectId: string;
    requesterId?: string;
    requester?: NamedRef | string | null;
    status: ApprovalRequest['status'];
    createdAt?: string;
    notes?: string | null;
    equipment?: { name?: string } | null;
    project?: { name?: string } | null;
  },
  fallback?: { equipmentName?: string; projectName?: string },
): ApprovalRequest {
  const requester =
    typeof dto.requester === 'string' ? dto.requester : (dto.requester?.name ?? '—');
  const equipmentIds =
    dto.equipmentIds?.length ? dto.equipmentIds : dto.equipmentId ? [dto.equipmentId] : [];
  return {
    id: dto.id,
    equipmentId: dto.equipmentId || equipmentIds[0] || '',
    equipmentIds,
    equipmentName: dto.equipment?.name ?? fallback?.equipmentName ?? '',
    projectId: dto.projectId,
    projectName: dto.project?.name ?? fallback?.projectName ?? '',
    requester,
    status: dto.status,
    date: String(dto.createdAt ?? '').slice(0, 10),
    notes: dto.notes ?? undefined,
  };
}
