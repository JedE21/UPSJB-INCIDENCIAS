import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ListaNotificaciones } from "@/components/usuario/lista-notificaciones";

export const metadata: Metadata = { title: "Notificaciones" };

/**
 * NOTIFICACIONES — estructura visual (maqueta).
 * La bandeja real se alimentará de la tabla `notificaciones` (Fase 9 del Plan
 * Maestro, adelantada como estructura en esta etapa).
 */
export default function NotificacionesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="Notificaciones"
        description="Novedades de tus reportes: cambios de estado, asignaciones y comentarios."
      />
      <ListaNotificaciones />
    </div>
  );
}
