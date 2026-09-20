"use client";

/**
 * GRÁFICOS DEL DASHBOARD DE REPORTES · SIR-UPSJB (FASE 10 — §48)
 * Recharts (v3, compatible con React 19 / Next 16). Solo presentación:
 * los datos ya llegan AGREGADOS desde Postgres (RPC 0019); aquí no se
 * calcula ninguna estadística. ResponsiveContainer + estados vacíos.
 */

import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoSerie } from "@/lib/reportes/datos";

/* Paleta fija para prioridades/estados; la genérica para el resto. */
const PALETA = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#64748b",
];

function colorDe(etiqueta: string, i: number): string {
  const e = etiqueta.toLowerCase();
  if (e.startsWith("crít") || e.startsWith("crit")) return "#ef4444";
  if (e.startsWith("alta")) return "#f59e0b";
  if (e.startsWith("media")) return "#eab308";
  if (e.startsWith("baja")) return "#22c55e";
  if (e.startsWith("vencido")) return "#ef4444";
  if (e.startsWith("pendiente")) return "#f59e0b";
  if (e.startsWith("en proceso") || e.startsWith("en espera")) return "#3b82f6";
  if (e.startsWith("resuelta")) return "#22c55e";
  if (e.startsWith("cerrada")) return "#64748b";
  return PALETA[i % PALETA.length];
}

/** Mensaje de estado vacío (§"Estados sin datos"). */
function SinDatos({ mensaje = "Sin datos para el filtro aplicado." }: { mensaje?: string }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {mensaje}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras (estado, prioridad, área, sede, ambiente, equipo…)           */
/* ------------------------------------------------------------------ */

export function GraficoBarras({
  titulo,
  datos,
  horizontal = false,
  colorPorEtiqueta = false,
}: {
  titulo: string;
  datos: PuntoSerie[];
  horizontal?: boolean;
  colorPorEtiqueta?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {datos.length === 0 ? (
        <SinDatos />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datos}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 4, right: 12, bottom: 4, left: horizontal ? 24 : 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              {horizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="etiqueta" width={130} fontSize={11} />
                </>
              ) : (
                <>
                  <XAxis dataKey="etiqueta" fontSize={11} interval={0} angle={-20} textAnchor="end" height={56} />
                  <YAxis allowDecimals={false} fontSize={11} />
                </>
              )}
              <Tooltip />
              <Bar dataKey="cantidad" radius={4}>
                {datos.map((d, i) => (
                  <Cell key={d.etiqueta} fill={colorPorEtiqueta ? colorDe(d.etiqueta, i) : PALETA[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Donut (distribución porcentual)                                     */
/* ------------------------------------------------------------------ */

export function GraficoDonut({ titulo, datos }: { titulo: string; datos: PuntoSerie[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {datos.length === 0 ? (
        <SinDatos />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={datos}
                dataKey="cantidad"
                nameKey="etiqueta"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {datos.map((d, i) => (
                  <Cell key={d.etiqueta} fill={colorDe(d.etiqueta, i)} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Evolución mensual (línea)                                           */
/* ------------------------------------------------------------------ */

export function GraficoEvolucion({ titulo, datos }: { titulo: string; datos: PuntoSerie[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {datos.length === 0 ? (
        <SinDatos />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="etiqueta" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="cantidad"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Barras con promedio de horas (tiempo de atención por servicio)      */
/* ------------------------------------------------------------------ */

export function GraficoHorasPorServicio({
  titulo,
  datos,
}: {
  titulo: string;
  datos: PuntoSerie[];
}) {
  const conHoras = datos.filter((d) => d.extra !== null);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {conHoras.length === 0 ? (
        <SinDatos mensaje="Sin incidencias resueltas con servicio asignado en el filtro." />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conHoras} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" fontSize={11} unit=" h" />
              <YAxis type="category" dataKey="etiqueta" width={130} fontSize={11} />
              <Tooltip formatter={(v) => `${v} h`} />
              <Bar dataKey="extra" fill="#8b5cf6" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Exportación CSV (cliente: descarga el endpoint del servidor)        */
/* ------------------------------------------------------------------ */

export function BotonExportarCsv({ query }: { query: string }) {
  return (
    <a
      href={`/admin/reportes/csv?${query}`}
      className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-accent"
      download
    >
      <Download className="size-4" aria-hidden />
      Exportar CSV
    </a>
  );
}
