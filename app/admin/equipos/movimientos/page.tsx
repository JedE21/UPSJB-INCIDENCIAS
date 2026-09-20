import { PaginaEntidad } from "@/components/admin/pagina-entidad";

/**
 * ADMIN · MOVIMIENTOS DE EQUIPOS (FASE 7)
 * Historial de ubicaciones (tabla movimientos_equipos): asignación, traslado,
 * mantenimiento y baja. La fila con fecha_hasta NULL es la ubicación vigente.
 * Lo escribe el trigger sincronizar_movimientos_equipo (0003); la app solo
 * lo consulta (append-only de facto).
 * RLS: p_movimientos_admin.
 */
export default function Page() {
  return <PaginaEntidad grupo="equipos" slug="movimientos" />;
}
