"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase del NAVEGADOR (sesión en cookies, mismo almacén que el
 * servidor → RLS con el JWT real del usuario en cada request).
 *
 * Modo singleton: en el cliente debe existir UNA sola instancia (GoTrueClient
 * único) para que todos los tabs/componentes compartan la misma sesión y los
 * listeners de onAuthStateChange no compitan.
 */
let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  }
  return client;
}
