import { BadgeCheck, Building2, DoorOpen, MapPin, QrCode } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AMBIENTE_DEMO } from "@/lib/incidencias-catalogo";

/** Ubicación resuelta en servidor desde la lectura del QR. */
export interface UbicacionAmbiente {
  ambiente_id: string;
  ambiente_nombre: string;
  ambiente_codigo: string;
  tipo_ambiente: string | null;
  piso: string;
  pabellon: string | null;
  sede: string | null;
  qr_codigo: string;
}

/**
 * TarjetaAmbiente — ubicación del reporte.
 *
 * La ubicación (sede, pabellón, piso, ambiente) NO se pide al usuario: llega
 * resuelta desde el servidor (ruta /r/<codigo>) y se muestra como prop
 * inmutable. Sin prop (acceso directo a /reportar sin QR) muestra el ambiente
 * de demostración con aviso explícito.
 */
export function TarjetaAmbiente({ ubicacion }: { ubicacion?: UbicacionAmbiente }) {
  const nombre = ubicacion?.ambiente_nombre ?? AMBIENTE_DEMO.nombre;
  const sede = ubicacion?.sede ?? AMBIENTE_DEMO.sede;
  const pabellon = ubicacion?.pabellon ?? AMBIENTE_DEMO.pabellon;
  const piso = ubicacion?.piso ?? AMBIENTE_DEMO.piso;
  const codigoQR = ubicacion?.qr_codigo ?? AMBIENTE_DEMO.codigoQR;
  const desdeQr = Boolean(ubicacion);

  return (
    <Card aria-label="Ambiente identificado">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="size-4 text-primary" aria-hidden />
            {nombre}
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="size-3" aria-hidden />
            {desdeQr ? "Ambiente identificado" : "Ejemplo (sin QR)"}
          </Badge>
        </div>
        <CardDescription>
          {desdeQr
            ? "Esta ubicación fue identificada desde el código QR. No necesitas escribirla."
            : "Estás en la demo del formulario: al entrar escaneando un QR, esta tarjeta mostrará el ambiente real."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          {sede}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden />
          {pabellon} · {piso}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <QrCode className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="font-mono text-xs">{codigoQR}</span>
        </p>
      </CardContent>
    </Card>
  );
}
