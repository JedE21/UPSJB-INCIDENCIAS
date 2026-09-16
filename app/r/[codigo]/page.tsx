import type { Metadata } from "next";
import { CircleSlash, MapPin, QrCode, ScanLine, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TarjetaAmbiente } from "@/components/incidencias/tarjeta-ambiente";
import { FormularioReporte } from "@/components/incidencias/formulario-reporte";
import { RegistrarLecturaQr } from "@/components/qr/registrar-lectura-qr";
import { resolverQrPublico } from "@/lib/qr/datos";

interface Props {
  params: Promise<{ codigo: string }>;
}

export const metadata: Metadata = { title: "Reportar desde QR" };

/** Formato institucional del código QR (CK de la BD). */
const CODIGO_REGEX = /^([A-Z0-9]+-)+[0-9]{4}$/;

/**
 * RUTA PÚBLICA DEL QR — QR → Identificación del ambiente → Formulario.
 *
 * Seguridad (todo en servidor; nunca parámetros del navegador confiables):
 *  · El código se valida contra la BD vía RPC SECURITY DEFINER (0011):
 *    si no existe → 404; si existe pero QR/ambiente/sede no están activos →
 *    pantalla 410 clara; solo si disponible=true se muestra el formulario.
 *  · El ambiente NO viene del cliente: el formulario lo recibe como prop
 *    inmutable; su envío usará el ambiente_id resuelto en servidor (Fase 6).
 */
export default async function QrPublicoPage({ params }: Props) {
  const { codigo: codigoParam } = await params;
  const codigo = decodeURIComponent(codigoParam).trim().toUpperCase();

  // Formato inválido → 404 sin tocar la BD (mismo contracto que código inexistente).
  if (!CODIGO_REGEX.test(codigo)) {
    return <PantallaNoEncontrado codigo={codigo} />;
  }

  let qr: Awaited<ReturnType<typeof resolverQrPublico>> = null;
  try {
    qr = await resolverQrPublico(codigo);
  } catch {
    // Fallo de infraestructura (BD no disponible): pantalla amigable con
    // reintentos manuales; nunca un 500 crudo en el teléfono del usuario.
    return <PantallaErrorServicio codigo={codigo} />;
  }

  if (!qr) {
    return <PantallaNoEncontrado codigo={codigo} />;
  }

  if (!qr.disponible) {
    return <PantallaDeshabilitado codigo={codigo} />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <RegistrarLecturaQr codigo={qr.qr_codigo} />

      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <ScanLine className="size-4 text-primary" aria-hidden />
        Ambiente identificado desde el QR escaneado
      </div>

      <div className="flex flex-col gap-6">
        <TarjetaAmbiente
          ubicacion={{
            ambiente_id: qr.ambiente_id,
            ambiente_nombre: qr.ambiente_nombre,
            ambiente_codigo: qr.ambiente_codigo,
            tipo_ambiente: qr.tipo_ambiente,
            piso: qr.piso_nombre ?? `Piso ${qr.piso_numero ?? "?"}`,
            pabellon: qr.pabellon_nombre,
            sede: qr.sede_nombre,
            qr_codigo: qr.qr_codigo,
          }}
        />
        <FormularioReporte ambienteId={qr.ambiente_id} ambienteNombre={qr.ambiente_nombre} />
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <QrCode className="size-3.5" aria-hidden />
        {qr.qr_codigo}
      </p>
    </div>
  );
}

/** El servicio no respondió: pantalla amigable (no 500 crudo). */
function PantallaErrorServicio({ codigo }: { codigo: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl py-16">
      <Card>
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10">
            <ShieldAlert className="size-6 text-amber-600" aria-hidden />
          </div>
          <CardTitle className="mt-2 text-xl">No se pudo verificar el código</CardTitle>
          <CardDescription>
            Tuvimos un problema temporal al validar el QR{" "}
            {codigo ? <span className="font-mono">({codigo})</span> : null}. Verifica tu conexión
            e intenta de nuevo escaneando el código.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/">Ir al inicio</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** QR inexistente (o formato inválido): 404 clara. */
function PantallaNoEncontrado({ codigo }: { codigo: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl py-16">
      <Card>
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10">
            <ShieldAlert className="size-6 text-amber-600" aria-hidden />
          </div>
          <CardTitle className="mt-2 text-xl">Código QR no reconocido</CardTitle>
          <CardDescription>
            El código {codigo ? <span className="font-mono">{codigo}</span> : "escaneado"} no
            corresponde a ningún ambiente registrado. Verifica que escaneaste el QR oficial del
            ambiente o repórtalo en las oficinas de la filial.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <a href="/">
              <MapPin className="size-4" aria-hidden />
              Ir al inicio
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** QR existente pero deshabilitado / ambiente o sede inactivos: 410 clara. */
function PantallaDeshabilitado({ codigo }: { codigo: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl py-16">
      <Card>
        <CardHeader>
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10">
            <CircleSlash className="size-6 text-amber-600" aria-hidden />
          </div>
          <CardTitle className="mt-2 text-xl">Código QR deshabilitado</CardTitle>
          <CardDescription>
            Este código fue reemplazado o deshabilitado por el administrador y ya no puede usarse
            para reportar. Busca el QR vigente en el ambiente{" "}
            {codigo ? <span className="font-mono">({codigo})</span> : null} o consulta en oficinas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <a href="/">
              <MapPin className="size-4" aria-hidden />
              Ir al inicio
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
