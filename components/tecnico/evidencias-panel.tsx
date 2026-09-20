"use client";

import * as React from "react";
import { Paperclip, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EVIDENCIA_MIME_PERMITIDOS,
  EVIDENCIA_TAMANO_MAX,
} from "@/lib/incidencias/evidencias";
import { tamanoLegible } from "@/lib/incidencias/formato";
import { fechaHora } from "@/lib/fechas";
import type { EvidenciaItem, IncidenciaDetalle } from "@/lib/incidencias/tipos";

const ETIQUETAS_EVIDENCIA: Record<string, string> = {
  antes: "Foto antes",
  durante: "Foto durante",
  despues: "Foto después",
  documento: "Documento",
  video: "Video",
};

/**
 * EvidenciasPanel — galería + subida de evidencias del técnico.
 * El archivo se envía a una Server Action que valida MIME/tamaño EN SERVIDOR,
 * arma el path y sube al bucket privado (policies 0009 + RPC 0013). El tipo
 * de evidencia queda "durante" (atención); el admin puede reclasificar.
 */
export function EvidenciasPanel({
  incidenciaId,
  evidencias,
  puedeAdjuntar,
  ocupado = false,
  onSubir,
}: {
  incidenciaId: string;
  evidencias: IncidenciaDetalle["adjuntos"];
  puedeAdjuntar: boolean;
  ocupado?: boolean;
  /** Sube el archivo vía Server Action; devuelve true si tuvo éxito. */
  onSubir: (archivo: File) => Promise<boolean>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = React.useState<File | null>(null);
  const [errorLocal, setErrorLocal] = React.useState<string | null>(null);
  const [subiendo, setSubiendo] = React.useState(false);

  const seleccionar = (files: FileList | null) => {
    const f = files?.[0] ?? null;
    setErrorLocal(null);
    if (!f) {
      setArchivo(null);
      return;
    }
    // Validación temprana solo UX: la real ocurre en servidor (RPC 0013).
    if (!EVIDENCIA_MIME_PERMITIDOS.includes(f.type as (typeof EVIDENCIA_MIME_PERMITIDOS)[number])) {
      setErrorLocal("Formato no permitido. Usa JPG, PNG, WEBP, PDF o MP4.");
      return;
    }
    if (f.size <= 0 || f.size > EVIDENCIA_TAMANO_MAX) {
      setErrorLocal("El archivo supera el tamaño máximo (10 MB).");
      return;
    }
    setArchivo(f);
  };

  const alSubir = async () => {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const ok = await onSubir(archivo);
      if (ok) setArchivo(null);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4 text-primary" aria-hidden />
          Evidencias ({evidencias.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {evidencias.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {evidencias.map((ev) => {
              const esImagen = ev.mime_type.startsWith("image/") && ev.url;
              return (
                <li key={ev.id} className="overflow-hidden rounded-lg border bg-muted/30">
                  <div className="relative">
                    {esImagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.url as string}
                        alt={`Evidencia: ${ev.nombre_archivo}`}
                        className="h-32 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                        <Paperclip className="size-7" aria-hidden />
                        <span className="px-2 text-center text-xs">
                          {ETIQUETAS_EVIDENCIA[ev.tipo] ?? "Evidencia"}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                      {ETIQUETAS_EVIDENCIA[ev.tipo] ?? ev.tipo}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-2.5 py-2">
                    <p className="truncate text-xs font-medium" title={ev.nombre_archivo}>
                      {ev.nombre_archivo}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {tamanoLegible(ev.tamano_bytes)} · {fechaHora(ev.creado_en)}
                    </p>
                    {ev.url ? (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Ver / descargar
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin acceso</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no hay evidencias. Adjunta fotos del avance, documentos o videos (MP4).
          </p>
        )}

        {puedeAdjuntar ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed px-4 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={subiendo || ocupado}
              >
                <UploadCloud aria-hidden />
                Elegir archivo
              </Button>
              {archivo ? (
                <span className="min-w-0 flex-1 truncate text-xs" title={archivo.name}>
                  {archivo.name} · {tamanoLegible(archivo.size)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  JPG, PNG, WEBP, PDF o MP4 · máx. 10 MB
                </span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!archivo || subiendo || ocupado}
                onClick={alSubir}
              >
                {subiendo ? "Subiendo…" : "Adjuntar"}
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={EVIDENCIA_MIME_PERMITIDOS.join(",")}
              className="hidden"
              onChange={(e) => {
                seleccionar(e.target.files);
                e.target.value = "";
              }}
            />
            {errorLocal ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errorLocal}
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              La validación de formato y tamaño se repite en el servidor; el archivo se guarda
              en un repositorio privado con acceso restringido a esta incidencia.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
