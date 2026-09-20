import { PaginaEntidad } from "@/components/admin/pagina-entidad";
import { DialogoAsignarEquipo } from "@/components/admin/equipos/dialogo-asignar-equipo";
import { cargarReferencias } from "@/lib/admin/datos";

/**
 * ADMIN · ASIGNACIONES EQUIPO ↔ AMBIENTE (FASE 7)
 * Ubicación ACTUAL de cada activo (tabla equipos_ambientes): a lo sumo una
 * asignación activa por equipo (uq_asignacion_equipo_activa); al reasignar,
 * el trigger 0003 cierra la anterior y registra el movimiento.
 * RLS: p_equipos_amb_admin.
 */
export default async function Page() {
  // Referencias para el diálogo dedicado de asignación (equipos y ambientes
  // activos). El CRUD genérico carga las suyas por separado.
  const referencias = await cargarReferencias(["equipos", "ambientes"]);

  return (
    <PaginaEntidad
      grupo="equipos"
      slug="asignaciones"
      acciones={
        <DialogoAsignarEquipo
          equipos={referencias.equipos ?? []}
          ambientes={referencias.ambientes ?? []}
        />
      }
    />
  );
}
