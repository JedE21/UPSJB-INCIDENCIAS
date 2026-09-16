"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, DoorOpen, MapPin, Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/incidencias/badges";
import { ProgresoEstado } from "@/components/incidencias/progreso-estado";
import { Timeline } from "@/components/shared/timeline";
import { AvisoDemo } from "@/components/shared/aviso-demo";
import { fechaHora } from "@/lib/fechas";
import {
  HISTORIAL_EJEMPLO,
  INCIDENCIAS_EJEMPLO,
} from "@/lib/demo/datos-ejemplo";

const PATRON_CODIGO = "INC-AAAA-NNNNNN";

/**
 * VistaSeguimiento (§30 del Plan Maestro) — maqueta visual del seguimiento.
 * Muestra código, estado, ambiente, fecha, historial e información relevante.
 *
 * Integración (Fase 6): el envío navega a la misma página con ?codigo=…;
 * cuando exista la lógica, un Server Component leerá la incidencia real por
 * código y el historial vendrá de `incidencia_historial`.
 */
export function VistaSeguimiento({ codigoInicial }: { codigoInicial?: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = React.useState(codigoInicial ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const codigoLimpio = (codigoInicial ?? "").trim().toUpperCase();
  const incidencia =
    codigoLimpio.length > 0
      ? INCIDENCIAS_EJEMPLO.find((i) => i.codigo === codigoLimpio) ?? null
      : null;
  const consultado = codigoLimpio.length > 0;

  const alConsultar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valor = codigo.trim().toUpperCase();
    if (!/^INC-\d{4}-\d{4,6}$/.test(valor)) {
      setError(`El código tiene el formato ${PATRON_CODIGO}. Ej.: INC-2026-00128.`);
      return;
    }
    setError(null);
    router.push(`/seguimiento?codigo=${encodeURIComponent(valor)}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Buscador por código */}
      <Card>
        <CardContent>
          <form onSubmit={alConsultar} noValidate className="flex flex-col gap-3">
            <div>
              <Label htmlFor="codigo-seguimiento">Código de incidencia</Label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="codigo-seguimiento"
                  name="codigo"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="INC-2026-00128"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "codigo-seguimiento-error" : undefined}
                  className="font-mono uppercase"
                />
                <Button type="submit" className="shrink-0">
                  <Search aria-hidden />
                  Consultar
                </Button>
              </div>
              {error ? (
                <p id="codigo-seguimiento-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Formato: {PATRON_CODIGO} · lo recibiste al enviar tu reporte.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resultado */}
      {incidencia ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="font-mono text-xl">{incidencia.codigo}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge estado={incidencia.estado} />
                <PriorityBadge prioridad="Media" />
              </div>
            </div>
            <CardDescription>
              {incidencia.tipo} · {incidencia.subtipo}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Información relevante */}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <DoorOpen className="size-3.5" aria-hidden />
                  Ambiente
                </dt>
                <dd className="mt-0.5 font-medium">{incidencia.ambiente}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Fecha de reporte
                </dt>
                <dd className="mt-0.5 font-medium">{fechaHora(incidencia.fechaReporte)}</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  Ubicación
                </dt>
                <dd className="mt-0.5 font-medium">Filial Ica · Pabellón B · Piso 1</dd>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 sm:col-span-2">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-3.5" aria-hidden />
                  Descripción
                </dt>
                <dd className="mt-0.5">{incidencia.resumen}</dd>
              </div>
            </dl>

            {/* Progreso del flujo (§30) */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Estado del reporte</h3>
              <ProgresoEstado estado={incidencia.estado} />
            </div>

            {/* Historial */}
            <div>
              <h3 className="mb-3 text-sm font-semibold">Historial</h3>
              <Timeline
                hitos={HISTORIAL_EJEMPLO.map((h) => ({
                  title: h.titulo,
                  description: h.descripcion,
                  fecha: fechaHora(h.fecha),
                  estado: "done" as const,
                }))}
              />
            </div>

            {/* Acción útil siguiente */}
            <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Wrench className="size-3.5 shrink-0" aria-hidden />
              Cuando la incidencia pase a “Resuelta” podrás confirmar si la solución fue
              satisfactoria.
            </p>
          </CardContent>
        </Card>
      ) : consultado ? (
        <EmptyState
          title="Incidencia no encontrada"
          description={`No hay resultados para ${codigoLimpio}. Verifica el código e inténtalo de nuevo.`}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Ingresa un código para ver el estado del reporte.
        </p>
      )}

      <AvisoDemo />
    </div>
  );
}
