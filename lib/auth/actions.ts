"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClientEfimero } from "@/lib/supabase/efimero";
import { getSesion } from "@/lib/auth/session";
import { homeDeRoles } from "@/lib/auth/roles";
import type { EstadoAccion } from "@/lib/auth/types";

/**
 * SERVER ACTIONS DE AUTENTICACIÓN · SIR-UPSJB
 *
 * Las CREDENCIALES las gestiona exclusivamente Supabase Auth (auth.users):
 * aquí NUNCA se lee ni escribe una contraseña en perfiles ni en ninguna tabla
 * propia. perfiles almacena solo información complementaria (nombres, docs,
 * contacto) — ver migración 0001 y docs/01.
 *
 * Contratos con la UI (useActionState):
 *  · Con éxito de login → redirect() al home del panel del rol.
 *  · Con éxito de recovery/reset → redirect() a la página informativa.
 *  · Errores → { error: "mensaje humano" } (nunca datos internos).
 */

/** Solo corre en servidor; blinda contra uso accidental desde el browser. */
function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("Las acciones de autenticación solo corren en el servidor.");
  }
}

/** Origen de la petición para los enlaces de email (recovery/reset). */
async function origenSitio(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Sanitiza el parámetro `siguiente` para evitar open redirects. */
function destinoSeguro(valor: FormDataEntryValue | null): string | null {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  return valor;
}

// ============================================================================
// 1. LOGIN
// ============================================================================
export async function iniciarSesion(
  _estadoPrevio: EstadoAccion | null,
  formData: FormData,
): Promise<EstadoAccion> {
  assertServer();

  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(formData.get("contrasena") ?? "");
  const siguiente = destinoSeguro(formData.get("siguiente"));

  if (!correo || !contrasena) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });

  if (error) {
    const mensaje =
      error.message === "Invalid login credentials"
        ? "Correo o contraseña incorrectos."
        : error.message === "Email not confirmed"
          ? "Tu cuenta aún no fue confirmada. Revisa tu correo."
          : "No se pudo iniciar sesión. Intenta nuevamente.";
    return { error: mensaje };
  }

  // Roles desde el JWT recién emitido para redirigir al panel correcto.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const roles = Array.isArray(user?.app_metadata?.roles)
    ? (user!.app_metadata.roles as string[])
    : [];

  // redirect() lanza una excepción interna: no va dentro de try/catch.
  redirect(siguiente ?? homeDeRoles(roles));
}

// ============================================================================
// 2. LOGOUT
// ============================================================================
export async function cerrarSesion(): Promise<void> {
  assertServer();

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login?cerrado=1");
}

// ============================================================================
// 3. RECUPERACIÓN DE CONTRASEÑA (envía el correo con enlace mágico)
// ============================================================================
export async function recuperarContrasena(
  _estadoPrevio: EstadoAccion | null,
  formData: FormData,
): Promise<EstadoAccion> {
  assertServer();

  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  if (!correo) return { error: "Ingresa el correo de tu cuenta." };

  const supabase = await createClient();
  const redirectTo = `${await origenSitio()}/auth/callback?tipo=recuperacion`;

  const { error } = await supabase.auth.resetPasswordForEmail(correo, { redirectTo });

  // Respuesta neutra: no revelar si el correo existe o no (enumeración).
  if (error) {
    return { error: "No se pudo enviar el correo. Intenta nuevamente." };
  }

  return {
    error: null,
    exito:
      "Si el correo corresponde a una cuenta activa, recibirás un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.",
  };
}

// ============================================================================
// 4. RESTABLECER CONTRASEÑA (llega desde el enlace del correo)
// ============================================================================
export async function restablecerContrasena(
  _estadoPrevio: EstadoAccion | null,
  formData: FormData,
): Promise<EstadoAccion> {
  assertServer();

  const contrasena = String(formData.get("contrasena") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (contrasena.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (contrasena !== confirmacion) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/restablecer?estado=enlace-invalido");
  }

  const { error } = await supabase.auth.updateUser({ password: contrasena });
  if (error) {
    return { error: "No se pudo actualizar la contraseña. Solicita un nuevo enlace." };
  }

  redirect("/restablecer?estado=exito");
}

// ============================================================================
// 5. PERFIL: actualizar datos complementarios (NUNCA credenciales)
// ============================================================================
export async function actualizarPerfil(
  _estadoPrevio: EstadoAccion | null,
  formData: FormData,
): Promise<EstadoAccion> {
  assertServer();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const nombres = String(formData.get("nombres") ?? "").trim();
  const apellidoPaterno = String(formData.get("apellido_paterno") ?? "").trim();
  const apellidoMaterno = String(formData.get("apellido_materno") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const documento = String(formData.get("documento") ?? "").trim();

  if (!nombres || !apellidoPaterno) {
    return { error: "Nombres y apellido paterno son obligatorios." };
  }
  if (telefono && !/^[0-9+\-\s()]{6,20}$/.test(telefono)) {
    return { error: "El teléfono no tiene un formato válido." };
  }

  // RLS garantiza que solo pueda actualizar SU fila (p_perfiles_update).
  const { error } = await supabase
    .from("perfiles")
    .update({
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno || null,
      telefono: telefono || null,
      documento: documento || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "No se pudo guardar el perfil. Intenta nuevamente." };
  }

  revalidatePath("/perfil");
  revalidatePath("/tecnico/perfil");
  revalidatePath("/admin/usuarios");
  return { error: null, exito: "Perfil actualizado correctamente." };
}

// ============================================================================
// 6. PERFIL: cambiar contraseña (cuenta logueada, sección "Seguridad")
// ============================================================================
export async function cambiarContrasena(
  _estadoPrevio: EstadoAccion | null,
  formData: FormData,
): Promise<EstadoAccion> {
  assertServer();

  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (nueva.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (nueva !== confirmacion) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();

  // Verificación de la contraseña actual con un cliente EFÍMERO (no toca las
  // cookies de la sesión activa del usuario).
  const { error: errorVerificacion } = await (await createClientEfimero()).auth.signInWithPassword({
    email: correo,
    password: actual,
  });

  if (errorVerificacion) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    return { error: "No se pudo cambiar la contraseña. Intenta nuevamente." };
  }

  return { error: null, exito: "Contraseña actualizada correctamente." };
}
