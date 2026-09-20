"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/shared/file-upload";
import { crearIncidencia, subirEvidencias } from "@/lib/incidencias/actions";
import {
  EVIDENCIA_MIME_PERMITIDOS,
  EVIDENCIA_TAMANO_MAX,
} from "@/lib/incidencias/evidencias";
import type { EquipoOpcion, OpcionCatalogo, OpcionSubtipo } from "@/lib/incidencias/tipos";
import { ETIQUETAS_PRIORIDAD, MAX_EVIDENCIA_FOTOS, clasesChipPrioridad } from "@/lib/incidencias-catalogo";
import { cn } from "@/lib/utils";

type ErroresReporte = Partial<Record<"tipo" | "subtipo" | "descripcion", string>>;

const PASOS = ["Incidencia", "Descripción", "Evidencia"] as const;

/** Props: catálogos precargados en servidor (fuente de verdad: BD). */
export interface FormularioReporteProps {
  tipos: OpcionCatalogo[];
  subtipos: OpcionSubtipo[];
  prioridades: Array<OpcionCatalogo & { nivel: number }>;
  /** UUID del ambiente resuelto EN SERVIDOR desde el QR (obligatorio). */
  ambienteId: string;
  /** Equipos activos del ambiente (RPC 0012); opcional en el reporte. */
  equipos?: EquipoOpcion[];
}

/**
 * Formulario de reporte — extremadamente sencillo (Plan Maestro §49):
 * la ubicación la aporta el QR (TarjetaAmbiente), el usuario solo indica
 * qué pasó (tipo → problema), describe con sus palabras y, si aplica,
 * señala la urgencia y adjunta una foto opcional.
 *
 * Integración (Fase 6): llama a la Server Action `crearIncidencia`; el
 * código único INC-AAAA-NNNNNN lo genera la BD (trigger + secuencia anual)
 * y el éxito navega a la confirmación con ese código. El envío exige sesión:
 * sin sesión se redirige a login conservando el retorno.
 */
export function FormularioReporte({ tipos, subtipos, prioridades, ambienteId, equipos = [] }: FormularioReporteProps) {
  const router = useRouter();

  const [paso, setPaso] = React.useState(0);
  const [tipoId, setTipoId] = React.useState("");
  const [subtipoId, setSubtipoId] = React.useState("");
  const [prioridadId, setPrioridadId] = React.useState("");
  const [equipoId, setEquipoId] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [fotos, setFotos] = React.useState<File[]>([]);
  const [errores, setErrores] = React.useState<ErroresReporte>({});
  const [enviando, setEnviando] = React.useState(false);
  const [errorGlobal, setErrorGlobal] = React.useState<string | null>(null);

  const subtiposDisponibles = React.useMemo(
    () => subtipos.filter((s) => s.tipo_incidencia_id === tipoId),
    [subtipos, tipoId]
  );

  const alCambiarTipo = (nuevoId: string) => {
    setTipoId(nuevoId);
    // Si el subtipo elegido no pertenece al nuevo tipo, se limpia.
    setSubtipoId((actual) =>
      subtipos.some((s) => s.id === actual && s.tipo_incidencia_id === nuevoId) ? actual : ""
    );
  };

  const validar = (): ErroresReporte => {
    const errores: ErroresReporte = {};
    if (!tipoId) errores.tipo = "Elige el tipo de incidencia.";
    if (tipoId && !subtipoId) errores.subtipo = "Elige el problema más cercano.";
    if (descripcion.trim().length < 10) {
      errores.descripcion =
        "Cuenta brevemente qué pasó (mínimo 10 caracteres). Con una frase es suficiente.";
    }
    // Validación temprana de fotos (solo UX: la real ocurre en servidor).
    const invalida = fotos.find(
      (f) =>
        !EVIDENCIA_MIME_PERMITIDOS.includes(f.type as (typeof EVIDENCIA_MIME_PERMITIDOS)[number]) ||
        f.size > EVIDENCIA_TAMANO_MAX
    );
    if (invalida) {
      errores.descripcion =
        'Una de las fotos no es válida (usa JPG, PNG o WEBP de hasta 10 MB).';
    }
    return errores;
  };

  const alEnviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errores = validar();
    setErrores(errores);
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);
    setErrorGlobal(null);
    try {
      const res = await crearIncidencia({
        ambiente_id: ambienteId,
        tipo_incidencia_id: tipoId,
        subtipo_incidencia_id: subtipoId,
        prioridad_id: prioridadId || null,
        equipo_id: equipoId || null,
        descripcion: descripcion.trim(),
      });

      if (res.error || !res.codigo) {
        setErrorGlobal(res.error ?? "No se pudo registrar la incidencia.");
        setEnviando(false);
        return;
      }

      // Evidencias (fase de trazabilidad): subida REAL a Storage privado con
      // metadatos + historial (RPC 0013). El id de la incidencia llega de la
      // misma acción (resuelto en servidor); el cliente nunca lo propone.
      // Si la subida falla, la incidencia NO se pierde: se informa y se
      // navega igualmente a la confirmación.
      if (fotos.length > 0 && res.id) {
        const resultado = await subirEvidencias(
          res.id,
          fotos.map((f) => ({ archivo: f, tipo: "antes" }))
        );
        if (resultado.error) {
          setErrorGlobal(
            `Reporte registrado (${res.codigo}), pero no se pudieron adjuntar todas las fotos: ${resultado.error}`
          );
          setEnviando(false);
          return;
        }
      }

      // Éxito: la confirmación muestra el código real generado por la BD.
      router.push(`/reportar/confirmacion?codigo=${encodeURIComponent(res.codigo)}`);
    } catch {
      setErrorGlobal("Error de conexión. Verifica tu red e intenta de nuevo.");
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-8" aria-describedby="reporte-instruccion">
      <p id="reporte-instruccion" className="text-sm text-muted-foreground">
        Completa los tres pasos y envía: recibirás un código para hacer seguimiento.
      </p>

      {errorGlobal ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{errorGlobal}</span>
        </div>
      ) : null}

      {/* Pasos visuales (navegación con botones; el envío valida todo) */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Progreso del formulario: paso {paso + 1} de {PASOS.length}">
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
            {tipos.map((t) => {
              const checked = tipoId === t.id;
              return (
                <label
                  key={t.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                    checked
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="tipo-incidencia"
                    value={t.id}
                    checked={checked}
                    onChange={() => alCambiarTipo(t.id)}
                    className="peer sr-only"
                    aria-describedby={errores.tipo ? "tipo-incidencia-error" : undefined}
                  />
                  {t.nombre}
                  {checked ? <span className="sr-only">(seleccionado)</span> : null}
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
            value={subtipoId}
            onChange={(e) => setSubtipoId(e.target.value)}
            disabled={!tipoId}
          >
            <option value="">
              {tipoId ? "Selecciona el problema…" : "Elige primero el tipo…"}
            </option>
            {subtiposDisponibles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>

      {/* PASO 2 · Descripción */}
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">2 · Descripción</legend>

        <FormField
          label="Cuéntanos qué pasó"
          htmlFor="descripcion-reporte"
          required
          error={errores.descripcion}
          hint={`${descripcion.length}/2000 caracteres · con una frase breve es suficiente`}
        >
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Ej.: Al presionar el botón de encendido, la computadora no enciende y el LED no responde."
          />
        </FormField>
      </fieldset>

      {/* PASO 3 · Evidencia, prioridad y envío */}
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">3 · Evidencia y envío</legend>

        <FormField
          label="Equipo relacionado"
          htmlFor="equipo-relacionado"
          hint={
            equipos.length > 0
              ? "Opcional · elige el equipo del ambiente con el problema."
              : "Opcional · este ambiente no tiene equipos registrados en el inventario."
          }
        >
          <Select
            value={equipoId}
            onChange={(e) => setEquipoId(e.target.value)}
            disabled={equipos.length === 0}
          >
            <option value="">
              {equipos.length > 0 ? "Sin equipo específico…" : "Sin equipo registrado…"}
            </option>
            {equipos.map((eq) => (
              <option key={eq.equipo_id} value={eq.equipo_id}>
                {eq.codigo_interno}
                {eq.categoria ? ` · ${eq.categoria}` : ""}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Foto del problema"
          htmlFor="evidencia-reporte"
          hint="Opcional · la subida de evidencias se habilita con la integración de Storage; tu selección queda registrada en el resumen."
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
            <span className="font-normal text-muted-foreground">(opcional — por defecto: Media)</span>
          </p>
          <div
            role="radiogroup"
            aria-labelledby="prioridad-label"
            className="flex flex-wrap gap-2"
          >
            {prioridades
              .filter((p) => p.nivel <= 3) // Crítica queda para coordinación (§19.2)
              .map((p) => {
                const etiqueta =
                  ETIQUETAS_PRIORIDAD[p.nombre as keyof typeof ETIQUETAS_PRIORIDAD] ?? "";
                const clasesChip =
                  clasesChipPrioridad[p.nombre as keyof typeof clasesChipPrioridad];
                const checked = prioridadId === p.id;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors",
                      checked
                        ? clasesChip ?? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <input
                      type="radio"
                      name="prioridad-reporte"
                      value={p.id}
                      checked={checked}
                      onChange={() => setPrioridadId(p.id)}
                      className="peer sr-only"
                      aria-label={`Urgencia ${p.nombre}${etiqueta ? `: ${etiqueta}` : ""}`}
                    />
                    {p.nombre}
                    {etiqueta ? ` · ${etiqueta}` : ""}
                  </label>
                );
              })}
          </div>
        </div>

        {/* Acción principal: pegada al fondo en móvil (alcance con el pulgar).
            El mínimo 48px de altura mantiene el target táctil recomendado. */}
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-1.5 border-t bg-background/95 px-4 pb-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none">
          <Button
            type="submit"
            size="lg"
            disabled={enviando}
            className="h-12 w-full text-base sm:w-auto sm:self-start"
            aria-describedby="reporte-nota-envio"
          >
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
          <p id="reporte-nota-envio" className="text-xs text-muted-foreground">
            Al enviar recibirás un código único para consultar el estado de tu reporte.
          </p>
        </div>
      </fieldset>
    </form>
  );
}
