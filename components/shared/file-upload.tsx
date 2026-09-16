"use client";

import * as React from "react";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FileUpload — componente VISUAL de carga de evidencias (fotos/documentos).
 * Solo selección y vista previa local (URL.createObjectURL); la subida a
 * Supabase Storage se implementa en la FASE 6 (Incidencias).
 */
export function FileUpload({
  accept = "image/*",
  maxArchivos = 3,
  hint = "PNG, JPG o WEBP · máx. 5 MB por archivo",
  onChange,
  className,
}: {
  accept?: string;
  maxArchivos?: number;
  hint?: string;
  /** Notifica la lista de archivos seleccionados. */
  onChange?: (files: File[]) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [arrastre, setArrastre] = React.useState(false);
  const [archivos, setArchivos] = React.useState<Array<{ file: File; url: string | null }>>([]);

  const agregar = (nuevos: FileList | null) => {
    if (!nuevos?.length) return;
    const lista = Array.from(nuevos)
      .slice(0, maxArchivos)
      .map((file) => ({
        file,
        // Vista previa local solo para imágenes.
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      }));
    setArchivos((prev) => {
      const siguientes = [...prev, ...lista].slice(0, maxArchivos);
      onChange?.(siguientes.map((a) => a.file));
      return siguientes;
    });
  };

  const quitar = (indice: number) => {
    setArchivos((prev) => {
      prev[indice]?.url && URL.revokeObjectURL(prev[indice].url as string);
      const siguientes = prev.filter((_, i) => i !== indice);
      onChange?.(siguientes.map((a) => a.file));
      return siguientes;
    });
  };

  React.useEffect(() => {
    return () => {
      archivos.forEach((a) => a.url && URL.revokeObjectURL(a.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastre(true);
        }}
        onDragLeave={() => setArrastre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastre(false);
          agregar(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
          arrastre ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/40"
        )}
        aria-label="Adjuntar archivos"
      >
        <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
        <span className="text-sm font-medium">
          Arrastra archivos o <span className="text-primary">selecciónalos</span>
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxArchivos > 1}
        className="hidden"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = "";
        }}
      />

      {archivos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Archivos adjuntos">
          {archivos.map((a, i) => {
            const esImagen = a.file.type.startsWith("image/");
            return (
              <li
                key={`${a.file.name}-${i}`}
                className="group relative overflow-hidden rounded-lg border bg-muted/30"
              >
                {esImagen && a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt={a.file.name}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    {esImagen ? (
                      <ImageIcon className="size-6" aria-hidden />
                    ) : (
                      <FileText className="size-6" aria-hidden />
                    )}
                    <span className="max-w-full truncate px-2 text-xs">{a.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  className="absolute right-1 top-1 rounded-md bg-background/90 p-1 shadow-sm transition-colors hover:bg-background"
                  aria-label={`Quitar ${a.file.name}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
