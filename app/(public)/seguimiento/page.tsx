import type { Metadata } from "next";
import { FileSearch } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VistaSeguimiento } from "@/components/incidencias/vista-seguimiento";
import { PanelGestion } from "@/components/incidencias/panel-gestion";
import {
  listarAreasActivas,
  listarServiciosPorArea,
  listarTecnicosPorArea,
  obtenerIncidenciaPorCodigo,
} from "@/lib/incidencias/datos";
import { obtenerDetalleSla } from "@/lib/incidencias/sla";
import { getSesion, tienePermiso } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Consultar incidencia",
  description:
    "Consulta el estado de una incidencia con su código único: INC-AAAA-NNNNNN.",
};

interface Props {
  searchParams: Promise<{ codigo?: string }>;
}

const CODIGO_REGEX = /^INC-\d{4}-\d{4,6}$/;

/**
 * SEGUIMIENTO (§30 del Plan Maestro) — versión real (Fase 6).
 * La lectura es por código único y la visibilidad la decide RLS: quien no
 * puede ver la incidencia recibe el mismo resultado que un código inexistente
 * (sin filtrar información). El historial viene de `incidencia_historial`
 * (append-only D9).
 */
export default async function SeguimientoPage({ searchParams }: Props) {
  const { codigo } = await searchParams;
  const codigoLimpio = (codigo ?? "").trim().toUpperCase();

  // Fallo de infraestructura → estado amigable (no 500 crudo); el usuario
  // puede reintentar. Sin código válido no se consulta la BD.
  let incidencia: Awaited<ReturnType<typeof obtenerIncidenciaPorCodigo>> = null;
  let falloServicio = false;
  if (CODIGO_REGEX.test(codigoLimpio)) {
    try {
      incidencia = await obtenerIncidenciaPorCodigo(codigoLimpio);
    } catch {
      falloServicio = true;
    }
  }

  // Capacidades del lector resueltas EN SERVIDOR: la UI solo oculta/muestra;
  // las decisiones reales las toman las RPC (0013/0016) y las policies RLS.
  const sesion = await getSesion();
  const puedeComentar = sesion ? await tienePermiso("comentar_incidencia") : false;
  const puedeAdjuntar = sesion ? await tienePermiso("adjuntar_evidencia") : false;
  const puedeDerivar = sesion ? await tienePermiso("derivar_incidencia") : false;
  const puedeAsignar = sesion ? await tienePermiso("asignar_incidencia") : false;
  const esAdmin = sesion ? await tienePermiso("gestionar_reglas") : false;

  // Catálogos del panel de gestión SOLO si hay capacidades operativas
  // (un usuario común no necesita áreas/servicios/técnicos).
  const [areas, servicios, tecnicos] = puedeDerivar || puedeAsignar || esAdmin
    ? await Promise.all([listarAreasActivas(), listarServiciosPorArea(), listarTecnicosPorArea()])
    : [[], [], []];

  // SLA (Fase 8b): estado del acuerdo calculado en BD (RPC 0017); null si el
  // lector no tiene acceso o la incidencia no tiene SLA configurado.
  const sla = incidencia ? await obtenerDetalleSla(incidencia.id) : null;

  return (
    <div className="relative mx-auto w-full max-w-2xl py-8">
      <div className="aurora-fondo" aria-hidden />
      <PageHeader
        icon={FileSearch}
        title="Consultar incidencia"
        description="Ingresa el código que recibiste al reportar (ej.: INC-2026-00128) para ver su estado e historial."
      />
      <VistaSeguimiento
        codigoInicial={codigoLimpio}
        incidencia={incidencia}
        sla={sla}
        puedeComentar={puedeComentar}
        puedeAdjuntar={puedeAdjuntar}
        falloServicio={falloServicio}
      />

      {incidencia && (puedeDerivar || puedeAsignar || esAdmin) ? (
        <div className="mt-6">
          <PanelGestion
            incidencia={incidencia}
            catalogos={{ areas, servicios, tecnicos }}
            puedeDerivar={puedeDerivar || esAdmin}
            puedeAsignar={puedeAsignar || esAdmin}
          />
        </div>
      ) : null}
    </div>
  );
}
