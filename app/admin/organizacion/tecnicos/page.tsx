import { PaginaEntidad } from "@/components/admin/pagina-entidad";

/**
 * ADMIN · TÉCNICOS (FASE 7)
 * Fichas operativas de atención (tabla tecnicos): perfil 1:0..1 + área + sede
 * + carga. El ROL TECNICO para el acceso al panel se asigna desde Usuarios.
 * Mismo CRUD declarativo que el resto de entidades; RLS p_tecnicos_admin.
 */
export default function Page() {
  return <PaginaEntidad grupo="organizacion" slug="tecnicos" />;
}
