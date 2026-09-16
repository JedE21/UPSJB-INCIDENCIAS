import { PanelShell } from "@/components/layout/panel-shell";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";

/**
 * Contexto "usuario" (docente, administrativo o estudiante autenticado).
 * Guard (servidor): exige sesión; el panel usuario es el de menor jerarquía.
 */
export default async function UsuarioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("usuario");

  return (
    <PanelShell
      context="usuario"
      sesion={{
        nombre: nombreCompleto(sesion.perfil),
        rol: sesion.roles[0] ?? "—",
        rutaPerfil: "/perfil",
      }}
    >
      {children}
    </PanelShell>
  );
}
