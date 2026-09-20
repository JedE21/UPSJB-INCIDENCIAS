"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellOff,
  CircleCheck,
  FileSearch,
  Loader2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/incidencias/badges";
import { useToast } from "@/components/ui/toast";
import { fechaHora } from "@/lib/fechas";
import { useNotificacionesRealtime } from "@/lib/notificaciones/realtime";
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  alternarPreferencia,
} from "@/lib/notificaciones/actions";
import type {
  NotificacionItem,
  PreferenciaNotificacion,
} from "@/lib/notificaciones/datos";

/**
 * Centro de notificaciones REAL (Fase 9, Plan §20.1): bandeja de la tabla
 * `notificaciones` del usuario autenticado (RLS). Marcar leída / todas y las
 * preferencias llaman Server Actions que revalidan en BD. La lista se
 * actualiza sola cuando Realtime avisa (via RealtimeRefresher → refresh).
 */
export function CentroNotificaciones({
  notificaciones,
  preferencias,
}: {
  notificaciones: NotificacionItem[];
  preferencias: PreferenciaNotificacion[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { noLeidas, ponerTodoLeido } = useNotificacionesRealtime();
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const [mostrarPreferencias, setMostrarPreferencias] = React.useState(false);

  const sinLeerLocal = notificaciones.filter((n) => !n.leida_en).length;

  const alMarcarLeida = async (id: string) => {
    setOcupado(id);
    try {
      const res = await marcarNotificacionLeida(id);
      if (res.error) {
        toast({ title: "No se pudo actualizar", description: res.error, variant: "destructive" });
      } else {
        router.refresh();
      }
    } finally {
      setOcupado(null);
    }
  };

  const alMarcarTodas = async () => {
    setOcupado("todas");
    try {
      const res = await marcarTodasLeidas();
      if (res.error) {
        toast({ title: "No se pudo actualizar", description: res.error, variant: "destructive" });
      } else {
        ponerTodoLeido(); // optimista; realtime descuenta el resto
        toast({ title: "Notificaciones marcadas como leídas", variant: "success" });
        router.refresh();
      }
    } finally {
      setOcupado(null);
    }
  };

  const alAlternarPreferencia = async (evento: string, habilitado: boolean) => {
    const res = await alternarPreferencia(evento, habilitado);
    if (res.error) {
      toast({ title: "No se pudo guardar", description: res.error, variant: "destructive" });
    } else {
      router.refresh();
    }
  };

  const pendientes = Math.max(noLeidas, sinLeerLocal);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {pendientes > 0
            ? `Tienes ${pendientes} notificación${pendientes === 1 ? "" : "es"} sin leer.`
            : "Estás al día: no tienes notificaciones sin leer."}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMostrarPreferencias((v) => !v)}
            aria-expanded={mostrarPreferencias}
          >
            <Settings2 aria-hidden />
            Preferencias
          </Button>
          {pendientes > 0 ? (
            <Button variant="outline" size="sm" onClick={alMarcarTodas} disabled={ocupado !== null}>
              {ocupado === "todas" ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
              Marcar todas como leídas
            </Button>
          ) : null}
        </div>
      </div>

      {mostrarPreferencias ? (
        <Card>
          <CardContent className="px-4 py-4">
            <p className="text-sm font-medium">Qué quieres recibir</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Estas preferencias aplican a las notificaciones internas del sistema. Los eventos
              del flujo las respetan en la base de datos (opt-out por evento).
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {preferencias.map((p) => (
                <li
                  key={p.evento}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <label
                    htmlFor={`pref-${p.evento}`}
                    className="min-w-0 flex-1 cursor-pointer text-sm"
                  >
                    {ETIQUETAS_EVENTO[p.evento] ?? p.evento}
                  </label>
                  <input
                    id={`pref-${p.evento}`}
                    type="checkbox"
                    role="switch"
                    checked={p.habilitado}
                    onChange={(e) => alAlternarPreferencia(p.evento, e.target.checked)}
                    className="size-4 accent-[var(--primary)]"
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {notificaciones.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Sin notificaciones"
          description="Aquí verás las novedades de tus reportes y asignaciones cuando ocurran."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Listado de notificaciones">
          {notificaciones.map((n) => {
            const esNoLeida = !n.leida_en;
            const contenido = (
              <Card
                className={
                  "gap-2 py-4 transition-colors" +
                  (esNoLeida ? " border-primary/30 bg-primary/[0.04]" : " hover:bg-accent/40")
                }
              >
                <CardContent className="flex items-start gap-3 px-4">
                  <span
                    className={
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full " +
                      (esNoLeida ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                    }
                    aria-hidden
                  >
                    {esNoLeida ? <CircleCheck className="size-4" /> : <FileSearch className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{n.titulo}</p>
                      {esNoLeida ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Nueva
                        </span>
                      ) : null}
                      {n.estado_incidencia ? <StatusBadge estado={n.estado_incidencia} /> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.cuerpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">{fechaHora(n.creado_en)}</p>
                  </div>
                  {esNoLeida ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => alMarcarLeida(n.id)}
                      disabled={ocupado === n.id}
                      aria-label={`Marcar como leída: ${n.titulo}`}
                    >
                      {ocupado === n.id ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <CircleCheck aria-hidden />
                      )}
                      Marcar leída
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );

            return (
              <li key={n.id}>
                {n.codigo_incidencia ? (
                  <Link
                    href={`/seguimiento?codigo=${encodeURIComponent(n.codigo_incidencia)}`}
                    className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    aria-label={
                      (esNoLeida ? "Notificación nueva: " : "") +
                      `${n.titulo}. Ver seguimiento de ${n.codigo_incidencia}`
                    }
                  >
                    {contenido}
                  </Link>
                ) : (
                  contenido
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Etiquetas legibles de los eventos (misma lista que lib/notificaciones/datos). */
const ETIQUETAS_EVENTO: Record<string, string> = {
  nueva_incidencia: "Mis reportes registrados",
  asignada: "Incidencias asignadas a mí",
  derivada: "Mis incidencias derivadas de área",
  en_proceso: "Cambios a «En proceso»",
  en_espera: "Cambios a «En espera»",
  resuelta: "Incidencias resueltas",
  cerrada: "Incidencias cerradas",
  cancelada: "Incidencias canceladas",
  comentario: "Comentarios en mis incidencias",
  sla_alerta: "Alertas de SLA (si atiendo incidencias)",
};
