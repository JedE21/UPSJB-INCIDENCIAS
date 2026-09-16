/**
 * Variables de entorno públicas de Supabase.
 *
 * NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son públicas por
 * diseño: la seguridad la garantizan RLS + Auth en el servidor, no el secreto
 * de estas claves. NUNCA agregar aquí la SERVICE_ROLE_KEY ni ninguna clave
 * sin el prefijo NEXT_PUBLIC_.
 */
export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL. Copia .env.example a .env.local y completa los valores del proyecto Supabase."
    );
  }
  return url;
}

export function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env.local y completa los valores del proyecto Supabase."
    );
  }
  return key;
}
