import { PanelShell } from "@/components/layout/panel-shell";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";
import { PANEL_PERFIL } from "@/lib/auth/roles";

/**
 * Panel del TÉCNICO.
 * Guard (servidor): exige sesión y rol TECNICO; si no, redirige.
 */
export default async function TecnicoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("tecnico");

  return (
    <PanelShell
      context="tecnico"
      sesion={{
        nombre: nombreCompleto(sesion.perfil),
        rol: sesion.roles[0] ?? "—",
        rutaPerfil: PANEL_PERFIL.tecnico,
      }}
    >
      {children}
    </PanelShell>
  );
}
