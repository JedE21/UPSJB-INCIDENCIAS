/** Tipos de la FASE 3 · Autenticación (solo lo usado en esta fase). */

/** Fila de public.perfiles (RLS: cada usuario solo lee la suya; el admin, todas). */
export interface Perfil {
  id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  documento: string | null;
  correo: string;
  telefono: string | null;
  codigo_usuario: string | null;
  estado: "activo" | "suspendido";
  creado_en: string;
  actualizado_en: string;
}

/** Nombre visible con apellidos (para headers y saludos). */
export function nombreCompleto(
  perfil: Pick<Perfil, "nombres" | "apellido_paterno" | "apellido_materno"> | null,
): string {
  if (!perfil) return "Usuario";
  return [perfil.nombres, perfil.apellido_paterno, perfil.apellido_materno]
    .filter(Boolean)
    .join(" ");
}

/** Estado de resultado estándar de las Server Actions de autenticación. */
export interface EstadoAccion {
  error: string | null;
  exito?: string | null;
}
