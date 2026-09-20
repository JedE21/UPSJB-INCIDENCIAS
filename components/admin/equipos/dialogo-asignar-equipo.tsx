"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { asignarEquipoAAmbiente } from "@/lib/admin/acciones-equipos";
import type { Referencia } from "@/lib/admin/datos";

/**
 * DIÁLOGO EQUIPO ↔ AMBIENTE (FASE 7)
 *
 * Alta guiada de asignación: elige un equipo activo SIN ubicación activa y un
 * ambiente activo. La BD revalida todo (FK restrict, unicidad de asignación
 * activa y registro del movimiento por trigger).
 */
export function DialogoAsignarEquipo({
  equipos,
  ambientes,
}: {
  equipos: Referencia[];
  ambientes: Referencia[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [abierto, setAbierto] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [errorForm, setErrorForm] = React.useState<string | null>(null);
  const [equipoId, setEquipoId] = React.useState("");
  const [ambienteId, setAmbienteId] = React.useState("");

  const equiposDisponibles = React.useMemo(
    () => equipos.filter((e) => e.activo !== false),
    [equipos]
  );
  const ambientesDisponibles = React.useMemo(
    () => ambientes.filter((a) => a.activo !== false),
    [ambientes]
  );

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
    fd.set("equipo_id", equipoId);
    fd.set("ambiente_id", ambienteId);
    let res;
    try {
      res = await asignarEquipoAAmbiente(null, fd);
    } catch {
      res = { error: "No se pudo completar la asignación." };
    }
    setEnviando(false);
    if (res.error) {
      setErrorForm(res.error);
      return;
    }
    toast({ title: "Equipo asignado", description: res.exito ?? undefined, variant: "success" });
    setAbierto(false);
    setEquipoId("");
    setAmbienteId("");
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <Link2 aria-hidden />
        Asignar a ambiente
      </Button>

      <Modal
        open={abierto}
        onClose={cerrar}
        title="Asignar equipo a ambiente"
        description="Registra la ubicación actual de un activo. Al reasignar, la ubicación anterior se cierra y el movimiento queda en el historial."
        size="lg"
      >
        <form onSubmit={enviar} className="flex flex-col gap-4">
          {errorForm ? (
            <Alert variant="destructive">{errorForm}</Alert>
          ) : null}

          <FormField
            label="Equipo"
            htmlFor="asig-equipo"
            required
            hint={
              equiposDisponibles.length === 0
                ? "Primero registra equipos en la pestaña Equipos."
                : undefined
            }
          >
            <Select
              id="asig-equipo"
              value={equipoId}
              onChange={(e) => setEquipoId(e.target.value)}
              disabled={enviando}
            >
              <option value="">Selecciona un equipo…</option>
              {equiposDisponibles.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}
                  {eq.detalle ? ` — ${eq.detalle}` : ""}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Ambiente"
            htmlFor="asig-ambiente"
            required
            hint={
              ambientesDisponibles.length === 0
                ? "Primero crea ambientes en Infraestructura."
                : "La FK de base de datos impide asignar a un ambiente inexistente."
            }
          >
            <Select
              id="asig-ambiente"
              value={ambienteId}
              onChange={(e) => setAmbienteId(e.target.value)}
              disabled={enviando}
            >
              <option value="">Selecciona un ambiente…</option>
              {ambientesDisponibles.map((am) => (
                <option key={am.id} value={am.id}>
                  {am.nombre}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !equipoId || !ambienteId}>
              {enviando ? <Spinner className="text-current" /> : null}
              Asignar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
