import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase del SERVIDOR (Server Components, Server Actions, Route Handlers).
 *
 * · Lee las cookies de la petición (sesión del usuario) y escribe los cookies
 *   refrescados de vuelta (@supabase/ssr lo hace vía setAll).
 * · `cache()` de React: dentro de un mismo request los distintos componentes/
 *   acciones comparten la misma instancia y el mismo usuario resuelto.
 * · Seguridad: usa solo la ANON KEY. RLS aplica con el JWT del usuario.
 *   La service_role jamás se instancia en el cliente ni en el servidor de la
 *   app (las tareas privilegiadas, si algún día hacen falta, irían en
 *   endpoints de servidor con su variable propia sin prefijo NEXT_PUBLIC_).
 *
 * En Next 16 `cookies()` es asíncrono: SIEMPRE await.
 */
export const createClient = cache(async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component sin mutation: los cookies
          // refrescados los escribirá el middleware (refresh de sesión).
        }
      },
    },
  });
});
