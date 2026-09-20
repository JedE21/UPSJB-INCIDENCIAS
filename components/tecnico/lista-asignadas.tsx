"use client";

import * as React from "react";
import Link from "next/link";
import { DoorOpen, FileSearch, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/incidencias/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { FilterBar } from "@/components/shared/filter-bar";
import { fechaCorta } from "@/lib/fechas";
import type { IncidenciaAsignada } from "@/lib/incidencias/datos";

const OPCIONES_ESTADO = [
  { value: "todas", label: "Todos los estados" },
  { value: "Asignada", label: "Asignada (por aceptar)" },
  { value: "En proceso", label: "En proceso" },
  { value: "En espera", label: "En espera" },
  { value: "Resuelta", label: "Resuelta" },
  { value: "Cerrada", label: "Cerrada" },
  { value: "Cancelada", label: "Cancelada" },
];

const OPCIONES_PRIORIDAD = [
  { value: "todas", label: "Todas las prioridades" },
  { value: "Baja", label: "Baja" },
  { value: "Media", label: "Media" },
  { value: "Alta", label: "Alta" },
  { value: "Crítica", label: "Crítica" },
];

/**
 * ListaAsignadas — incidencias asignadas al técnico (leídas en servidor con
 * RLS). Búsqueda y filtros son presentación; el acceso real lo decide la BD.
 */
export function ListaAsignadas({ incidencias }: { incidencias: IncidenciaAsignada[] }) {
  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState("todas");
  const [prioridad, setPrioridad] = React.useState("todas");

  const filtradas = incidencias.filter((i) => {
    const coincideEstado = estado === "todas" || i.estado === estado;
    const coincidePrioridad = prioridad === "todas" || i.prioridad === prioridad;
    const texto = `${i.codigo} ${i.tipo} ${i.subtipo ?? ""} ${i.ambiente_nombre}`.toLowerCase();
    return coincideEstado && coincidePrioridad && texto.includes(busqueda.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por código, ambiente, tipo…"
            className="sm:w-72"
          />
        }
        filters={
          <>
            <Select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              aria-label="Filtrar por estado"
              className="w-44"
            >
              {OPCIONES_ESTADO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
              aria-label="Filtrar por prioridad"
              className="w-44"
            >
              {OPCIONES_PRIORIDAD.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {filtradas.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Incidencias asignadas">
          {filtradas.map((i) => (
            <li key={i.id}>
              <Link
                href={`/tecnico/incidencias/${i.codigo}`}
                className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={`Incidencia ${i.codigo}, estado ${i.estado}. Abrir atención`}
              >
                <Card className="gap-3 py-4 transition-colors hover:bg-accent/40">
                  <CardContent className="flex flex-col gap-3 px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{i.codigo}</span>
                      <div className="flex items-center gap-2">
                        <PriorityBadge prioridad={i.prioridad} />
                        <StatusBadge estado={i.estado} />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {i.tipo}
                        {i.subtipo ? ` · ${i.subtipo}` : ""}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                        {i.descripcion}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <DoorOpen className="size-3.5" aria-hidden />
                        {[i.sede, i.pabellon, i.ambiente_nombre].filter(Boolean).join(" · ")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Wrench className="size-3.5" aria-hidden />
                        {i.tecnico_acepto ? "Atención aceptada" : "Pendiente de aceptar"}
                      </span>
                      <span>{fechaCorta(i.fecha_reporte)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FileSearch}
          title="Sin resultados"
          description={
            incidencias.length === 0
              ? "No tienes incidencias asignadas. Cuando coordinación te asigne una, aparecerá aquí."
              : "Ninguna incidencia coincide con la búsqueda o los filtros aplicados."
          }
        />
      )}
    </div>
  );
}
