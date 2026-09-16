"use client";

import * as React from "react";
import Link from "next/link";
import { BellOff, CircleCheck, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AvisoDemo } from "@/components/shared/aviso-demo";
import { fechaHora } from "@/lib/fechas";
import { NOTIFICACIONES_EJEMPLO } from "@/lib/demo/datos-ejemplo";

/**
 * Bandeja visual de notificaciones (maqueta con datos demo).
 * El marcado real (leída/no leída) y la consulta por usuario llegan con la
 * Fase 9; esta etapa define la estructura y la jerarquía visual.
 *
 * Accesibilidad: las no leídas se distinguen con ICONO + TEXTO ("Nueva") y
 * fondo suave, nunca solo con color (§50).
 */
export function ListaNotificaciones() {
  const [leidas, setLeidas] = React.useState<number[]>([]);
  const pendientes = NOTIFICACIONES_EJEMPLO.filter(
    (n) => n.noLeida && !leidas.includes(n.id)
  ).length;

  const marcarTodas = () => setLeidas(NOTIFICACIONES_EJEMPLO.map((n) => n.id));

  return (
    <div className="flex flex-col gap-4">
      {pendientes > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Tienes {pendientes} notificación{pendientes === 1 ? "" : "es"} sin leer.
          </p>
          <Button variant="outline" size="sm" onClick={marcarTodas}>
            <CircleCheck aria-hidden />
            Marcar todas como leídas
          </Button>
        </div>
      ) : null}

      {NOTIFICACIONES_EJEMPLO.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Sin notificaciones"
          description="Aquí verás las novedades de tus reportes cuando ocurran."
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Listado de notificaciones">
          {NOTIFICACIONES_EJEMPLO.map((n) => {
            const esNoLeida = Boolean(n.noLeida) && !leidas.includes(n.id);
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
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.cuerpo}</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">{fechaHora(n.fecha)}</p>
                  </div>
                </CardContent>
              </Card>
            );

            return (
              <li key={n.id}>
                {n.codigoIncidencia ? (
                  <Link
                    href={`/seguimiento?codigo=${encodeURIComponent(n.codigoIncidencia)}`}
                    className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    aria-label={
                      (esNoLeida ? "Notificación nueva: " : "") +
                      `${n.titulo}. Ver seguimiento de ${n.codigoIncidencia}`
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

      <AvisoDemo />
    </div>
  );
}
