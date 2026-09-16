import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeDeRoles } from "@/lib/auth/roles";

/**
 * /auth/callback · SIR-UPSJB
 *
 * Destino de los enlaces de los correos de Supabase Auth (flujo PKCE):
 * intercambia el `code` de un solo uso por la sesión (cookies httpOnly).
 *
 *  · ?tipo=recuperacion → sesión de recovery → /restablecer (definir nueva).
 *  · cualquier otro caso → home del panel según los roles del JWT.
 *
 * Ruta excluida del matcher del middleware (el intercambio debe ejecutarse).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const tipo = searchParams.get("tipo");

  if (!codigo) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=enlace-invalido";
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error) {
    const url = request.nextUrl.clone();
    url.pathname = tipo === "recuperacion" ? "/restablecer" : "/login";
    url.search = "?error=enlace-invalido";
    return NextResponse.redirect(url);
  }

  if (tipo === "recuperacion") {
    const url = request.nextUrl.clone();
    url.pathname = "/restablecer";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Post-login genérico: redirigir al panel del rol de mayor jerarquía.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const roles = Array.isArray(user?.app_metadata?.roles)
    ? (user!.app_metadata.roles as string[])
    : [];

  const url = request.nextUrl.clone();
  url.pathname = homeDeRoles(roles);
  url.search = "";
  return NextResponse.redirect(url);
}
