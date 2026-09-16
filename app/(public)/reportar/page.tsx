import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { TarjetaAmbiente } from "@/components/incidencias/tarjeta-ambiente";
import { FormularioReporte } from "@/components/incidencias/formulario-reporte";

export const metadata: Metadata = {
  title: "Reportar incidencia",
  description:
    "Registra una incidencia en segundos: el QR identifica el ambiente; tú solo describes el problema.",
};

/** REPORTE · flujo principal Escanear QR → Reportar (§6 del Plan Maestro). */
export default function ReportarPage() {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <PageHeader
        icon={ClipboardList}
        title="Reportar incidencia"
        description="El ambiente ya está identificado. Solo dinos qué pasó."
      />

      <div className="flex flex-col gap-6">
        <TarjetaAmbiente />
        <FormularioReporte />
      </div>
    </div>
  );
}
