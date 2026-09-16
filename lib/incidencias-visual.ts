/**
 * CATÁLOGO VISUAL DE ESTADOS Y PRIORIDADES · SIR-UPSJB
 *
 * Representación visual de los catálogos de la base de datos
 * (supabase/migrations/0005_seed_catalogos.sql). Según §50 del Plan Maestro,
 * los estados NO dependen solo del color: cada estado lleva ICONO + TEXTO.
 *
 * Este módulo es solo presentación; la fuente de verdad de los catálogos es la BD.
 */

import {
  CircleCheck,
  CircleHelp,
  CirclePause,
  CircleX,
  Clock,
  UserCheck,
  Wrench,
  ArrowDown,
  ArrowUp,
  Minus,
  CircleAlert,
  type LucideIcon,
} from "lucide-react";

/** Estados de incidencia (tabla `estados_incidencia`, semilla 0005). */
export type EstadoIncidencia =
  | "Pendiente"
  | "Asignada"
  | "En proceso"
  | "En espera"
  | "Resuelta"
  | "Cerrada"
  | "Cancelada";

/** Prioridades de incidencia (tabla `prioridades`, semilla 0005). */
export type PrioridadIncidencia = "Baja" | "Media" | "Alta" | "Crítica";

interface MetaEstado {
  label: EstadoIncidencia;
  icon: LucideIcon;
  /** Clases Tailwind del chip (fondo, texto y borde del mismo matiz). */
  clases: string;
}

interface MetaPrioridad {
  label: PrioridadIncidencia;
  icon: LucideIcon;
  clases: string;
}

/**
 * Metadatos visuales por estado. Los matices coinciden con los colores de la
 * semilla 0005 (pendiente=amarillo, asignada=azul, en proceso=índigo,
 * en espera=púrpura, resuelta=verde, cerrada/cancelada=gris) y usan la
 * sintaxis compatible con Tailwind v4 (`bg-<color>/10`).
 */
export const ESTADOS_INCIDENCIA: Record<EstadoIncidencia, MetaEstado> = {
  Pendiente: {
    label: "Pendiente",
    icon: Clock,
    clases:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30",
  },
  Asignada: {
    label: "Asignada",
    icon: UserCheck,
    clases:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  },
  "En proceso": {
    label: "En proceso",
    icon: Wrench,
    clases:
      "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  },
  "En espera": {
    label: "En espera",
    icon: CirclePause,
    clases:
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  },
  Resuelta: {
    label: "Resuelta",
    icon: CircleCheck,
    clases:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  },
  Cerrada: {
    label: "Cerrada",
    icon: CircleCheck,
    clases:
      "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/30",
  },
  Cancelada: {
    label: "Cancelada",
    icon: CircleX,
    clases:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-400 dark:border-gray-500/30",
  },
} as const;

/** Prioridades con icono y clases (niveles de la semilla 0005). */
export const PRIORIDADES_INCIDENCIA: Record<PrioridadIncidencia, MetaPrioridad> = {
  Baja: {
    label: "Baja",
    icon: ArrowDown,
    clases:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  },
  Media: {
    label: "Media",
    icon: Minus,
    clases:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30",
  },
  Alta: {
    label: "Alta",
    icon: ArrowUp,
    clases:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  },
  "Crítica": {
    label: "Crítica",
    icon: CircleAlert,
    clases:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  },
} as const;

/** Metadatos visuales de un estado (con fallback neutro si es desconocido). */
export function metaDeEstado(estado: string | null | undefined): MetaEstado {
  const clave = (estado ?? "").trim();
  const existente = ESTADOS_INCIDENCIA[clave as EstadoIncidencia];
  if (existente) return existente;
  return {
    label: (clave || "Desconocido") as EstadoIncidencia,
    icon: CircleHelp,
    clases: "bg-muted text-muted-foreground border-border",
  };
}

/** Metadatos visuales de una prioridad (con fallback neutro). */
export function metaDePrioridad(prioridad: string | null | undefined): MetaPrioridad {
  const clave = (prioridad ?? "").trim();
  const existente = PRIORIDADES_INCIDENCIA[clave as PrioridadIncidencia];
  if (existente) return existente;
  return {
    label: (clave || "—") as PrioridadIncidencia,
    icon: CircleHelp,
    clases: "bg-muted text-muted-foreground border-border",
  };
}
