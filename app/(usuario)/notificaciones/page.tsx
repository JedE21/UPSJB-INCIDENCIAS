import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CentroNotificaciones } from "@/components/notificaciones/centro-notificaciones";
import {
  listarNotificaciones,
  listarPreferencias,
  EVENTOS_NOTIFICACION,
} from "@/lib/notificaciones/datos";

export const metadata: Metadata = { title: "Notificaciones" };

/**
 * CENTRO DE NOTIFICACIONES REAL (Fase 9 — Plan §20).
 * La bandeja viene de la tabla `notificaciones` del usuario autenticado
 * (RPC 0018/RLS); las preferencias son opt-out por evento. La lista se
 * refresca sola con Realtime (provider montado en el layout).
 */
export default async function NotificacionesPage() {
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
