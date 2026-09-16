import type { Metadata } from "next";
import { FileSearch } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VistaSeguimiento } from "@/components/incidencias/vista-seguimiento";

export const metadata: Metadata = {
  title: "Consultar incidencia",
  description:
    "Consulta el estado de una incidencia con su código único: INC-AAAA-NNNNNN.",
};

interface Props {
  searchParams: Promise<{ codigo?: string }>;
}

/** SEGUIMIENTO · flujo principal Reportar → Seguimiento (§6, §30 del Plan Maestro). */
export default async function SeguimientoPage({ searchParams }: Props) {
  const { codigo } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <PageHeader
        icon={FileSearch}
        title="Consultar incidencia"
        description="Ingresa el código que recibiste al reportar (ej.: INC-2026-00128) para ver su estado e historial."
      />
      <VistaSeguimiento codigoInicial={codigo ?? ""} />
    </div>
  );
}
