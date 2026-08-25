/**
 * Contrato backend esperado para SaaS multi-tenant.
 *
 * Auth: user.tenantId, user.features, user.tenant (branding/features).
 * Todo filtrado por tenantId del JWT.
 *
 * Dominios:
 * - promanage.full → equipos de trabajo / ingeniería (inventario técnico, matrices, cotiz. equipos)
 * - materials.quotes → materiales de construcción (inventario/cotizaciones de materiales)
 *
 * Ambos: dashboard, proyectos (docs + presupuesto), proveedores, aprobaciones, reportes.
 */
export const SAAS_BACKEND_CONTRACT = true;
