/**
 * CONSTANTES Y PARSEO DE FILTROS DE AUDITORÍA (Fase 11) — módulo ISLETO:
 * sin dependencias de servidor. Lo importan tanto la capa de datos (que sí
 * usa el cliente Supabase de servidor) como client components (filtros).
 */

export interface FiltrosAuditoria {
  accion: string | null;
  tabla: string | null;
  busqueda: string | null;
  desde: string | null; // YYYY-MM-DD
  hasta: string | null; // YYYY-MM-DD
  pagina: number;       // 1-based
}

export const TAMANO_PAGINA = 50;

/** Dominio de acciones del modelo (0001) para el filtro <select>. */
export const ACCIONES_AUDITORIA = [
  "LOGIN",
  "LOGOUT",
  "CREAR",
  "EDITAR",
  "ASIGNAR",
  "DERIVAR",
  "CAMBIAR_ESTADO",
  "ADJUNTAR_EVIDENCIA",
  "RESOLVER",
  "CERRAR",
  "MODIFICAR_CONFIGURACION",
  "ANULAR",
] as const;

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida la fecha SEMÁNTICAMENTE (no solo formato): rechaza 2026-13-01 o
 * 2026-02-30, que el regex acepta y Postgres rechazaría con un error.
 */
function esFechaValida(t: string): boolean {
  if (!RE_FECHA.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

/** Parseo/validación estricta de los filtros que llegan por URL. */
export function parsearFiltrosAuditoria(
  sp: Record<string, string | string[] | undefined>
): FiltrosAuditoria {
  const uno = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const texto = (v: string | undefined, max: number): string | null => {
    const t = (v ?? "").trim();
    return t.length > 0 && t.length <= max ? t : null;
  };
  const fecha = (v: string | undefined): string | null => {
    const t = (v ?? "").trim();
    return esFechaValida(t) ? t : null;
  };
  const accion = texto(uno("accion"), 30);
  return {
    accion:
      accion && (ACCIONES_AUDITORIA as readonly string[]).includes(accion)
        ? accion
        : null,
    tabla: texto(uno("tabla"), 63),
    busqueda: texto(uno("q"), 100),
    desde: fecha(uno("desde")),
    hasta: fecha(uno("hasta")),
    pagina: Math.max(1, Math.min(Number(uno("pagina")) || 1, 1000)),
  };
}

/** Construye la query de URL a partir de los filtros (para links/paginación). */
export function queryAuditoria(f: FiltrosAuditoria, pagina?: number): string {
  const p = new URLSearchParams();
  if (f.accion) p.set("accion", f.accion);
  if (f.tabla) p.set("tabla", f.tabla);
  if (f.busqueda) p.set("q", f.busqueda);
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  const pag = pagina ?? f.pagina;
  if (pag > 1) p.set("pagina", String(pag));
  return p.toString();
}
