import { NextResponse, type NextRequest } from "next/server";
import { getSesion, tienePermiso } from "@/lib/auth/session";
import {
  obtenerDetalleReporte,
  parsearFiltros,
} from "@/lib/reportes/datos";

/**
 * EXPORTACIÓN CSV (FASE 10 — §47). El modelo lo soporta: el permiso
 * `ver_reportes` existe precisamente para "Consultar y exportar reportes".
 * El CSV se genera EN SERVIDOR desde reporte_detalle (RLS del lector, RPC
 * SECURITY INVOKER) — sin exponer más filas de las que el usuario ya ve.
 */

export async function GET(request: NextRequest) {
  // Autorización: admin, coordinador o permiso ver_reportes (misma matriz
  // que la RPC indicadores_analiticos). Igual que en la BD: administrador
  // o coordinador por rol, supervisor por permiso.
  const sesion = await getSesion();
  const esRol = Boolean(
    sesion &&
      sesion.roles.some((r) =>
        ["ADMINISTRADOR", "COORDINADOR"].includes(r.toUpperCase())
      )
  );
  const esAutorizado = esRol || (await tienePermiso("ver_reportes"));
  if (!esAutorizado) {
    return NextResponse.json(
      { error: "No tienes autorización para exportar reportes." },
      { status: 403 }
    );
  }

  const filtros = parsearFiltros(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  const { filas, error } = await obtenerDetalleReporte(filtros, 500);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const cabeceras = [
    "codigo",
    "estado",
    "prioridad",
    "tipo",
    "sede",
    "ambiente",
    "area",
    "servicio",
    "fecha_reporte",
    "fecha_resolucion",
    "horas_resolucion",
    "sla",
  ];

  const celda = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // Escapa comillas y separadores; prefijo anti-formula (OWASP CSV).
    const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${seguro.replace(/"/g, '""')}"`;
  };

  const lineas = [
    cabeceras.join(","),
    ...filas.map((f) =>
      [
        f.codigo,
        f.estado,
        f.prioridad,
        f.tipo,
        f.sede,
        f.ambiente,
        f.area,
        f.servicio,
        f.fecha_reporte,
        f.fecha_resolucion,
        f.horas_resolucion,
        !f.tiene_sla ? "sin_sla" : f.fuera_sla ? "fuera_sla" : "cumplido",
      ]
        .map(celda)
        .join(",")
    ),
  ];

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse("\uFEFF" + lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-sir-upsjb-${fecha}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
