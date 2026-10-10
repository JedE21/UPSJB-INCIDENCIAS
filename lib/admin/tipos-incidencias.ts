/**
 * TIPOS DEL CRUD DE INCIDENCIAS · PANEL ADMIN (Fase 7 — RPC 0022)
 *
 * Archivo "isleto" (sin "use server" ni código de servidor): lo importan
 * client components y server actions por igual sin arrastrar dependencias
 * de servidor al bundle del navegador.
 */

/** Fila del listado admin (normalizada, strings planos). */
export interface IncidenciaAdminFila {
  id: string;
  codigo: string;
  descripcion: string;
  fecha_reporte: string;
  estado: string;
  prioridad: string;
  tipo: string;
  subtipo: string;
  ambiente: string;
  ambiente_codigo: string;
  sede: string;
  pabellon: string;
  piso: string;
  reportante: string;
  area_responsable: string;
  tecnico_asignado: string;
}

export interface ResultadoLista {
  filas: IncidenciaAdminFila[];
  error: string | null;
}

/** Estados para los filtros (semilla 0005; sin hardcodear ids). */
export const ESTADOS_FILTRO_ADMIN = [
  "Pendiente",
  "Asignada",
  "En proceso",
  "En espera",
  "Resuelta",
  "Cerrada",
  "Cancelada",
  "Derivada",
] as const;

/** Estado genérico de las acciones de escritura admin sobre incidencias. */
export interface EstadoAdminIncidencia {
  error: string | null;
  /** Código generado por trigger (ej. INC-2026-000128) para el toast. */
  codigo?: string | null;
}

/** Catálogos del modal crear/editar (endpoint /api/admin/catalogos-incidencias). */
export interface CatalogosIncidenciasAdmin {
  ambientes: Array<{ id: string; nombre: string; activo: boolean }>;
  tipos: Array<{ id: string; nombre: string; activo: boolean }>;
  subtipos: Array<{ id: string; nombre: string; tipo_incidencia_id: string; activo: boolean }>;
  prioridades: Array<{ id: string; nombre: string; nivel: number; activo: boolean }>;
}
