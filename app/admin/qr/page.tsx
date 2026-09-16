import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormularioCrearQr } from "@/components/qr/formulario-crear-qr";
import { TablaQr } from "@/components/qr/tabla-qr";
import { listarQr, listarAmbientesDisponibles } from "@/lib/qr/datos";

export const metadata: Metadata = { title: "Códigos QR — Admin" };

/**
 * ADMIN · CÓDIGOS QR (módulo QR, Fase 4 del Plan Maestro).
 * El layout del panel exige rol ADMINISTRADOR; las acciones re-validan y RLS
 * (p_qr_admin) decide al final.
 */
export default async function AdminQrPage() {
  const [filas, disponibles] = await Promise.all([listarQr(), listarAmbientesDisponibles()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={QrCode}
        title="Códigos QR"
        description="Crea, asocia, imprime y rota los códigos QR de los ambientes. Cada QR lleva a la URL estable /r/<codigo>."
      />

      <FormularioCrearQr ambientes={disponibles} />

      <TablaQr filas={filas} />
    </div>
  );
}
