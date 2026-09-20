import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ListaAsignadas } from "@/components/tecnico/lista-asignadas";
import { listarIncidenciasAsignadas } from "@/lib/incidencias/datos";

export const metadata: Metadata = { title: "Historial técnico" };

/**
 * HISTORIAL DEL TÉCNICO (§34): incidencias de su asignación que ya salieron
 * del flujo activo (Resueltas —pendientes de cierre—, Cerradas, Canceladas).
 * Reutiliza la lista con filtros; el técnico filtra por estado.
 */
export default async function TecnicoHistorialPage() {
  const asignadas = await listarIncidenciasAsignadas();
  const historicas = asignadas.filter((i) =>
    ["Resuelta", "Cerrada", "Cancelada"].includes(i.estado)
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={History}
        title="Historial de atención"
        description="Incidencias resueltas, cerradas o canceladas de tu asignación."
      />
      <ListaAsignadas incidencias={historicas} />
    </div>
  );
}
