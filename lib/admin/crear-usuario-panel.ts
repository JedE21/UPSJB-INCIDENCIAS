"use server";

/**
 * CREAR USUARIO DESDE EL PANEL ADMIN · SIR-UPSJB
 *
 * ÚNICO flujo privilegiado de la app: delega en la Edge Function
 * "crear-usuario" (desplegada en Supabase), que:
 *   · Verifica el JWT del llamante y exige rol ADMINISTRADOR.
 *   · Crea la cuenta en Supabase Auth (auth.admin.createUser).
 *   · Inserta el perfil 1:1 en public.perfiles y asigna el rol en
 *     usuarios_roles (fuente de verdad) con sincronizar_roles_auth.
 *
 * La service_role vive SOLO como secret de la Edge Function; jamás en Vercel
 * ni en el bundle del frontend. Esta Server Action:
 *   1. Repite la guardia local (sesión + ADMINISTRADOR + permiso).
 *   2. Extrae el access_token de las cookies (@supabase/ssr).
 *   3. Delega el trabajo privilegiado en la función (defense in depth).
 * RLS no aplica en la creación de usuarios de Auth: por eso existe el
 * endpoint dedicado en lugar de una inserción directa.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdminConPermiso } from "@/lib/admin/guardia";
import { supabaseUrl } from "@/lib/supabase/env";
import type { EstadoAccionAdmin } from "@/lib/admin/acciones";

/** URL de la Edge Function (proyecto Supabase; sin secretos en el paquete). */
const URL_FUNCION = `${supabaseUrl()}/functions/v1/crear-usuario`;

/** Nombre del rol en usuarios_roles (convención de 0005_seed_catalogos). */
export interface DatosNuevoUsuario {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  documento?: string;
  telefono?: string;
  rol: string;
}

/**
 * Extrae el access_token de sesión de las cookies del request actual.
 * Las cookies de @supabase/ssr son JSON con forma { access_token, ... }
 * en claves tipo "sb-<ref>-auth-token" (y fragmentos numerados rotos).
 */
async function tokenDeSesionActual(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const todas = cookieStore.getAll();

  // 1) Cookie completa (caso normal): JSON con access_token.
  const completa = todas.find((c) => c.name.includes("auth-token") && !/-\d+$/.test(c.name));
  if (completa) {
    try {
      const json = JSON.parse(completa.value) as { access_token?: string };
      if (json.access_token) return json.access_token;
    } catch {
      // formato inesperado; probar fragmentos
    }
  }

  // 2) Cookie partida en fragmentos (valor grande): recorrer -fragment0.
  const base = completa
    ? completa.name
    : (todas.find((c) => /auth-token-\d+$/.test(c.name))?.name.split(/-\d+$/)[0] ?? null);
  if (!base) return null;

  let ensamblado = "";
  for (let i = 0; ; i++) {
    const frag = cookieStore.get(`${base}-${i}`);
    if (!frag) break;
    ensamblado += frag.value;
  }
  if (!ensamblado) return null;
  try {
    const json = JSON.parse(ensamblado) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Crea el usuario. Devuelve EstadoAccionAdmin (error/exito) compatible
 * con la UI existente. La contraseña se entrega al admin para que la pase
 * al usuario (la función NO envía correos).
 */
export async function crearUsuarioPanel(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  // Guardia local — mismo criterio que el resto de módulos admin.
  const guardia = await exigirAdminConPermiso("usuarios");
  if (!guardia.ok) return { error: guardia.error };

  const datos: DatosNuevoUsuario = {
    correo: String(formData.get("correo") ?? "").trim(),
    contrasena: String(formData.get("contrasena") ?? ""),
    nombres: String(formData.get("nombres") ?? "").trim(),
    apellidoPaterno: String(formData.get("apellidoPaterno") ?? "").trim(),
    apellidoMaterno: String(formData.get("apellidoMaterno") ?? "").trim(),
    documento: String(formData.get("documento") ?? "").trim(),
    telefono: String(formData.get("telefono") ?? "").trim(),
    rol: String(formData.get("rol") ?? "").trim().toUpperCase(),
  };

  // Validaciones de cliente-rápida (la función revalida TODO server-side).
  if (!datos.correo) return { error: "El correo es obligatorio." };
  if (datos.contrasena.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!datos.nombres) return { error: "El nombre es obligatorio." };
  if (!datos.apellidoPaterno) return { error: "El apellido paterno es obligatorio." };
  if (!datos.rol) return { error: "Selecciona el rol del usuario." };

  const token = await tokenDeSesionActual();
  if (!token) return { error: "Sesión no disponible. Vuelve a iniciar sesión." };

  try {
    const resp = await fetch(URL_FUNCION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datos),
    });

    const cuerpo = (await resp.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!resp.ok || cuerpo.ok !== true) {
      // La función ya devuelve mensajes seguros en español.
      return { error: cuerpo.error ?? "No se pudo crear el usuario (verificado en la base de datos)." };
    }

    revalidatePath("/admin/usuarios");
    return {
      error: null,
      exito: `Usuario ${datos.correo} creado con rol ${datos.rol}. Entrega la contraseña por un canal seguro.`,
    };
  } catch {
    return { error: "No se pudo conectar con el servicio de creación de usuarios." };
  }
}

/** Nombre de usuario Supabase disponible para validaciones adicionales si la UI lo pide. */
export async function esCorreoDisponible(correo: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("correo_auth_disponible", { p_correo: correo });
  if (error) return true; // RPC no existe → dejar pasar, la función lo valida.
  return data !== false;
}
