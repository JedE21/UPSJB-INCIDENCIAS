"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { useToast } from "@/components/ui/toast";
import { crearEntidad, editarEntidad, type EstadoAccionAdmin } from "@/lib/admin/acciones";
import type { CampoEntidad, EntidadAdmin, FilaEntidad } from "@/lib/admin/entidades";
import type { Referencia } from "@/lib/admin/datos";

/**
 * Formulario CRUD genérico (modal). Se construye SOLO desde la definición
 * declarativa de la entidad: tipos, requeridos, rangos y CHECK replicados.
 * La validación del servidor y RLS vuelven a imponer las reglas.
 */

export interface ReferenciasEntidad {
  [key: string]: Referencia[];
}

/** Valor inicial de un campo para el formulario. */
function valorInicial(
  campo: CampoEntidad,
  fila: FilaEntidad | null,
  referencias: ReferenciasEntidad
): string {
  if (fila) {
    if (campo.tipo === "uuid") {
      // Para columnas FK anidadas el valor viene como objeto {id}.
      const rel = fila[campo.name];
      if (typeof rel === "string") return rel;
      if (rel && typeof rel === "object" && "id" in rel) return String((rel as { id: string }).id);
      return "";
    }
    const valor = fila[campo.name];
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "boolean") return valor ? "true" : "";
    return String(valor);
  }
  // Creación: defaults; para UUID, primera opción activa si existe.
  if (campo.tipo === "booleano") return campo.defecto ? "true" : "";
  if (campo.tipo === "uuid") {
    const lista = referencias[campo.name] ?? [];
    const primera = lista.find((r) => r.activo !== false) ?? lista[0];
    return primera?.id ?? "";
  }
  if (campo.defecto !== undefined) return String(campo.defecto);
  return "";
}

export function FormularioEntidad({
  entidad,
  fila,
  referencias,
}: {
  entidad: EntidadAdmin;
  /** Fila a editar; null/undefined → modo creación. */
  fila?: FilaEntidad | null;
  referencias?: ReferenciasEntidad;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const esEdicion = Boolean(fila);

  const [abierto, setAbierto] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [errorForm, setErrorForm] = React.useState<string | null>(null);

  // Valores controlados simplificados: FormData en el submit; solo los
  // booleanos usan estado (checkbox) porque su ausencia significa false.
  const iniciales = React.useMemo(() => {
    const valores: Record<string, string> = {};
    for (const campo of entidad.campos) {
      valores[campo.name] = valorInicial(campo, fila ?? null, referencias ?? {});
    }
    return valores;
  }, [entidad, fila, referencias]);

  const [valores, setValores] = React.useState<Record<string, string>>(iniciales);
  React.useEffect(() => setValores(iniciales), [iniciales]);

  const cerrar = () => {
    if (enviando) return;
    setAbierto(false);
    setErrorForm(null);
  };

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErrorForm(null);

    const fd = new FormData();
    fd.set("__entidad", entidad.slug);
    if (esEdicion && fila) {
      // PK simple → uuid; PK compuesta → JSON { col: valor } de las columnas PK.
      fd.set(
        "__id",
        entidad.claveCompuesta
          ? JSON.stringify(
              Object.fromEntries(entidad.claveCompuesta.map((c) => [c, String(fila[c] ?? "")]))
            )
          : fila.id
      );
    }

    for (const campo of entidad.campos) {
      if (!esEdicion || !campo.soloCreacion) {
        const valor = valores[campo.name] ?? "";
        // Booleano: "true" o ausente (validarCampo lo interpreta).
        fd.set(campo.name, campo.tipo === "booleano" ? (valor === "true" ? "true" : "") : valor);
      }
    }

    const accion = esEdicion ? editarEntidad : crearEntidad;
    let resultado: EstadoAccionAdmin;
    try {
      resultado = await accion(null, fd);
    } catch {
      resultado = { error: "No se pudo completar la operación. Intenta nuevamente." };
    }
    setEnviando(false);

    if (resultado.error) {
      setErrorForm(resultado.error);
      return;
    }

    toast({
      title: esEdicion ? "Cambios guardados" : "Registro creado",
      description: resultado.exito ?? undefined,
      variant: "success",
    });
    setAbierto(false);
    router.refresh();
  };

  // Entidades de solo lectura (sin campos editables, p. ej. movimientos):
  // no ofrecen alta ni edición desde la UI. Va DESPUÉS de los hooks.
  if (entidad.campos.length === 0) return null;

  const Icono = esEdicion ? Pencil : Plus;
  const camposVisibles = entidad.campos.filter(
    (c) =>
      // En edición se ocultan los campos de identidad (soloCreacion) salvo que
      // sean PK compuesta: se muestran deshabilitados como contexto de la fila.
      (!esEdicion || !c.soloCreacion) &&
      !(esEdicion && entidad.claveCompuesta?.includes(c.name))
  );

  return (
    <>
      {esEdicion ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAbierto(true)}
          aria-label={`Editar ${entidad.titulo.toLowerCase()}`}
          title="Editar"
        >
          <Icono aria-hidden />
        </Button>
      ) : (
        <Button onClick={() => setAbierto(true)}>
          <Plus aria-hidden />
          Nuevo
        </Button>
      )}

      <Modal
        open={abierto}
        onClose={cerrar}
        title={esEdicion ? `Editar — ${entidad.titulo}` : `Nuevo — ${entidad.titulo}`}
        description={
          esEdicion
            ? "Modifica los campos y guarda. Las reglas se revalidan en la base de datos."
            : entidad.descripcion
        }
        size="lg"
      >
        <form onSubmit={enviar} className="flex flex-col gap-4">
          {errorForm ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {errorForm}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {camposVisibles.map((campo) => {
              const id = `f-${entidad.slug}-${campo.name}`;
              const esFull = campo.tipo === "textoLargo";
              return (
                <FormField
                  key={campo.name}
                  label={campo.label}
                  htmlFor={id}
                  required={campo.requerido && !esEdicion}
                  hint={campo.hint}
                  className={esFull ? "sm:col-span-2" : undefined}
                >
                  {campo.tipo === "booleano" ? (
                    <label className="flex h-9 items-center gap-2 text-sm" htmlFor={id}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={valores[campo.name] === "true"}
                        onChange={(e) =>
                          setValores((v) => ({ ...v, [campo.name]: e.target.checked ? "true" : "" }))
                        }
                        className="size-4 rounded border-input accent-[var(--primary)]"
                      />
                      {campo.label}
                    </label>
                  ) : campo.tipo === "uuid" ? (
                    <Select
                      id={id}
                      value={valores[campo.name] ?? ""}
                      onChange={(e) => {
                        const nuevoValor = e.target.value;
                        setValores((v) => {
                          const siguiente = { ...v, [campo.name]: nuevoValor };
                          // Cascada: si este campo filtra a otro (marca→modelo),
                          // limpia el hijo si su padre ya no coincide.
                          for (const otro of entidad.campos) {
                            if (otro.uiFiltroPor !== campo.name) continue;
                            const valorHijo = v[otro.name] ?? "";
                            if (!valorHijo) continue;
                            const refHijo = (referencias?.[otro.name] ?? []).find(
                              (r) => r.id === valorHijo
                            );
                            if (refHijo?.padre_id && refHijo.padre_id !== nuevoValor) {
                              siguiente[otro.name] = "";
                            }
                          }
                          return siguiente;
                        });
                      }}
                      disabled={enviando}
                    >
                      <option value="">Selecciona…</option>
                      {(referencias?.[campo.name] ?? [])
                        .filter((ref) => {
                          // Si este campo es filtrado por otro (p. ej. modelos
                          // por marca), solo se muestran los hijos del padre
                          // elegido (o todo si aún no hay padre).
                          if (!campo.uiFiltroPor) return true;
                          const padre = valores[campo.uiFiltroPor] ?? "";
                          if (!padre) return true;
                          return !ref.padre_id || ref.padre_id === padre;
                        })
                        .map((ref) => (
                          <option key={ref.id} value={ref.id}>
                            {ref.nombre}
                            {ref.detalle ? ` — ${ref.detalle}` : ""}
                            {ref.activo === false ? " (inactivo)" : ""}
                          </option>
                        ))}
                    </Select>
                  ) : campo.tipo === "textoLargo" ? (
                    <Textarea
                      id={id}
                      value={valores[campo.name] ?? ""}
                      onChange={(e) => setValores((v) => ({ ...v, [campo.name]: e.target.value }))}
                      maxLength={campo.max}
                      rows={3}
                      disabled={enviando}
                    />
                  ) : (
                    <Input
                      id={id}
                      type={
                        campo.tipo === "entero" || campo.tipo === "decimal"
                          ? "number"
                          : campo.tipo === "fecha"
                            ? "date"
                            : "text"
                      }
                      min={campo.min}
                      max={campo.maxNum}
                      maxLength={campo.max}
                      value={valores[campo.name] ?? ""}
                      onChange={(e) => setValores((v) => ({ ...v, [campo.name]: e.target.value }))}
                      disabled={enviando}
                    />
                  )}
                </FormField>
              );
            })}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Spinner className="text-current" /> : null}
              {esEdicion ? "Guardar cambios" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
