const PROJECT_FOLDERS: Record<string, string> = {
  Documentos: 'documentos-proyecto',
  Planos: 'planos',
  'Fichas Técnicas': 'fichas-tecnicas',
  Cotizaciones: 'cotizaciones',
  Presupuestos: 'presupuestos',
  'Solicitudes de Aprobación': 'solicitudes-aprobacion',
  Fotografías: 'fotografias',
  'Logo cliente': 'logo-cliente',
  Reportes: 'reportes',
};

const EQUIPMENT_FOLDERS: Record<string, string> = {
  imagen: 'imagenes',
  plano: 'planos',
  ficha: 'fichas-tecnicas',
  manual: 'manuales',
  cotizacion: 'cotizaciones',
  otro: 'otros',
};

export const PROJECT_FOLDER_SEGMENTS = [
  'documentos-proyecto',
  'planos',
  'fichas-tecnicas',
  'cotizaciones',
  'presupuestos',
  'solicitudes-aprobacion',
  'fotografias',
  'logo-cliente',
  'reportes',
] as const;

export const EQUIPMENT_FOLDER_SEGMENTS = [
  'imagenes',
  'planos',
  'fichas-tecnicas',
  'manuales',
  'cotizaciones',
  'otros',
] as const;

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'otros';
}

/**
 * Prefijo de storage por tenant.
 * El tenant default (promanage) conserva rutas legacy `proyectos/...` sin prefijo
 * para no romper archivos ya registrados.
 */
export function tenantStoragePrefix(tenantId?: string | null): string {
  if (!tenantId || tenantId === 'promanage') return '';
  return `tenants/${slug(tenantId)}/`;
}

function withTenant(path: string, tenantId?: string | null): string {
  return `${tenantStoragePrefix(tenantId)}${path}`;
}

export function projectDocumentFolderSegment(folder: string): string {
  return PROJECT_FOLDERS[folder] ?? slug(folder);
}

/** Carpeta visible en Firebase: `ptar-barranquilla--a1b2c3d4`. */
export function projectStorageKey(projectId: string, projectName?: string): string {
  if (!projectName?.trim()) return projectId;
  return `${slug(projectName)}--${shortId(projectId)}`;
}

export function equipmentStorageKey(equipmentId: string, equipmentName?: string): string {
  if (!equipmentName?.trim()) return equipmentId;
  return `${slug(equipmentName)}--${shortId(equipmentId)}`;
}

export function projectDocumentStoragePath(
  projectId: string,
  folder: string,
  projectName?: string,
  tenantId?: string | null,
): string {
  return withTenant(
    `proyectos/${projectStorageKey(projectId, projectName)}/${projectDocumentFolderSegment(folder)}`,
    tenantId,
  );
}

export function equipmentFileStoragePath(
  projectId: string,
  equipmentId: string,
  category: string,
  projectName?: string,
  equipmentName?: string,
  tenantId?: string | null,
): string {
  const segment = EQUIPMENT_FOLDERS[category] ?? slug(category);
  return withTenant(
    `proyectos/${projectStorageKey(projectId, projectName)}/equipos/${equipmentStorageKey(equipmentId, equipmentName)}/${segment}`,
    tenantId,
  );
}

export function systemStoragePath(area: string, tenantId?: string | null): string {
  return withTenant(`sistema/${slug(area)}`, tenantId);
}

export function materialStoragePath(materialId: string, tenantId?: string | null): string {
  return withTenant(`materiales/${slug(materialId)}`, tenantId);
}

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extrae la ruta del objeto desde una URL de Firebase Storage. */
export function firebaseObjectPath(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = parsed.pathname.indexOf('/o/');
    if (marker < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(marker + 3));
  } catch {
    return null;
  }
}

/** Convierte `proyectos/{uuid}/...` a `proyectos/{nombre}--{id}/...`. */
export function remapLegacyStoragePath(
  sourcePath: string,
  projectId: string,
  projectName: string | undefined,
  equipment: { id: string; name: string }[],
): string | null {
  const oldPrefix = `proyectos/${projectId}/`;
  if (!sourcePath.startsWith(oldPrefix)) return null;
  let rest = sourcePath.slice(oldPrefix.length);
  if (rest.startsWith('equipos/')) {
    const after = rest.slice('equipos/'.length);
    const slash = after.indexOf('/');
    const equipmentId = slash >= 0 ? after.slice(0, slash) : after;
    const tail = slash >= 0 ? after.slice(slash) : '';
    const match = equipment.find((item) => item.id === equipmentId);
    if (match || UUID_RE.test(equipmentId)) {
      rest = `equipos/${equipmentStorageKey(equipmentId, match?.name)}${tail}`;
    }
  }
  const dest = `proyectos/${projectStorageKey(projectId, projectName)}/${rest}`;
  return dest === sourcePath ? null : dest;
}
