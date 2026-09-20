import { PanelShell } from "@/components/layout/panel-shell";
import { PuertaRealtime } from "@/components/notificaciones/puerta-realtime";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";
import { PANEL_PERFIL } from "@/lib/auth/roles";

/**
 * Panel del ADMINISTRADOR.
 * Guard (servidor): exige sesión y rol ADMINISTRADOR; si no, redirige.
 *
 * FASE 9: PuertaRealtime habilita la campana de notificaciones y el
 * refresco de listas del panel vía Realtime (RLS por suscriptor).
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("admin");

  return (
    <PuertaRealtime
      habilitado={Boolean(sesion)}
      usuarioId={sesion.usuarioId}
      rutasRefresco={["/notificaciones", "/admin"]}
    >
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
    </PuertaRealtime>
  );
}
