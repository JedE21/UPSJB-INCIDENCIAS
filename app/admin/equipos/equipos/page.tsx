import { PaginaEntidad } from "@/components/admin/pagina-entidad";

/**
 * ADMIN · EQUIPOS (FASE 7)
 * Inventario de activos: código interno único, serie opcional única,
 * categoría, modelo opcional (cascada marca→modelo), estado de ciclo de vida,
 * adquisición y garantía. La ubicación se gestiona en Asignaciones.
 * RLS: p_equipos_admin.
 */
export default function Page() {
  return <PaginaEntidad grupo="equipos" slug="equipos" />;
}
