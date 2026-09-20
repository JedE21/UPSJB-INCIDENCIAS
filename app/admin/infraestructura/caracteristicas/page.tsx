import { PaginaEntidad } from "@/components/admin/pagina-entidad";

/**
 * ADMIN · CARACTERÍSTICAS DE AMBIENTES (FASE 7)
 * Ficha técnica 1:0..1 por ambiente (tabla ambientes_caracteristicas):
 * capacidad, proyector, computadoras, internet, A/A, pizarra y observaciones.
 * RLS: p_infra_lectura_caract / p_infra_admin_caract.
 */
export default function Page() {
  return <PaginaEntidad grupo="infraestructura" slug="caracteristicas" />;
}
