import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GestionIncidenciasAdmin } from "@/components/admin/incidencias/gestion-incidencias";
import { listarIncidenciasAdmin } from "@/lib/admin/datos-incidencias";
import { mensajeDeLectura } from "@/lib/admin/guardia";

export const metadata: Metadata = { title: "Incidencias — Admin" };

/**
 * ADMIN · GESTIÓN TOTAL DE INCIDENCIAS (FASE 7 — RPC 0022)
 *
 * CRUD completo para el ADMINISTRADOR:
 *   · Leer: listado completo del sistema (RLS p_incidencias_select admin).
 *   · Crear: modal (RPC incidencias_admin_crear; código generado por trigger).
 *   · Editar: modal (RPC incidencias_admin_actualizar; historial + auditoría).
 *   · Eliminar: confirmación destructiva (RPC incidencias_admin_eliminar;
 *     snapshot en registros_auditoria + limpieza de evidencias del bucket).
 *
 * La gestión operativa del flujo (derivar/asignar/estados) vive en la vista
 * de detalle /seguimiento (PanelGestion), que el admin también puede usar.
 */
export default async function AdminIncidenciasPage() {
  const [listado] = await Promise.all([
    listarIncidenciasAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        title="Incidencias"
        description="Gestión completa del sistema: crea, edita y elimina incidencias. El flujo operativo (derivar/asignar/estados) se gestiona desde el detalle de cada reporte."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todas las incidencias</CardTitle>
          <CardDescription>
            Busca por código, ambiente o reportante; filtra por estado. La eliminación es
            definitiva y queda registrada en la auditoría.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GestionIncidenciasAdmin
            filas={listado.filas}
            errorCarga={listado.error ? mensajeDeLectura({ message: listado.error }) : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
