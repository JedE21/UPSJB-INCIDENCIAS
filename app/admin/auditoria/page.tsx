import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FiltrosAuditoriaForm } from "@/components/auditoria/filtros-auditoria";
import {
  obtenerAuditoria,
} from "@/lib/auditoria/datos";
import {
  parsearFiltrosAuditoria,
  queryAuditoria,
  TAMANO_PAGINA,
} from "@/lib/auditoria/constantes";
import { fechaHora } from "@/lib/fechas";

export const metadata: Metadata = { title: "Auditoría — Admin" };

/**
 * CONSULTA ADMINISTRATIVA DE AUDITORÍA (FASE 11 — Plan §41/§49).
 * Read-only: la escritura de registros la hacen triggers/RPC en BD
 * (append-only). La autorización la impone la RPC consultar_auditoria
 * (admin + ver_auditoria); sin permiso la bandeja muestra el error.
 */
export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtros = parsearFiltrosAuditoria(sp);
  const { registros, error } = await obtenerAuditoria(filtros);

  const hayAnterior = filtros.pagina > 1;
  const haySiguiente = registros.length === TAMANO_PAGINA;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ScrollText}
        title="Auditoría del sistema"
        description="Registro append-only de acciones importantes: quién, cuándo, qué entidad y con qué valores. No puede editarse ni borrarse desde la aplicación."
      />

      <FiltrosAuditoriaForm />

      {error && (
        <div className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && registros.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Sin registros para los filtros aplicados.
        </div>
      )}

      {registros.length > 0 && (
        <div className="flex flex-col gap-3">
          {registros.map((r) => (
            <article key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  {r.accion}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.tabla_afectada}
                </span>
                {r.codigo_referencia && (
                  <span className="font-mono text-xs">{r.codigo_referencia}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {fechaHora(r.creado_en)}
                </span>
              </div>
              <p className="mt-2 text-sm">
                {r.actor_nombre ?? (r.actor_id ? "Usuario del sistema" : "Sistema (sin actor)")}
              </p>
              {(r.valores_previos || r.valores_nuevos) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    Ver detalle del evento
                  </summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {r.valores_previos && (
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        {JSON.stringify(r.valores_previos, null, 2)}
                      </pre>
                    )}
                    {r.valores_nuevos && (
                      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                        {JSON.stringify(r.valores_nuevos, null, 2)}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </article>
          ))}

          {/* Paginación */}
          <nav className="flex items-center justify-between pt-2">
            {hayAnterior ? (
              <Link
                href={`/admin/auditoria?${queryAuditoria(filtros, filtros.pagina - 1)}`}
                className="inline-flex items-center gap-1 text-sm hover:underline"
              >
                <ChevronLeft className="size-4" aria-hidden /> Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground">Página {filtros.pagina}</span>
            {haySiguiente ? (
              <Link
                href={`/admin/auditoria?${queryAuditoria(filtros, filtros.pagina + 1)}`}
                className="inline-flex items-center gap-1 text-sm hover:underline"
              >
                Siguiente <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
