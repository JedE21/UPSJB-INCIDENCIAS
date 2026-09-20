"use client";

/**
 * PUENTE CLIENT PARA GRÁFICOS (Fase 14 — optimización de bundle).
 *
 * Recharts (~120 KB gzip) solo lo necesita /admin/reportes. Este client
 * component define los puntos de entrada lazy (next/dynamic) para que el
 * código de la librería se parta en un chunk aparte y no bloquee el HTML
 * del servidor. El módulo real `graficos.tsx` sigue siendo el mismo.
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PuntoSerie } from "@/lib/reportes/datos";

/** Placeholder a la altura del gráfico (evita salto de layout, CLS). */
function SkeletonGrafico() {
  return <Skeleton className="h-64 w-full" aria-hidden />;
}

export const GraficoBarrasLazy = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.GraficoBarras),
  { loading: () => <SkeletonGrafico /> }
);

export const GraficoDonutLazy = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.GraficoDonut),
  { loading: () => <SkeletonGrafico /> }
);

export const GraficoEvolucionLazy = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.GraficoEvolucion),
  { loading: () => <SkeletonGrafico /> }
);

export const GraficoHorasLazy = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.GraficoHorasPorServicio),
  { loading: () => <SkeletonGrafico /> }
);

export type { PuntoSerie };
