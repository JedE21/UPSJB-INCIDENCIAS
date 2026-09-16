import { PanelShell } from "@/components/layout/panel-shell";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";
import { PANEL_PERFIL } from "@/lib/auth/roles";

/**
 * Panel del ADMINISTRADOR.
 * Guard (servidor): exige sesión y rol ADMINISTRADOR; si no, redirige.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("admin");

  return (
    <PanelShell
      context="admin"
      sesion={{
        nombre: nombreCompleto(sesion.perfil),
        rol: sesion.roles[0] ?? "—",
        rutaPerfil: PANEL_PERFIL.admin,
      }}
    >
      {children}
    </PanelShell>
  );
}
