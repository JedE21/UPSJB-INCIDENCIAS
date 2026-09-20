import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TablaEntidad } from "@/components/admin/tabla-entidad";
import { entidadPorSlug, GRUPOS_ADMIN, type EntidadAdmin } from "@/lib/admin/entidades";
import {
  listarEntidad,
  cargarReferencias,
  referenciasDeEntidad,
  ALIAS_REFERENCIAS,
} from "@/lib/admin/datos";
import { mensajeDeLectura } from "@/lib/admin/guardia";
import type { Referencia } from "@/lib/admin/datos";
import Link from "next/link";

/**
 * Sección genérica con pestañas por entidad (infraestructura, organización,
 * equipos, seguridad). Cada pestaña es una ruta /admin/<grupo>/<entidad>.
 * El layout del panel ya exigió sesión + ADMINISTRADOR; RLS decide por fila.
 */

export interface PropsEntidad {
  grupo: keyof typeof GRUPOS_ADMIN;
  slug: string;
  /** Acciones opcionales alineadas a la derecha de las pestañas. */
  acciones?: React.ReactNode;
}

/** Pestañas del grupo (solo entidades existentes en el grupo). */
function Pestanas({ grupo, activo }: { grupo: keyof typeof GRUPOS_ADMIN; activo: string }) {
  const definicion = GRUPOS_ADMIN[grupo];
  const entidades = definicion.entidades
    .map((slug) => entidadPorSlug(slug))
    .filter(Boolean) as EntidadAdmin[];
  if (entidades.length === 0) return null;

  return (
    <nav aria-label={`Secciones de ${definicion.titulo}`} className="flex flex-wrap gap-2">
      {entidades.map((e) => (
        <Link
          key={e.slug}
          href={`/admin/${grupo}/${e.slug}`}
          className={
            e.slug === activo
              ? "rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
              : "rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          }
          aria-current={e.slug === activo ? "page" : undefined}
        >
          {e.titulo}
        </Link>
      ))}
    </nav>
  );
}

/** Página de UNA entidad dentro de su grupo. */
export async function PaginaEntidad({ grupo, slug, acciones }: PropsEntidad) {
  const entidad = entidadPorSlug(slug);
  if (!entidad || entidad.grupo !== grupo) notFound();

  const definicion = GRUPOS_ADMIN[grupo];

  const [{ filas, error }, referencias] = await Promise.all([
    listarEntidad(entidad),
    cargarReferencias(referenciasDeEntidad(entidad)),
  ]);

  // Normaliza referencias a claves de CAMPO uuid (sede_id, equipo_id…)
  // invirtiendo el alias campo→tabla de datos.ts (fuente única).
  const referenciasPorCampo: Record<string, Referencia[]> = {};
  const aliasPorTabla: Record<string, string> = {};
  for (const [campo, tabla] of Object.entries(ALIAS_REFERENCIAS)) {
    aliasPorTabla[tabla] = campo;
  }
  for (const [key, valor] of Object.entries(referencias)) {
    referenciasPorCampo[key] = valor;
    const campo = aliasPorTabla[key];
    if (campo) referenciasPorCampo[campo] = valor;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/admin" },
          { label: definicion.titulo, href: `/admin/${grupo}/${definicion.entidades[0]}` },
          { label: entidad.titulo },
        ]}
      />
      <PageHeader
        icon={entidad.icono}
        title={entidad.titulo}
        description={entidad.descripcion}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pestanas grupo={grupo} activo={slug} />
        {acciones}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros</CardTitle>
          <CardDescription>
            Búsqueda, filtros y acciones. Al desactivar un registro, sus datos se conservan y deja de
            aparecer en los flujos operativos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TablaEntidad
            entidad={entidad}
            filas={filas}
            referencias={referenciasPorCampo}
            errorCarga={error ? mensajeDeLectura({ message: error }) : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
