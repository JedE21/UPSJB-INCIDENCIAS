import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase EFÍMERO de solo lectura (sin escribir cookies).
 *
 * Caso de uso: verificar credenciales (signInWithPassword) dentro de una
 * petición que YA tiene una sesión activa sin sobrescribir las cookies de la
 * sesión vigente. La sesión efímera muere con la petición.
 */
export async function createClientEfimero(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Cliente de solo lectura: NUNCA persiste cookies (ni siquiera los
      // tokens de la sesión efímera que crea signInWithPassword).
      setAll() {},
    },
  });
}
