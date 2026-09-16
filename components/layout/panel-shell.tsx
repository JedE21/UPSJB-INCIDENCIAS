import type { ReactNode } from "react";
import { PanelHeader } from "@/components/layout/panel-header";
import { MenuUsuario } from "@/components/auth/menu-usuario";
import type { AppContext } from "@/lib/navigation";

/**
 * Contenedor común de los paneles autenticados.
 * La protección real de rutas por rol vive en el middleware + guards de layout;
 * aquí solo se muestra la sesión ya resuelta en el layout del panel.
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
  return (
    <div className="flex min-h-dvh flex-col">
      <PanelHeader context={context}>
        {sesion ? <MenuUsuario nombre={sesion.nombre} rol={sesion.rol} rutaPerfil={sesion.rutaPerfil} /> : null}
      </PanelHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
