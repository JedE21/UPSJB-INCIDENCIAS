/**
 * CATÁLOGOS DEL FORMULARIO DE REPORTE · SIR-UPSJB
 *
 * Presentación temporal del flujo visual: la fuente de verdad de los catálogos
 * es la base de datos (supabase/migrations/0005_seed_catalogos.sql) y las
 * listas definitivas se cargarán desde la BD cuando se integre la lógica de
 * incidencias (FASE 6 del Plan Maestro).
 *
 * La lista de subtipos coincide con la semilla 0005 (más "Otro").
 * Los valores institucionales de tipos/subtipos siguen pendientes de
 * validación con la Filial Ica [VI].
 */

import { cn } from "@/lib/utils";

/** Tipos de incidencia (tabla `tipos_incidencia`, semilla 0005). */
export const TIPOS_INCIDENCIA = [
  "Técnica",
  "Infraestructura",
  "Conectividad",
  "Mobiliario",
  "Limpieza",
  "Seguridad",
  "Académica",
  "Administrativa",
  "Otro",
] as const;

export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];

/** Subtipos de ejemplo por tipo (semilla 0005 + "Otro" transversal). */
export const SUBTIPOS_INCIDENCIA: Record<TipoIncidencia, readonly string[]> = {
  Técnica: [
    "Computadora no enciende",
    "Monitor sin señal",
    "Impresora atascada",
    "Software con error",
    "Otro",
  ],
  Conectividad: ["Internet lento", "Sin acceso a la red", "WiFi intermitente", "Otro"],
  Infraestructura: ["Luminaria fundida", "Fuga de agua", "Otro"],
  Mobiliario: ["Silla dañada", "Escritorio dañado", "Otro"],
  Limpieza: ["Otro"],
  Seguridad: ["Otro"],
  Académica: ["Otro"],
  Administrativa: ["Otro"],
  Otro: ["Otro"],
};

/** Equipos del ambiente (futuro: equipos_ambientes de la BD). */
export const EQUIPOS_EJEMPLO = [
  "Computadora 01",
  "Computadora 02",
  "Monitor",
  "Proyector",
  "Impresora",
  "Access Point",
] as const;

/**
 * Ambiente de demostración: cuando exista el módulo QR (Fase 6), la ubicación
 * llegará desde la lectura del código y esta tarjeta se alimentará con datos
 * reales del ambiente identificado.
 */
export const AMBIENTE_DEMO = {
  sede: "Filial Ica",
  pabellon: "Pabellón B",
  piso: "Piso 1",
  nombre: "Aula B-104",
  tipo: "Aula",
  /** Código asociado al QR del ambiente (formato del Plan Maestro §14.1). */
  codigoQR: "ICA-B-B104-0001",
} as const;

/** Iconos por tipo de incidencia (refuerzo visual con texto, §50). */
export const iconosPorTipo: Record<TipoIncidencia, string> = {
  Técnica: "💻",
  Infraestructura: "🏗️",
  Conectividad: "📡",
  Mobiliario: "🪑",
  Limpieza: "🧹",
  Seguridad: "🛡️",
  Académica: "🎓",
  Administrativa: "🗄️",
  Otro: "📋",
};

/** Etiquetas de texto de las prioridades (no depender solo del color, §50). */
export const ETIQUETAS_PRIORIDAD = {
  Baja: "Puede esperar",
  Media: "Normal",
  Alta: "Urgente",
  "Crítica": "Muy urgente",
} as const;

/** Clases del chip de prioridad (mismos matices que lib/incidencias-visual.ts). */
export const clasesChipPrioridad: Record<keyof typeof ETIQUETAS_PRIORIDAD, string> = {
  Baja:
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  Media:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30",
  Alta:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  "Crítica":
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
};

/** Prioridades ofrecidas en el formulario (usa clasesChipPrioridad + cn). */
export const PRIORIDADES_FORMULARIO = ["Baja", "Media", "Alta"] as const;

/** Cantidad máxima de fotos de evidencia (mismo límite del FileUpload). */
export const MAX_EVIDENCIA_FOTOS = 3;
