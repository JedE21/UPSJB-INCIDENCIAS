import { PanelShell } from "@/components/layout/panel-shell";
import { PuertaRealtime } from "@/components/notificaciones/puerta-realtime";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";
import { PANEL_PERFIL } from "@/lib/auth/roles";

/**
 * Panel del TÉCNICO.
 * Guard (servidor): exige sesión y rol TECNICO; si no, redirige.
 *
 * FASE 9: PuertaRealtime habilita la campana y el refresco de listas
 * (dashboard/mis incidencias) cuando llegan notificaciones nuevas
 * (asignaciones, alertas SLA) por Realtime con RLS.
 */
export default async function TecnicoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("tecnico");

  return (
    <PuertaRealtime
      habilitado={Boolean(sesion)}
      usuarioId={sesion.usuarioId}
      rutasRefresco={["/notificaciones", "/tecnico/dashboard", "/tecnico/incidencias"]}
    >
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
    </PuertaRealtime>
  );
}
