import { PaginaEntidad } from "@/components/admin/pagina-entidad";

/**
 * ADMIN · TIPOS DE AMBIENTE (FASE 7)
 * Catálogo del Plan Maestro: Aula, Laboratorio, Oficina, Auditorio,
 * Biblioteca, Baño, Taller, Almacén, Otro (semilla 0005; editable por el
 * admin, Regla 10). RLS: p_infra_admin_tipos.
 */
export default function Page() {
  return <PaginaEntidad grupo="infraestructura" slug="tipos-ambiente" />;
}
