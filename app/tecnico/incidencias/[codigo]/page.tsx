import type { Metadata } from "next";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Wrench } from "lucide-react";
import { VistaAtencionTecnico } from "@/components/tecnico/vista-atencion";
import { EmptyState } from "@/components/shared/empty-state";
import {
  obtenerIncidenciaPorCodigo,
  obtenerRegistroTecnico,
} from "@/lib/incidencias/datos";
import { obtenerDetalleSla } from "@/lib/incidencias/sla";
import { getSesion, tienePermiso } from "@/lib/auth/session";

interface Props {
  params: Promise<{ codigo: string }>;
}

export const metadata: Metadata = { title: "Atención de incidencia" };

const CODIGO_REGEX = /^INC-\d{4}-\d{4,6}$/;

/**
 * DETALLE DE ATENCIÓN DEL TÉCNICO.
 * La lectura completa (datos, historial, comentarios, evidencias con signed
 * URLs) se hace EN SERVIDOR: RLS decide la visibilidad; si el técnico no tiene
 * asignación activa, `incidencia_historial`/`_comentarios`/`_adjuntos` llegan
 * vacíos y las RPC 0013/0014 rechazan cualquier operación — no bastan botones
 * ocultos: la BD impone la autorización.
 */
export default async function AtencionIncidenciaPage({ params }: Props) {
  const { codigo: codigoParam } = await params;
  const codigo = decodeURIComponent(codigoParam).trim().toUpperCase();

  if (!CODIGO_REGEX.test(codigo)) {
    return <PantallaNoEncontrada codigo={codigo} />;
  }

  let incidencia = null;
  try {
    incidencia = await obtenerIncidenciaPorCodigo(codigo);
  } catch {
    return <PantallaNoEncontrada codigo={codigo} />;
  }

  if (!incidencia) {
    return <PantallaNoEncontrada codigo={codigo} />;
  }

  // Registro técnico (diagnóstico/acciones/solución) y SLA, ambos con
  // autorización en BD (RPC 0014 / RLS).
  const [registro, sla, puedeAdjuntar] = await Promise.all([
    obtenerRegistroTecnico(incidencia.id),
    obtenerDetalleSla(incidencia.id),
    tienePermiso("adjuntar_evidencia"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/tecnico/incidencias">
          <ArrowLeft aria-hidden />
          Volver a mis incidencias
        </Link>
      </Button>

      <PageHeader
        icon={Wrench}
        title="Atención de incidencia"
        description="Acepta, diagnostica, registra acciones y resuelve siguiendo el flujo del sistema."
      />

      <VistaAtencionTecnico
        incidencia={incidencia}
        registro={registro}
        sla={sla}
        puedeAdjuntar={puedeAdjuntar}
      />
    </div>
  );
}

/** Incidencia inexistente o no visible (RLS): pantalla clara, sin detalles. */
function PantallaNoEncontrada({ codigo }: { codigo: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/tecnico/incidencias">
          <ArrowLeft aria-hidden />
          Volver a mis incidencias
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10">
            <ShieldAlert className="size-6 text-amber-600" aria-hidden />
          </div>
          <CardTitle className="mt-2 text-xl">Incidencia no disponible</CardTitle>
          <CardDescription>
            {codigo
              ? `La incidencia ${codigo} no existe o no está asignada a tu nombre.`
              : "Código no válido."}{" "}
            Si crees que es un error, consulta con el coordinador de tu área.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title=""
            description="Solo puedes atender incidencias con asignación activa a tu nombre."
          />
        </CardContent>
      </Card>
    </div>
  );
}
