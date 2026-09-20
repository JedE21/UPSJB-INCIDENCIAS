"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, Route, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  asignarTecnicoIncidencia,
  clasificarIncidencia,
  derivarIncidencia,
} from "@/lib/incidencias/actions";
import type { DerivacionResumen, IncidenciaDetalle } from "@/lib/incidencias/tipos";
import { fechaHora } from "@/lib/fechas";

/**
 * PANEL DE GESTIÓN · FASE 8 (Plan Maestro §36, §40)
 *
 * Derivación y asignación MANUAL AUTORIZADA sobre una incidencia visible:
 *   · «Evaluar reglas»  → clasificar_incidencia (reglas configurables en BD).
 *   · «Derivar»         → derivar_incidencia (motivo obligatorio, auditoría).
 *   · «Asignar técnico» → asignar_incidencia (técnico activo del área destino).
 *
 * La UI solo muestra botones según capacidades resueltas EN SERVIDOR; quien
 * autoriza de verdad es la RPC 0016 (admin / coordinador del área vigente /
 * permiso derivar_incidencia o asignar_incidencia). Un usuario sin permisos
 * recibe el rechazo de la BD aunque manipule el cliente.
 */

export interface CatalogosGestion {
  areas: Array<{ id: string; nombre: string }>;
  servicios: Array<{ id: string; nombre: string; area_id: string }>;
  tecnicos: Array<{ id: string; nombre: string; area_id: string }>;
}

export function PanelGestion({
  incidencia,
  catalogos,
  puedeDerivar,
  puedeAsignar,
}: {
  incidencia: Pick<
    IncidenciaDetalle,
    "id" | "estado" | "derivaciones" | "area_responsable" | "servicio_responsable"
  >;
  catalogos: CatalogosGestion;
  /** Capacidades resueltas en servidor (tienePermiso) para mostrar botones. */
  puedeDerivar: boolean;
  puedeAsignar: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const [modalDerivar, setModalDerivar] = React.useState(false);
  const [modalAsignar, setModalAsignar] = React.useState(false);

  const derivaciones: DerivacionResumen[] = incidencia.derivaciones ?? [];
  const vigente = derivaciones.find((d) => d.activa) ?? null;
  const enFlujo = !["Cerrada", "Cancelada", "Resuelta"].includes(incidencia.estado);

  const ejecutar = async (
    clave: string,
    operacion: () => Promise<{ error: string | null }>,
    mensajeExito: string
  ) => {
    setOcupado(clave);
    try {
      const res = await operacion();
      if (res.error) {
        toast({ title: "No se pudo completar", description: res.error, variant: "destructive" });
      } else {
        toast({ title: mensajeExito, variant: "success" });
        router.refresh();
        return true;
      }
    } catch {
      toast({
        title: "Error de conexión",
        description: "Verifica tu red e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setOcupado(null);
    }
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Route className="size-5 text-primary" aria-hidden />
          Clasificación y derivación
        </CardTitle>
        <CardDescription>
          {vigente ? (
            <>
              Área responsable: <strong>{vigente.area_destino}</strong>
              {vigente.servicio_destino ? ` · ${vigente.servicio_destino}` : ""} (destino vigente).
            </>
          ) : (
            "Sin área responsable: la incidencia queda Pendiente hasta que una regla o una derivación manual defina el destino."
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {enFlujo && (puedeDerivar || puedeAsignar) ? (
          <div className="flex flex-wrap gap-2">
            {puedeDerivar && !vigente && incidencia.estado === "Pendiente" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={ocupado !== null}
                onClick={() =>
                  ejecutar(
                    "clasificar",
                    () => clasificarIncidencia(incidencia.id),
                    "Clasificación aplicada con las reglas vigentes."
                  )
                }
              >
                {ocupado === "clasificar" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Route className="size-4" aria-hidden />
                )}
                Evaluar reglas
              </Button>
            ) : null}
            {puedeDerivar ? (
              <Button variant="outline" size="sm" onClick={() => setModalDerivar(true)}>
                <ArrowRightLeft className="size-4" aria-hidden />
                Derivar
              </Button>
            ) : null}
            {puedeAsignar && vigente ? (
              <Button variant="outline" size="sm" onClick={() => setModalAsignar(true)}>
                <UserPlus className="size-4" aria-hidden />
                Asignar técnico
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Historial de derivaciones (Regla 6: destino vigente = fila activa) */}
        {derivaciones.length > 0 ? (
          <ol className="flex flex-col gap-3" aria-label="Historial de derivaciones">
            {derivaciones.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border px-3 py-2 text-sm"
                data-activa={d.activa || undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {d.area_origen ? `${d.area_origen} → ` : "Registro inicial → "}
                    {d.area_destino}
                    {d.servicio_destino ? ` · ${d.servicio_destino}` : ""}
                  </span>
                  {d.activa ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Vigente
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{d.motivo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fechaHora(d.derivado_en)}
                  {d.derivado_por ? ` · ${d.derivado_por}` : " · Sistema"}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no hay derivaciones registradas para esta incidencia.
          </p>
        )}
      </CardContent>

      <ModalDerivar
        abierto={modalDerivar}
        onClose={() => setModalDerivar(false)}
        ocupado={ocupado === "derivar"}
        catalogos={catalogos}
        onConfirmar={async (areaId, servicioId, motivo) => {
          const ok = await ejecutar(
            "derivar",
            () => derivarIncidencia(incidencia.id, areaId, servicioId, motivo),
            "Incidencia derivada correctamente."
          );
          if (ok) setModalDerivar(false);
        }}
      />

      <ModalAsignar
        abierto={modalAsignar}
        onClose={() => setModalAsignar(false)}
        ocupado={ocupado === "asignar"}
        tecnicos={catalogos.tecnicos.filter(
          (t) => t.area_id === (vigente?.area_destino_id ?? "")
        )}
        areaNombre={vigente?.area_destino ?? null}
        onConfirmar={async (tecnicoId) => {
          const ok = await ejecutar(
            "asignar",
            () => asignarTecnicoIncidencia(incidencia.id, tecnicoId),
            "Técnico asignado correctamente."
          );
          if (ok) setModalAsignar(false);
        }}
      />
    </Card>
  );
}

/** Modal de derivación: área destino + servicio (cascada) + motivo obligatorio. */
function ModalDerivar({
  abierto,
  onClose,
  ocupado,
  catalogos,
  onConfirmar,
}: {
  abierto: boolean;
  onClose: () => void;
  ocupado: boolean;
  catalogos: CatalogosGestion;
  onConfirmar: (areaId: string, servicioId: string | null, motivo: string) => Promise<void>;
}) {
  const [areaId, setAreaId] = React.useState("");
  const [servicioId, setServicioId] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => {
    if (abierto) {
      setAreaId("");
      setServicioId("");
      setMotivo("");
    }
  }, [abierto]);

  const serviciosDelArea = catalogos.servicios.filter((s) => s.area_id === areaId);

  return (
    <Modal
      open={abierto}
      onClose={onClose}
      title="Derivar incidencia"
      description="Elige el área (y servicio opcional) responsable. El motivo queda registrado en el historial y en la auditoría."
      size="lg"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await onConfirmar(areaId, servicioId || null, motivo);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="derivar-area">Área de destino *</Label>
          <Select
            id="derivar-area"
            value={areaId}
            onChange={(e) => {
              setAreaId(e.target.value);
              setServicioId("");
            }}
            required
            disabled={ocupado}
          >
            <option value="">Selecciona el área…</option>
            {catalogos.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="derivar-servicio">Servicio (opcional)</Label>
          <Select
            id="derivar-servicio"
            value={servicioId}
            onChange={(e) => setServicioId(e.target.value)}
            disabled={ocupado || !areaId}
          >
            <option value="">Sin servicio específico</option>
            {serviciosDelArea.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="derivar-motivo">Motivo *</Label>
          <Textarea
            id="derivar-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            required
            minLength={5}
            maxLength={500}
            placeholder="Explica por qué se deriva a esta área (5–500 caracteres)."
            disabled={ocupado}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="submit" disabled={ocupado || !areaId || motivo.trim().length < 5}>
            {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Derivar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Modal de asignación: técnicos activos del área destino vigente. */
function ModalAsignar({
  abierto,
  onClose,
  ocupado,
  tecnicos,
  areaNombre,
  onConfirmar,
}: {
  abierto: boolean;
  onClose: () => void;
  ocupado: boolean;
  tecnicos: Array<{ id: string; nombre: string }>;
  areaNombre: string | null;
  onConfirmar: (tecnicoId: string) => Promise<void>;
}) {
  const [tecnicoId, setTecnicoId] = React.useState("");

  React.useEffect(() => {
    if (abierto) setTecnicoId("");
  }, [abierto]);

  return (
    <Modal
      open={abierto}
      onClose={onClose}
      title="Asignar técnico"
      description={
        areaNombre
          ? `Técnicos activos del área responsable (${areaNombre}).`
          : "Primero define el área responsable derivando la incidencia."
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await onConfirmar(tecnicoId);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asignar-tecnico">Técnico *</Label>
          <Select
            id="asignar-tecnico"
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            required
            disabled={ocupado}
          >
            <option value="">Selecciona el técnico…</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
          {tecnicos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay técnicos activos registrados en esta área.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="submit" disabled={ocupado || !tecnicoId}>
            {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Asignar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
