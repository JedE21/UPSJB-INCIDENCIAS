import { NextResponse } from "next/server";
import { getSesion } from "@/lib/auth/session";
import { cargarCatalogosIncidenciasAdmin } from "@/lib/admin/datos-incidencias";

/**
 * GET /api/admin/catalogos-incidencias
 * Catálogos para los modales de crear/editar incidencias del panel admin.
 * Guard de servidor: exige sesión + ADMINISTRADOR; la lectura de catálogos
 * además está protegida por las policies de lectura en BD.
 */
export async function GET() {
  const sesion = await getSesion();
  if (!sesion || !sesion.roles.includes("ADMINISTRADOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { ambientes, tipos, subtipos, prioridades, error } =
    await cargarCatalogosIncidenciasAdmin();

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({
    ambientes,
    tipos,
    subtipos,
    prioridades,
  });
}
