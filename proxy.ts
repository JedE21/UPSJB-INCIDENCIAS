import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { homeDeRoles, panelDeRoles, type Panel } from "@/lib/auth/roles";

/**
 * PROXY (antes "middleware") · SIR-UPSJB · Next.js 16
 *
 * Dos responsabilidades:
 *  1. Refresh de sesión: @supabase/ssr renueva el access token cuando está por
 *     expirar y reescribe las cookies de sesión → imprescindible para que los
 *     Server Components siempre reciban una sesión válida.
 *  2. Protección de rutas por panel (primera barrera; la decisión FINAL la
 *     toman los guards de layout con supabase.auth.getUser() + RLS).
 *
 * NOTAS:
 *  · El claim `roles` se lee decodificando el JWT de la cookie de sesión SIN
 *    verificar firma: aquí NO se autoriza nada crítico, solo se decide a qué
 *    panel redirigir. Si el claim no está disponible (hook sin configurar) el
 *    proxy NO bloquea por panel — lo hacen los layouts con datos de BD.
 *  · Next 16: runtime Edge; sin APIs de Node (usamos atob).
 *  · Convención Next 16: proxy.ts exportando proxy(); middleware.ts quedó deprecado.
 */

/** Rutas que exigen sesión, por panel. */
const RUTAS_PANEL: Array<{ panel: Panel; prefijos: string[]; exactas?: string[] }> = [
  { panel: "admin", prefijos: ["/admin/"], exactas: ["/admin"] },
  { panel: "coordinador", prefijos: ["/coordinador/"] },
  { panel: "tecnico", prefijos: ["/tecnico/"] },
  { panel: "usuario", prefijos: ["/mis-incidencias", "/notificaciones", "/perfil"] },
];

// Cada panel tiene su copia de /perfil (reutilizan la misma página):
// el perfil se valida dentro del panel del rol de mayor jerarquía.

/** Páginas de autenticación: un usuario ya logueado no debe verlas.
 *  /restablecer NO va aquí: llega con sesión de recovery y debe mostrarse. */
const RUTAS_AUTH = ["/login", "/recuperar"];

/** Decodifica el payload de un JWT (sin verificar firma). */
function payloadDeJwt(jwt: string): Record<string, unknown> | null {
  const partes = jwt.split(".");
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Roles vigentes desde las cookies de sesión de Supabase.
 * La cookie sb-<ref>-auth-token guarda la sesión (posiblemente chunked).
 */
function rolesDesdeCookies(cookies: Array<{ name: string; value: string }>): string[] {
  const nombres = cookies
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-") && n.includes("-auth-token"))
    .sort();

  const fragmentos: string[] = [];
  for (const nombre of nombres) {
    const valor = cookies.find((c) => c.name === nombre)?.value;
    if (valor) fragmentos.push(valor);
  }
  if (fragmentos.length === 0) return [];

  const bruto = fragmentos.join("");
  let access_token: string | undefined;
  try {
    const decodificado = atob(bruto);
    const sesion = JSON.parse(decodificado) as { access_token?: unknown };
    if (typeof sesion.access_token === "string") access_token = sesion.access_token;
  } catch {
    // Cookie chunked en base64 por parte, o formato interno distinto: intentar
    // decodificar cada fragmento como JWT completo.
    for (const f of fragmentos) {
      const payload = payloadDeJwt(f);
      if (payload) {
        access_token = f;
        break;
      }
    }
  }
  if (!access_token) return [];

  const payload = payloadDeJwt(access_token);
  const roles = payload?.["roles"];
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : [];
}

/** ¿La ruta pertenece a este panel? */
function rutaPertenece(pathname: string, prefijos: string[], exactas?: string[]): boolean {
  if (exactas?.includes(pathname)) return true;
  return prefijos.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANTE: getUser() (no getSession()) → valida el JWT contra el servidor
  // de Auth antes de proteger nada.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const roles = rolesDesdeCookies(request.cookies.getAll());

  // 1) Rutas de panel: exigen sesión y pertenencia al panel.
  const regla = RUTAS_PANEL.find((r) => rutaPertenece(pathname, r.prefijos, r.exactas));

  if (regla && !user) {
    // Sin sesión → login guardando el destino para volver después.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("siguiente", pathname);
    return NextResponse.redirect(url);
  }

  if (regla && user && roles.length > 0) {
    // Con claim `roles` disponible: si el panel del usuario es otro → aviso.
    // (Sin claim, no bloquear aquí: los layouts revalidan con getUser() + BD.)
    const panelDe = panelDeRoles(roles);
    if (panelDe !== regla.panel) {
      const url = request.nextUrl.clone();
      url.pathname = "/acceso-restringido";
      url.search = `?panel=${encodeURIComponent(panelDe)}`;
      return NextResponse.redirect(url);
    }
  }

  // 2) Usuario autenticado visitando páginas de auth → a su panel.
  if (user && RUTAS_AUTH.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = homeDeRoles(roles);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todo excepto:
     *  - _next/static, _next/image (assets)
     *  - favicon.ico y archivos estáticos
     *  - /auth/callback (route handler que intercambia el código por sesión)
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
