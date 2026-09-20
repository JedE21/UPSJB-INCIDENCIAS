import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ListaAsignadas } from "@/components/tecnico/lista-asignadas";
import { listarIncidenciasAsignadas } from "@/lib/incidencias/datos";

export const metadata: Metadata = { title: "Incidencias asignadas" };

/**
 * MIS INCIDENCIAS DEL TÉCNICO (§34): lista completa de asignaciones activas
 * con búsqueda y filtros (cliente) sobre datos leídos en servidor (RLS).
 */
export default async function TecnicoIncidenciasPage() {
  const asignadas = await listarIncidenciasAsignadas();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title="Incidencias asignadas"
        description="Todas las incidencias con asignación activa a tu nombre. Abre una para atenderla."
      />
      <ListaAsignadas incidencias={asignadas} />
    </div>
  );
}
