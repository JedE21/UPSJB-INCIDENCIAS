import { PanelShell } from "@/components/layout/panel-shell";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";
import { PANEL_PERFIL } from "@/lib/auth/roles";

/**
 * Panel del COORDINADOR.
 * Guard (servidor): exige sesión y rol COORDINADOR o SUPERVISOR; si no, redirige.
 */
export default async function CoordinadorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("coordinador");

  return (
    <PanelShell
      context="coordinador"
      sesion={{
        nombre: nombreCompleto(sesion.perfil),
        rol: sesion.roles[0] ?? "—",
        rutaPerfil: PANEL_PERFIL.coordinador,
      }}
    >
      {children}
    </PanelShell>
  );
}
