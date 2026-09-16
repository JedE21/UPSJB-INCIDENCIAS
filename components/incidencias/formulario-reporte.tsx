"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/shared/file-upload";
import {
  EQUIPOS_EJEMPLO,
  ETIQUETAS_PRIORIDAD,
  MAX_EVIDENCIA_FOTOS,
  PRIORIDADES_FORMULARIO,
  SUBTIPOS_INCIDENCIA,
  TIPOS_INCIDENCIA,
  clasesChipPrioridad,
  iconosPorTipo,
  type TipoIncidencia,
} from "@/lib/incidencias-catalogo";
import { cn } from "@/lib/utils";

/** Datos que produce el formulario (los consume la pantalla de confirmación). */
export interface DatosReporte {
  tipo: string;
  subtipo: string;
  descripcion: string;
  /** Equipo del ambiente relacionado, o "Sin equipo". */
  equipo: string;
  /** Cantidad de fotos adjuntas (el archivo no se sube aún: Fase 6). */
  fotos: number;
}

type ErroresReporte = Partial<Record<"tipo" | "subtipo" | "descripcion", string>>;

const PASOS = ["Incidencia", "Descripción", "Evidencia"] as const;

/**
 * Formulario de reporte — extremadamente sencillo (Plan Maestro §49):
 * la ubicación la aporta el QR (TarjetaAmbiente), el usuario solo indica
 * qué pasó (tipo → problema), describe con sus palabras y, si aplica,
 * señala el equipo y adjunta una foto opcional.
 *
 * Preparado para integración: el envío navega a la pantalla de confirmación
 * con los datos; cuando exista la lógica de incidencias (Fase 6) este envío
 * se reemplaza por la Server Action que crea la incidencia en Supabase.
 */
export function FormularioReporte({
  ambienteId,
  ambienteNombre,
}: {
  /** UUID del ambiente resuelto EN SERVIDOR desde el QR (integración Fase 6). */
  ambienteId?: string;
  /** Nombre del ambiente solo para visualización en la confirmación. */
  ambienteNombre?: string;
}) {
  const router = useRouter();

  const [paso, setPaso] = React.useState(0);
  const [tipo, setTipo] = React.useState<TipoIncidencia | "">("");
  const [subtipo, setSubtipo] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [equipo, setEquipo] = React.useState("Sin equipo");
  const [prioridad, setPrioridad] = React.useState<(typeof PRIORIDADES_FORMULARIO)[number]>("Media");
  const [fotos, setFotos] = React.useState<File[]>([]);
  const [errores, setErrores] = React.useState<ErroresReporte>({});
  const [enviando, setEnviando] = React.useState(false);

  // Ambiente resuelto en servidor (ruta /r/<codigo>). Con QR se envía al
  // confirmar; sin QR la maqueta navega solo con los datos del formulario.

  const subtiposDisponibles: readonly string[] = tipo ? SUBTIPOS_INCIDENCIA[tipo] : [];

  const alCambiarTipo = (nuevo: TipoIncidencia) => {
    setTipo(nuevo);
    const lista = SUBTIPOS_INCIDENCIA[nuevo];
    // Si el subtipo elegido no existe para el nuevo tipo, se limpia.
    setSubtipo((actual) => (lista.includes(actual) ? actual : ""));
  };

  const validar = (): ErroresReporte => {
    const errores: ErroresReporte = {};
    if (!tipo) errores.tipo = "Elige el tipo de incidencia.";
    if (tipo && !subtipo) errores.subtipo = "Elige el problema más cercano.";
    if (descripcion.trim().length < 10) {
      errores.descripcion =
        "Cuenta brevemente qué pasó (mínimo 10 caracteres). Con una frase es suficiente.";
    }
    return errores;
  };

  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errores = validar();
    setErrores(errores);
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);
    const datos: DatosReporte = {
      tipo,
      subtipo,
      descripcion: descripcion.trim(),
      equipo,
      fotos: fotos.length,
    };

    // INTEGRACIÓN (Fase 6): reemplazar por la Server Action que crea la
    // incidencia y devuelve el código único; entonces se navega con ese código.
    // El ambiente viaja como ambiente_id SOLO cuando llegó de un QR resuelto
    // en servidor; nunca se acepta un ambiente escrito por el cliente.
    const params = new URLSearchParams({
      tipo: datos.tipo,
      subtipo: datos.subtipo,
      equipo: datos.equipo,
      fotos: String(datos.fotos),
      prioridad,
      descripcion: datos.descripcion,
    });
    if (ambienteId) params.set("ambiente_id", ambienteId);
    if (ambienteNombre) params.set("ambiente", ambienteNombre);
    router.push(`/reportar/confirmacion?${params.toString()}`);
  };

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-8" aria-describedby="reporte-instruccion">
      <p id="reporte-instruccion" className="text-sm text-muted-foreground">
        Completa los tres pasos y envía: recibirás un código para hacer seguimiento.
      </p>

      {/* Pasos visuales (navegación con botones; el envío valida todo) */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Progreso del formulario">
        {PASOS.map((nombre, i) => {
          const activo = i === paso;
          return (
            <li key={nombre} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="h-px w-5 bg-border" aria-hidden />
              ) : null}
              <button
                type="button"
                onClick={() => setPaso(i)}
                aria-current={activo ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activo
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[10px]",
                    activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                {nombre}
              </button>
            </li>
          );
        })}
      </ol>

      {/* PASO 1 · ¿Qué pasó? */}
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">1 · ¿Qué pasó?</legend>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id="tipo-incidencia-label">
            Tipo de incidencia
            <span className="text-destructive" aria-hidden>
              {" "}*
            </span>
          </span>
          <div role="radiogroup" aria-labelledby="tipo-incidencia-label" className="flex flex-wrap gap-2">
            {TIPOS_INCIDENCIA.map((t) => {
              const checked = tipo === t;
              return (
                <label
                  key={t}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    checked
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="tipo-incidencia"
                    value={t}
                    checked={checked}
                    onChange={() => alCambiarTipo(t)}
                    className="peer sr-only"
                    aria-describedby={errores.tipo ? "tipo-incidencia-error" : undefined}
                  />
                  <span aria-hidden>{iconosPorTipo[t]}</span>
                  {t}
                </label>
              );
            })}
          </div>
          {errores.tipo ? (
            <p id="tipo-incidencia-error" role="alert" className="text-xs font-medium text-destructive">
              {errores.tipo}
            </p>
          ) : null}
        </div>

        <FormField
          label="Problema"
          htmlFor="subtipo-incidencia"
          required
          error={errores.subtipo}
          hint="Elige el problema más cercano; luego puedes detallarlo."
        >
          <Select
            value={subtipo}
            onChange={(e) => setSubtipo(e.target.value)}
            disabled={!tipo}
          >
            <option value="">{tipo ? "Selecciona el problema…" : "Elige primero el tipo…"}</option>
            {subtiposDisponibles.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>

      {/* PASO 2 · Descripción y equipo */}
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">2 · Descripción</legend>

        <FormField
          label="Cuéntanos qué pasó"
          htmlFor="descripcion-reporte"
          required
          error={errores.descripcion}
          hint={`${descripcion.length}/1000 caracteres · con una frase breve es suficiente`}
        >
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="Ej.: Al presionar el botón de encendido, la computadora no enciende y el LED no responde."
          />
        </FormField>

        <div className="flex flex-col gap-2">
          <p id="equipo-label" className="text-sm font-medium">
            ¿Está relacionado con un equipo?{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <div
            role="radiogroup"
            aria-labelledby="equipo-label"
            className="flex flex-wrap gap-2"
          >
            {(["Sin equipo", ...EQUIPOS_EJEMPLO] as const).map((nombre) => {
              const checked = equipo === nombre;
              return (
                <label
                  key={nombre}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    checked
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="equipo-relacionado"
                    value={nombre}
                    checked={checked}
                    onChange={() => setEquipo(nombre)}
                    className="peer sr-only"
                  />
                  {nombre}
                </label>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* PASO 3 · Evidencia, prioridad y envío */}
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">3 · Evidencia y envío</legend>

        <FormField
          label="Foto del problema"
          htmlFor="evidencia-reporte"
          hint="Opcional · ayuda al técnico a diagnosticar más rápido"
        >
          <FileUpload
            accept="image/*"
            maxArchivos={MAX_EVIDENCIA_FOTOS}
            hint={`Hasta ${MAX_EVIDENCIA_FOTOS} fotos · PNG, JPG o WEBP`}
            onChange={(files) => setFotos(files)}
          />
        </FormField>

        <div className="flex flex-col gap-2">
          <p id="prioridad-label" className="text-sm font-medium">
            ¿Qué tan urgente es?{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <div
            role="radiogroup"
            aria-labelledby="prioridad-label"
            className="flex flex-wrap gap-2"
          >
            {PRIORIDADES_FORMULARIO.map((p) => {
              const checked = prioridad === p;
              return (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    checked
                      ? clasesChipPrioridad[p]
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="prioridad-reporte"
                    value={p}
                    checked={checked}
                    onChange={() => setPrioridad(p)}
                    className="peer sr-only"
                  />
                  {p} · {ETIQUETAS_PRIORIDAD[p]}
                </label>
              );
            })}
          </div>
        </div>

        <Button type="submit" size="lg" disabled={enviando} className="w-full sm:w-auto">
          {enviando ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Enviando…
            </>
          ) : (
            <>
              Enviar reporte
              <ArrowRight aria-hidden />
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Al enviar recibirás un código único para consultar el estado de tu reporte.
        </p>
      </fieldset>
    </form>
  );
}
