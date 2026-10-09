import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CentroNotificaciones } from "@/components/notificaciones/centro-notificaciones";
import {
  listarNotificaciones,
  listarPreferencias,
  EVENTOS_NOTIFICACION,
} from "@/lib/notificaciones/datos";

export const metadata: Metadata = { title: "Notificaciones · Admin" };

/**
 * NOTIFICACIONES DEL PANEL ADMIN.
 * La bandeja del propio ADMINISTRADOR (misma lógica que /notificaciones del
 * panel usuario): RPC 0018 con el JWT del usuario + RLS fila por fila.
 * El admin tiene acceso total (layout: exigirPanel con excepción admin), así
 * que crea aquí SU bandeja personal sin duplicar código.
 */
export default async function AdminNotificacionesPage() {
  const [notificaciones, preferenciasGuardadas] = await Promise.all([
    listarNotificaciones({ limite: 50 }),
    listarPreferencias(),
  ]);

  // Sin fila en preferencias = habilitado (default de la BD).
  const guardadas = new Map(preferenciasGuardadas.map((p) => [p.evento, p.habilitado]));
  const preferencias = EVENTOS_NOTIFICACION.map((e) => ({
    evento: e.evento,
    habilitado: guardadas.get(e.evento) ?? true,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="Notificaciones"
        description="Novedades de tus reportes: cambios de estado, asignaciones, derivaciones y comentarios."
      />
      <CentroNotificaciones notificaciones={notificaciones} preferencias={preferencias} />
    </div>
  );
}
