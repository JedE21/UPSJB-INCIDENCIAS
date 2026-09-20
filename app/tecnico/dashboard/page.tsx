import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClock,
  CircleCheck,
  CirclePause,
  CirclePlay,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Timer,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { PriorityBadge, StatusBadge } from "@/components/incidencias/badges";
import { cn } from "@/lib/utils";
import { ListaAsignadas } from "@/components/tecnico/lista-asignadas";
import { obtenerKpisTecnico, listarIncidenciasAsignadas } from "@/lib/incidencias/datos";
import { obtenerSlasAsignadas } from "@/lib/incidencias/sla";
import { notificarAlertasSla } from "@/lib/notificaciones/alertas";
import { fechaHora } from "@/lib/fechas";

/** Puente con manejo de error tipado para la cola de alertas SLA. */
async function supabaseRpcAlertasSla(): Promise<void> {
  await notificarAlertasSla();
}

export const metadata: Metadata = { title: "Dashboard técnico" };

/**
 * DASHBOARD DEL TÉCNICO (§33 del Plan Maestro).
 * KPIs contados EN SERVIDOR sobre las asignaciones activas del técnico
 * (RLS p_asignaciones_select); nada se calcula en el cliente.
 * SLA (Fase 8b): estado por asignación calculado en BD (RPC 0017) con now()
 * de PostgreSQL; orden de urgencia vencidos → en riesgo → en tiempo.
 */
export default async function TecnicoDashboardPage() {
  // Optimización (Fase 14): la lista se carga UNA vez y los KPIs se derivan
  // de ella (antes: 2 consultas idénticas en paralelo).
  const asignadas = await listarIncidenciasAsignadas();
  const [kpis, slas] = await Promise.all([
    obtenerKpisTecnico(asignadas),
    obtenerSlasAsignadas(),
  ]);

  // Alertas SLA → notificaciones internas (RPC 0018, dedupe: solo crea las
  // que aún no existen). Al cargar el dashboard también queda alertado quien
  // no abre la bandeja.
  try {
    await supabaseRpcAlertasSla();
  } catch {
    // fallo de la cola de alertas no bloquea el dashboard
  }

  const vencidos = slas.filter((s) => s.estado_resolucion === "vencido");
  const enRiesgo = slas.filter((s) => s.estado_resolucion === "en_riesgo");
  const enTiempo = slas.filter((s) => s.estado_resolucion === "en_tiempo");

  const porAtender = asignadas.filter((i) => i.estado === "Asignada").slice(0, 5);
  const enAtencion = asignadas
    .filter((i) => i.estado === "En proceso" || i.estado === "En espera")
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard del técnico"
        description="Resumen de tu carga de trabajo: incidencias asignadas y en atención."
      />

      {/* KPIs básicos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Asignadas (por aceptar)"
          value={kpis.asignadas}
          hint="Incidencias que te fueron asignadas."
          delay={0}
        />
        <StatCard
          icon={CirclePlay}
          label="En proceso"
          value={kpis.enProceso}
          hint="Atención activa."
          delay={0.05}
        />
        <StatCard
          icon={CirclePause}
          label="En espera"
          value={kpis.enEspera}
          hint="Pausadas con motivo registrado."
          delay={0.1}
        />
        <StatCard
          icon={CircleCheck}
          label="Resueltas"
          value={kpis.resueltas}
          hint="Pendientes de cierre por el reportante."
          delay={0.15}
        />
      </div>

      {/* SLA de mis asignaciones (Fase 8b, RPC 0017) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={TriangleAlert}
          label="SLA vencidos"
          value={vencidos.length}
          hint="Resolución fuera del plazo del acuerdo."
          tono={vencidos.length > 0 ? "peligro" : "neutral"}
          delay={0}
        />
        <StatCard
          icon={AlarmClock}
          label="SLA en riesgo"
          value={enRiesgo.length}
          hint="Queda menos del 25 % del plazo."
          tono={enRiesgo.length > 0 ? "alerta" : "neutral"}
          delay={0.05}
        />
        <StatCard
          icon={Timer}
          label="SLA en tiempo"
          value={enTiempo.length}
          hint="Dentro del plazo del acuerdo."
          tono="exito"
          delay={0.1}
        />
      </div>

      {vencidos.length + enRiesgo.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioridad de atención</CardTitle>
            <CardDescription>
              Asignaciones con el SLA vencido o próximo a vencer, calculado en servidor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {[...vencidos, ...enRiesgo].map((s) => (
                <li key={s.incidencia_id}>
                  <Link
                    href={`/tecnico/incidencias/${s.codigo}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                  >
                    <span className="font-mono text-xs font-semibold">{s.codigo}</span>
                    <PriorityBadge prioridad={s.prioridad} />
                    <span className="min-w-0 flex-1 truncate">{s.estado_incidencia}</span>                    <span className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
                        s.estado_resolucion === "vencido"
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950 dark:text-red-300"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-300"
                      )}>
                      {s.estado_resolucion === "vencido" ? (
                        <>
                          <TriangleAlert className="size-3" aria-hidden />
                          Vencido
                        </>
                      ) : (
                        <>
                          <AlarmClock className="size-3" aria-hidden />
                          {s.minutos_restantes_resolucion !== null
                            ? `Quedan ${Math.max(1, Math.round(s.minutos_restantes_resolucion / 60))} h`
                            : "En riesgo"}
                        </>
                      )}
                    </span>
                    {s.objetivo_resolucion_en ? (
                      <span className="text-xs text-muted-foreground">
                        vence {fechaHora(s.objetivo_resolucion_en)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por atender */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Por atender</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/tecnico/incidencias">
                  Ver todas
                  <Wrench aria-hidden />
                </Link>
              </Button>
            </div>
            <CardDescription>Acepta la asignación para iniciar la atención.</CardDescription>
          </CardHeader>
          <CardContent>
            {porAtender.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {porAtender.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/tecnico/incidencias/${i.codigo}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                    >
                      <span className="font-mono text-xs font-semibold">{i.codigo}</span>
                      <span className="min-w-0 flex-1 truncate">{i.ambiente_nombre}</span>
                      <PriorityBadge prioridad={i.prioridad} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nada pendiente de aceptar. Buen trabajo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* En atención */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">En atención</CardTitle>
            <CardDescription>En proceso o en espera, con el flujo activo.</CardDescription>
          </CardHeader>
          <CardContent>
            {enAtencion.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {enAtencion.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/tecnico/incidencias/${i.codigo}`}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                    >
                      <span className="font-mono text-xs font-semibold">{i.codigo}</span>
                      <span className="min-w-0 flex-1 truncate">{i.ambiente_nombre}</span>
                      <StatusBadge estado={i.estado} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                No tienes incidencias en atención ahora mismo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Todas las asignadas */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Todas mis incidencias asignadas</h2>
        <ListaAsignadas incidencias={asignadas} />
      </div>
    </div>
  );
}
