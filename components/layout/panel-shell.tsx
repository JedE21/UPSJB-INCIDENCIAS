import type { ReactNode } from "react";
import { PanelHeader } from "@/components/layout/panel-header";
import { PanelSidebar } from "@/components/layout/panel-sidebar";
import { MenuUsuario } from "@/components/auth/menu-usuario";
import { CampanaNotificaciones } from "@/components/notificaciones/campana-notificaciones";
import type { AppContext } from "@/lib/navigation";

/**
 * Contenedor común de los paneles autenticados.
 * La protección real de rutas por rol vive en el middleware + guards de layout;
 * aquí solo se muestra la sesión ya resuelta en el layout del panel.
 *
 * LAYOUT: el ADMINISTRADOR usa una BARRA LATERAL de navegación a la izquierda
 * (lista vertical; el grueso de módulos de /admin quedaría inmanejable en el
 * header). El resto de paneles sigue con el header horizontal tradicional.
 *
 * FASE 9: la campana usa el contador realtime provisto por PuertaRealtime
 * (montado en el layout); si un contexto no lo monta, la campana degrada a 0.
 */
export function PanelShell({
  context,
  sesion,
  children,
}: {
  context: Exclude<AppContext, "public">;
  /** Datos del menú de usuario; si falta, el header no muestra el menú. */
  sesion?: { nombre: string; rol: string; rutaPerfil?: string };
  children: ReactNode;
}) {
  const conSidebar = context === "admin";

  const cuerpo = conSidebar ? (
    <div className="flex flex-1">
      {/* Sidebar fija a la izquierda en ≥lg; colapsa arriba (lista horizontal
          del header móvil) en pantallas pequeñas. */}
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r bg-background/95 lg:block">
        <PanelSidebar context={context} />
      </aside>
      <main className="min-w-0 flex-1 px-seguro py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  ) : (
    <main className="mx-auto w-full max-w-6xl flex-1 px-seguro py-8">{children}</main>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <PanelHeader context={context} conSidebar={conSidebar}>
        {sesion ? <CampanaNotificaciones /> : null}
        {sesion ? <MenuUsuario nombre={sesion.nombre} rol={sesion.rol} rutaPerfil={sesion.rutaPerfil} /> : null}
      </PanelHeader>
      {cuerpo}
    </div>
  );
}
