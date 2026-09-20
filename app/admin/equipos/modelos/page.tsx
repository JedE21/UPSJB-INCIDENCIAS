import { PaginaEntidad } from "@/components/admin/pagina-entidad";

/**
 * ADMIN · MODELOS DE EQUIPOS (FASE 7)
 * Modelos por marca (uq marca+nombre; migración 0015 la re-declara idempotente).
 * RLS: p_cat_modelos_admin.
 */
export default function Page() {
  return <PaginaEntidad grupo="equipos" slug="modelos" />;
}
