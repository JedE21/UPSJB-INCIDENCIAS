/**
 * TIPOS DEL MÓDULO DE INCIDENCIAS · SIR-UPSJB
 *
 * Alineados a la base de datos aprobada (Opción A, 58 tablas):
 *   · `incidencias` (0001) — tabla principal.
 *   · Código único INC-<AAAA>-<NNNNNN> generado por trigger + secuencia anual
 *     (0003/0004): NUNCA se hardcodea ni se calcula en la aplicación.
 *   · Área responsable vive en `incidencia_derivaciones` (fila activa) y el
 *     técnico en `incidencia_asignaciones` (fila activa) — sin duplicar estado.
 *   · RLS (0007): el dueño ve sus incidencias; DELETE no existe para nadie.
 */

/** Fila de seguimiento con ambiente y jerarquía de ubicación enriquecidos. */
export interface IncidenciaResumen {
  id: string;
  codigo: string;
  tipo: string;
  subtipo: string | null;
  prioridad: string;
  estado: string;
  descripcion: string;
  fecha_reporte: string;
  ambiente_nombre: string;
  ambiente_codigo: string;
  tipo_ambiente: string | null;
  piso: string | null;
  pabellon: string | null;
  sede: string | null;
  /** Solo presente si el lector autenticado puede ver asignaciones (dueño sí). */
  tecnico_asignado: string | null;
  /** Área responsable = destino VIGENTE de incidencia_derivaciones. */
  area_responsable: string | null;
  /** Servicio responsable (si la derivación vigente lo definió). */
  servicio_responsable?: string | null;
}

/** Detalle completo para la página de detalle (dueño/técnico/admin). */
export interface IncidenciaDetalle extends IncidenciaResumen {
  fecha_asignacion: string | null;
  fecha_inicio: string | null;
  fecha_resolucion: string | null;
  fecha_cierre: string | null;
  canal: string | null;
  /** Reportante: nombre completo si es visible; null si el reporte es anónimo. */
  reportante: string | null;
  equipos: Array<{
    id: string;
    codigo_interno: string;
    categoria: string | null;
    es_principal: boolean;
  }>;
  adjuntos: EvidenciaItem[];
  comentarios: Array<{
    id: string;
    autor: string | null;
    comentario: string;
    es_interno: boolean;
    creado_en: string;
  }>;
  /** Historial (append-only D9); RLS: dueño, técnico asignado o admin. */
  historial: HistorialItem[];
  /** Historial de derivaciones (área responsable actual = fila activa). */
  derivaciones?: DerivacionResumen[];
}

/** Derivación registrada (traslado entre áreas) para la vista de detalle. */
export interface DerivacionResumen {
  id: string;
  area_origen: string | null;
  area_destino: string;
  /** UUID del área destino (para cascadas de la gestión manual). */
  area_destino_id: string;
  servicio_destino: string | null;
  motivo: string;
  activa: boolean;
  derivado_por: string | null;
  derivado_en: string;
}

/**
 * Evidencia de una incidencia (referencia a Storage privado, nunca bytes).
 * `url` es una signed URL de CORTA duración generada en servidor por la RPC
 * `url_firma_evidencia` (0009/0013): los buckets nunca se exponen como
 * públicos y el acceso lo autoriza la policy evidencias_select.
 */
export interface EvidenciaItem {
  id: string;
  nombre_archivo: string;
  mime_type: string;
  tamano_bytes: number | null;
  tipo: string;
  creado_en: string;
  /** Nombre del usuario que subió el archivo (visible según RLS). */
  subido_por: string | null;
  /** Signed URL temporal (≈5 min) o null si el lector no tiene acceso. */
  url: string | null;
  /** true si el lector actual puede eliminarla (solo ADMINISTRADOR). */
  puede_eliminar: boolean;
}

/** Fila de `incidencia_historial` normalizada para la Timeline. */
export interface HistorialItem {
  id: string;
  tipo_cambio: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  detalle: string | null;
  actor: string | null;
  creado_en: string;
}

/** Opción de catálogo cargada desde la BD (fuente de verdad; sin hardcodeo). */
export interface OpcionCatalogo {
  id: string;
  nombre: string;
}

/** Subtipo con su tipo padre (para el select dependiente del formulario). */
export interface OpcionSubtipo extends OpcionCatalogo {
  tipo_incidencia_id: string;
}

/** Equipo del ambiente ofrecido en el reporte (RPC 0012; datos mínimos). */
export interface EquipoOpcion {
  equipo_id: string;
  codigo_interno: string;
  categoria: string | null;
}
