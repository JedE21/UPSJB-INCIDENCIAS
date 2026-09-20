import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginaEntidad } from "@/components/admin/pagina-entidad";
import { MatrizRolesPermisos } from "@/components/admin/seguridad/matriz-roles-permisos";
import { createClient } from "@/lib/supabase/server";
import { mensajeDeLectura } from "@/lib/admin/guardia";

export const metadata: Metadata = { title: "Roles y permisos — Admin" };

/**
 * ADMIN · ROLES Y PERMISOS (FASE 7)
 * 1) CRUD de roles y permisos (entidades declarativas).
 * 2) Matriz rol ↔ permiso editable (roles_permisos; alternarPermisoRol).
 * Las políticas RLS de 0007 limitan la escritura a ADMINISTRADOR; la lectura
 * de roles/permisos es transversal (se usan para permisos efectivos).
 */
export default async function AdminRolesPage() {
  const supabase = await createClient();

  const [rolesRes, permisosRes, matrizRes] = await Promise.all([
    supabase.from("roles").select("id, nombre, activo").order("nombre"),
    supabase.from("permisos").select("id, codigo, descripcion").order("codigo"),
    supabase.from("roles_permisos").select("rol_id, permiso_id"),
  ]);

  const error = rolesRes.error ?? permisosRes.error ?? matrizRes.error;

  const roles = (rolesRes.data ?? []) as Array<{ id: string; nombre: string; activo: boolean }>;
  const permisos = (permisosRes.data ?? []) as Array<{
    id: string;
    codigo: string;
    descripcion: string | null;
  }>;
  const matriz = new Set(
    ((matrizRes.data ?? []) as Array<{ rol_id: string; permiso_id: string }>).map(
      (r) => `${r.rol_id}:${r.permiso_id}`
    )
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Inicio", href: "/admin" }, { label: "Roles y permisos" }]} />
      <PageHeader
        icon={ShieldCheck}
        title="Roles y permisos"
        description="Roles del sistema, permisos atómicos y su matriz de asignación. La decisión final de acceso siempre la toma RLS en la base de datos."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz rol ↔ permiso</CardTitle>
          <CardDescription>
            Marca o desmarca permisos por rol. Los cambios afectan de inmediato los permisos
            efectivos (unión por roles) que validan las políticas RLS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{mensajeDeLectura({ message: error.message })}</p>
          ) : (
            <MatrizRolesPermisos roles={roles} permisos={permisos} matriz={matriz} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles del sistema</CardTitle>
          <CardDescription>
            Crea o edita roles (p. ej. FACILITADOR). Los nombres de la semilla alimentan el JWT y
            las políticas; no los renombres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="seguridad" slug="roles" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permisos del sistema</CardTitle>
          <CardDescription>
            Catálogo de permisos atómicos usados por las políticas RLS y las acciones del servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaginaEntidad grupo="seguridad" slug="permisos" />
        </CardContent>
      </Card>
    </div>
  );
}
