import type { Metadata } from "next";
import dynamic from "next/dynamic";
import {
  AlarmClock,
  BarChart3,
  CircleCheck,
  CircleSlash,
  ClipboardList,
  Clock3,
  GitBranch,
  Layers,
  ShieldAlert,
  TimerOff,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BotonExportarCsv } from "@/components/reportes/graficos";
import { FiltrosReporteForm } from "@/components/reportes/filtros-reporte";

// OPTIMIZACIÓN (Fase 14): Recharts (~120 KB gzip) se carga SOLO cuando el
// navegador pinta los gráficos de esta ruta. Los puntos de entrada Lazy viven
// en un client component (panel-graficos.tsx); el código de la librería se
// parte en un chunk aparte que no bloquea el HTML del servidor.
const GraficoBarras = dynamic(
  () => import("@/components/reportes/panel-graficos").then((m) => m.GraficoBarrasLazy)
);
const GraficoDonut = dynamic(
  () => import("@/components/reportes/panel-graficos").then((m) => m.GraficoDonutLazy)
);
const GraficoEvolucion = dynamic(
  () => import("@/components/reportes/panel-graficos").then((m) => m.GraficoEvolucionLazy)
);
const GraficoHorasPorServicio = dynamic(
  () => import("@/components/reportes/panel-graficos").then((m) => m.GraficoHorasLazy)
);
import {
  obtenerDetalleReporte,
  obtenerIndicadoresAnaliticos,
  obtenerOpcionesFiltro,
  obtenerSerie,
  parsearFiltros,
  type PuntoSerie,
} from "@/lib/reportes/datos";
import { horasLegibles } from "@/lib/incidencias/sla-formato";

export const metadata: Metadata = { title: "Reportes — Admin" };

/**
 * DASHBOARD ANALÍTICO Y REPORTES (FASE 10 — Plan §47/§48).
 * Agregación EN POSTGRES (RPC 0019): la página solo pinta resultados.
 * La autorización (admin/coordinador/ver_reportes) la aplica la BD; sin
 * permiso las RPC lanzan y cada tarjeta degrada a su error controlado.
 */
export default async function AdminReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtros = parsearFiltros(sp);
  const query = new URLSearchParams(
    Object.entries({
      desde: filtros.desde ?? "",
      hasta: filtros.hasta ?? "",
      sede: filtros.sedeId ?? "",
      area: filtros.areaId ?? "",
      estado: filtros.estado ?? "",
      prioridad: filtros.prioridad ?? "",
      tipo: filtros.tipo ?? "",
    }).filter(([, v]) => v !== "")
  ).toString();

  const [opciones, indicadores, porEstado, porPrioridad, porTipo, porArea, porAmbiente, porEquipo, evolucion, porServicio, detalle] =
    await Promise.all([
      obtenerOpcionesFiltro(),
      obtenerIndicadoresAnaliticos(filtros),
      obtenerSerie("estado", filtros, 12),
      obtenerSerie("prioridad", filtros, 4),
      obtenerSerie("tipo", filtros, 8),
      obtenerSerie("area", filtros, 10),
      obtenerSerie("ambiente", filtros, 10),
      obtenerSerie("equipo", filtros, 10),
      obtenerSerie("mes", filtros, 12),
      obtenerSerie("servicio_atencion", filtros, 10),
      obtenerDetalleReporte(filtros, 100),
    ]);

  const k = indicadores.datos;
  const hayFiltros =
    Boolean(filtros.desde || filtros.hasta || filtros.sedeId || filtros.areaId ||
      filtros.estado || filtros.prioridad || filtros.tipo);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        title="Reportes y analítica"
        description="Indicadores operativos, de tiempo, ubicación, equipos y áreas (Plan §47/§48). Agregación en base de datos con filtros server-side."
        actions={<BotonExportarCsv query={query} />}
      />

      {/* Filtros (fechas / sede / área / estado / prioridad / tipo) */}
      <FiltrosReporteForm opciones={opciones} />

      {/* Error global de indicadores (p. ej. sin permiso) */}
      {indicadores.error && (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">
            {indicadores.error}
          </CardContent>
        </Card>
      )}

      {/* KPIs operativos */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Incidencias totales" value={k?.total ?? 0} hint={hayFiltros ? "con filtros aplicados" : "histórico"} delay={0} />
        <StatCard icon={Layers} label="Pendientes" value={k?.pendientes ?? 0} delay={1} />
        <StatCard icon={Clock3} label="En proceso" value={k?.enProceso ?? 0} delay={2} />
        <StatCard icon={ClipboardList} label="Resueltas" value={k?.resueltas ?? 0} delay={3} />
        <StatCard icon={ClipboardList} label="Cerradas / canceladas" value={k?.cerradas ?? 0} delay={0} />
        <StatCard icon={ShieldAlert} label="Prioridad crítica" value={k?.criticas ?? 0} delay={1} />
        <StatCard icon={GitBranch} label="Derivadas" value={k?.derivadas ?? 0} delay={2} />
        <StatCard icon={TimerOff} label="Fuera de SLA (resolución)" value={k?.fueraSlaResol ?? 0} delay={3} />
      </section>

      {/* KPIs de tiempo */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={AlarmClock} label="Tiempo prom. de respuesta" value={k?.promHorasRespuesta != null ? horasLegibles(k.promHorasRespuesta) : "—"} delay={0} />
        <StatCard icon={AlarmClock} label="Tiempo prom. de atención" value={k?.promHorasAtencion != null ? horasLegibles(k.promHorasAtencion) : "—"} delay={1} />
        <StatCard icon={AlarmClock} label="Tiempo prom. de resolución" value={k?.promHorasResolucion != null ? horasLegibles(k.promHorasResolucion) : "—"} delay={2} />
      </section>

      {/* Gráficos principales */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Por estado</CardTitle></CardHeader>
          <CardContent><GraficoDonut titulo="Distribución por estado" datos={porEstado} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por prioridad</CardTitle></CardHeader>
          <CardContent><GraficoBarras titulo="Distribución por prioridad" datos={porPrioridad} colorPorEtiqueta /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por tipo de incidencia</CardTitle></CardHeader>
          <CardContent><GraficoBarras titulo="Incidencias por tipo" datos={porTipo} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por área responsable</CardTitle></CardHeader>
          <CardContent><GraficoBarras titulo="Incidencias por área" datos={porArea} horizontal /></CardContent>
        </Card>
      </div>

      {/* Evolución mensual */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evolución mensual</CardTitle></CardHeader>
        <CardContent><GraficoEvolucion titulo="Incidencias reportadas por mes" datos={evolucion} /></CardContent>
      </Card>

      {/* Ubicación */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Por ambiente</CardTitle></CardHeader>
          <CardContent><GraficoBarras titulo="Incidencias por ambiente" datos={porAmbiente} horizontal /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Equipos con más incidencias</CardTitle></CardHeader>
          <CardContent><GraficoBarras titulo="Top equipos por incidencias" datos={porEquipo} horizontal /></CardContent>
        </Card>
      </div>

      {/* Tiempo de atención por servicio */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tiempo de atención por servicio</CardTitle></CardHeader>
        <CardContent><GraficoHorasPorServicio titulo="Promedio de horas de atención (inicio → resolución)" datos={porServicio} /></CardContent>
      </Card>

      {/* Tabla de detalle (primeras 100 filas del filtro; CSV exporta hasta 500) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de incidencias</CardTitle>
        </CardHeader>
        <CardContent>
          {detalle.error ? (
            <p className="text-sm text-destructive">{detalle.error}</p>
          ) : detalle.filas.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sin incidencias para el filtro aplicado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">
                  Detalle de incidencias según los filtros aplicados
                </caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Prioridad</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Sede / ambiente</th>
                    <th className="py-2 pr-3 font-medium">Área / servicio</th>
                    <th className="py-2 pr-3 font-medium">Reportada</th>
                    <th className="py-2 font-medium">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.filas.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{f.codigo}</td>
                      <td className="py-2 pr-3">{f.estado}</td>
                      <td className="py-2 pr-3">{f.prioridad}</td>
                      <td className="py-2 pr-3">{f.tipo}</td>
                      <td className="py-2 pr-3">{f.sede} · {f.ambiente}</td>
                      <td className="py-2 pr-3">{f.area}{f.servicio !== "—" ? ` · ${f.servicio}` : ""}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{f.fecha_reporte}</td>
                      <td className="py-2">
                        {!f.tiene_sla ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CircleSlash className="size-3.5" aria-hidden />
                            Sin SLA
                          </span>
                        ) : f.fuera_sla ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950 dark:text-red-300">
                            <TimerOff className="size-3.5" aria-hidden />
                            Fuera de SLA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/30 dark:bg-green-950 dark:text-green-300">
                            <CircleCheck className="size-3.5" aria-hidden />
                            Cumplido
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
