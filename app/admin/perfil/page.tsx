import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContenidoPerfil } from "@/components/auth/contenido-perfil";
import { getSesionObligatoria } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil · Admin" };

/**
 * PERFIL del panel ADMIN.
 * Antes re-exportaba la página de (usuario)/perfil, que ahora REDIRIGE al
 * admin con sesión ADMINISTRADOR → bucle infinito y perfil que no cargaba.
 * Renderiza directamente el contenido compartido (mismo archivo para los 4
 * paneles), con guard espejo: si la sesión NO es admin → a su panel.
 */
export default async function AdminPerfilPage() {
  const sesion = await getSesionObligatoria();

  if (!sesion.roles.includes("ADMINISTRADOR")) redirect("/perfil");

  return <ContenidoPerfil sesion={sesion} />;
}
