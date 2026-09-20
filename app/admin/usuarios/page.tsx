import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TablaUsuarios } from "@/components/admin/usuarios/tabla-usuarios";
import { listarUsuarios, listarRolesOpciones } from "@/lib/admin/datos-usuarios";
import { mensajeDeLectura } from "@/lib/admin/guardia";

export const metadata: Metadata = { title: "Usuarios — Admin" };

/**
 * ADMIN · USUARIOS (FASE 7)
 * Listado completo de perfiles (RLS p_perfiles_admin) con búsqueda, filtros,
 * gestión de roles y suspensión de cuentas. El layout del panel ya exigió
 * sesión + ADMINISTRADOR; las acciones revalidan permiso gestionar_usuarios.
 */
export default async function AdminUsuariosPage() {
  const [{ usuarios, error }, roles] = await Promise.all([listarUsuarios(), listarRolesOpciones()]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Inicio", href: "/admin" }, { label: "Usuarios" }]} />
      <PageHeader
        icon={Users}
        title="Usuarios"
        description="Personas registradas en el sistema: roles asignados, estado de la cuenta y datos de contacto. Las credenciales se gestionan exclusivamente en Supabase Auth."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros</CardTitle>
          <CardDescription>
            Asigna roles para habilitar capacidades (el permiso efectivo es la unión por roles) y
            suspende cuentas cuando corresponda. Ningún usuario puede quitarse su propio rol de
            administrador desde aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TablaUsuarios
            usuarios={usuarios}
            roles={roles}
            errorCarga={error ? mensajeDeLectura({ message: error }) : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
