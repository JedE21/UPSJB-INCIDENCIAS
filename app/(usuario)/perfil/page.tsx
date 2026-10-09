import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContenidoPerfil } from "@/components/auth/contenido-perfil";
import { getSesionObligatoria } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Perfil" };

/** PERFIL del panel USUARIO.
 *  El ADMINISTRADOR usa /admin/perfil: aquí solo redirige (no duplicar módulo).
 *  El contenido vive en components/auth/contenido-perfil.tsx compartido por
 *  los 4 paneles — esta página ya NO lo renderiza (evitaba loops). */
export default async function PerfilPage() {
  const sesion = await getSesionObligatoria();

  if (sesion.roles.includes("ADMINISTRADOR")) redirect("/admin/perfil");

  return <ContenidoPerfil sesion={sesion} />;
}
