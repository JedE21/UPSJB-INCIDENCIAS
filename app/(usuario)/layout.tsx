import { PanelShell } from "@/components/layout/panel-shell";
import { PuertaRealtime } from "@/components/notificaciones/puerta-realtime";
import { exigirPanel } from "@/lib/auth/session";
import { nombreCompleto } from "@/lib/auth/types";

/**
 * Contexto "usuario" (docente, administrativo o estudiante autenticado).
 * Guard (servidor): exige sesión; el panel usuario es el de menor jerarquía.
 *
 * FASE 9: PuertaRealtime monta el proveedor de notificaciones (contador +
 * suscripción postgres_changes con RLS) para el centro de notificaciones.
 */
export default async function UsuarioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel("usuario");

  return (
    <PuertaRealtime
      habilitado={Boolean(sesion)}
      usuarioId={sesion.usuarioId}
      rutasRefresco={["/notificaciones", "/mis-incidencias"]}
    >
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
    </PuertaRealtime>
  );
}
