import { contarNoLeidas } from "@/lib/notificaciones/datos";
import {
  ProveedorNotificacionesRealtime,
} from "@/lib/notificaciones/realtime";
import { RealtimeRefresher } from "@/components/notificaciones/realtime-refresher";

/**
 * PuertaRealtime — componente SERVIDOR que resuelve el contador inicial de
 * no leídas (RPC 0018, con el JWT del usuario) y monta el proveedor Realtime
 * del cliente. Lo usan los layouts de paneles; si no hay sesión, no monta
 * nada (sin suscripciones anónimas).
 */
export async function PuertaRealtime({
  habilitado,
  usuarioId,
  rutasRefresco = ["/notificaciones"],
  children,
}: {
  habilitado: boolean;
  /** Sesión resuelta por el layout: aísla el canal realtime por usuario. */
  usuarioId?: string;
  /** Rutas de servidor que se refrescan al llegar notificaciones. */
  rutasRefresco?: string[];
  children: React.ReactNode;
}) {
  if (!habilitado || !usuarioId) return <>{children}</>;

  const noLeidas = await contarNoLeidas();

  return (
    <ProveedorNotificacionesRealtime noLeidasIniciales={noLeidas} usuarioId={usuarioId}>
      <RealtimeRefresher rutas={rutasRefresco} />
      {children}
    </ProveedorNotificacionesRealtime>
  );
}
