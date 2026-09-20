/**
 * DATOS DEL MÓDULO USUARIOS · SIR-UPSJB (FASE 7)
 *
 * Lecturas en servidor con RLS: p_perfiles_admin + p_usuarios_roles_select
 * permiten al ADMINISTRADOR ver todos los perfiles y sus roles. Sin
 * service-role. Los datos de identidad (correo) vienen de la fila perfiles;
 * NUNCA de auth.users directamente.
 */

import { createClient } from "@/lib/supabase/server";
import { nombreCompleto } from "@/lib/auth/types";

export interface FilaUsuario {
  id: string;
  nombre: string;
  correo: string;
  documento: string | null;
  telefono: string | null;
  codigo_usuario: string | null;
  estado: "activo" | "suspendido";
  creado_en: string;
  roles: Array<{ id: string; nombre: string }>;
}

export interface ListadoUsuarios {
  usuarios: FilaUsuario[];
  error: string | null;
}

/** Lista TODOS los perfiles con sus roles (vista admin; RLS decide). */
export async function listarUsuarios(): Promise<ListadoUsuarios> {
  const supabase = await createClient();

  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select(
      `id, nombres, apellido_paterno, apellido_materno, correo, documento, telefono,
       codigo_usuario, estado, creado_en,
       usuarios_roles ( rol_id, roles ( id, nombre, activo ) )`
    )
    .order("creado_en", { ascending: false });

  if (error) return { usuarios: [], error: error.message };

  const usuarios = ((perfiles ?? []) as unknown as Array<{
    id: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string | null;
    correo: string | null;
    documento: string | null;
    telefono: string | null;
    codigo_usuario: string | null;
    estado: string;
    creado_en: string;
    usuarios_roles: Array<{ rol_id: string; roles: { id: string; nombre: string; activo: boolean } | null }> | null;
  }>).map((p) => ({
    id: p.id,
    nombre: nombreCompleto(p),
    correo: String(p.correo ?? ""),
    documento: p.documento,
    telefono: p.telefono,
    codigo_usuario: p.codigo_usuario,
    estado: (p.estado === "suspendido" ? "suspendido" : "activo") as "activo" | "suspendido",
    creado_en: p.creado_en,
    roles: (p.usuarios_roles ?? [])
      .filter((ur) => ur.roles)
      .map((ur) => ({ id: ur.roles!.id, nombre: ur.roles!.nombre })),
  }));

  return { usuarios, error: null };
}

/** Roles disponibles para asignar (activos + inactivos marcados). */
export interface RolOpcion {
  id: string;
  nombre: string;
  activo: boolean;
}

export async function listarRolesOpciones(): Promise<RolOpcion[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id, nombre, activo").order("nombre");
  return (data ?? []) as RolOpcion[];
}
