import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * DIAGNÓSTICO DE PERFIL (temporal, FASE de validación de sesión).
 * Protegida por sesión: devuelve el estado real de getUser() y de la lectura
 * RLS de `perfiles`, con los ERRORES que hoy la app descarta silenciosamente.
 * Se elimina al cerrar la incidencia.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: usuario, error: getUserError } = await supabase.auth.getUser();

  if (!usuario?.user) {
    return NextResponse.json({
      paso: "getUser",
      sesion_valida: false,
      error_getUser: getUserError?.message ?? null,
    });
  }

  const user = usuario.user;

  const [{ error: perfilesError, data: fila, status, count }, { error: rolesError, data: roles }] =
    await Promise.all([
      supabase.from("perfiles").select("*", { count: "exact" }).eq("id", user.id).maybeSingle(),
      supabase.rpc("tiene_permiso", { p_permiso: "gestionar_usuarios" }).then((r) => ({ error: r.error, data: r.data })),
    ]);

  return NextResponse.json({
    paso: "lectura_perfiles",
    sesion_valida: true,
    usuario: { id: user.id, email: user.email, roles_claim: user.app_metadata?.roles ?? null },
    consulta_perfiles: {
      status,
      count,
      fila_encontrada: fila !== null,
      fila_resumen:
        fila && typeof fila === "object"
          ? {
              id: (fila as Record<string, unknown>).id,
              estado: (fila as Record<string, unknown>).estado,
            }
          : null,
      error: perfilesError
        ? { message: perfilesError.message, code: perfilesError.code, details: perfilesError.details, hint: perfilesError.hint }
        : null,
    },
    rpc_gestionar_usuarios: { data: roles ?? null, error: rolesError?.message ?? null },
    proyecto: supabaseUrl().replace(/^https:\/\/([^.]+)\.supabase\.co$/, "$1"),
  });
}
