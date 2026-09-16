"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, DoorOpen, FileSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/incidencias/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { FilterBar } from "@/components/shared/filter-bar";
import { AvisoDemo } from "@/components/shared/aviso-demo";
import { fechaCorta } from "@/lib/fechas";
import { INCIDENCIAS_EJEMPLO } from "@/lib/demo/datos-ejemplo";

const OPCIONES_ESTADO = [
  { value: "todas", label: "Todos los estados" },
  { value: "Pendiente", label: "Pendiente" },
  { value: "Asignada", label: "Asignada" },
  { value: "En proceso", label: "En proceso" },
  { value: "En espera", label: "En espera" },
  { value: "Resuelta", label: "Resuelta" },
  { value: "Cerrada", label: "Cerrada" },
  { value: "Cancelada", label: "Cancelada" },
];

/**
 * Lista visual de "Mis incidencias" (maqueta con datos demo).
 * Filtros y búsqueda son presentación; la consulta real (por usuario, vía RLS)
 * se implementa en la Fase 6.
 */
export function ListaMisIncidencias() {
  const [busqueda, setBusqueda] = React.useState("");
  const [estado, setEstado] = React.useState("todas");

  const filtradas = INCIDENCIAS_EJEMPLO.filter((i) => {
    const coincideEstado = estado === "todas" || i.estado === estado;
    const texto = `${i.codigo} ${i.tipo} ${i.subtipo} ${i.ambiente}`.toLowerCase();
    const coincideTexto = texto.includes(busqueda.trim().toLowerCase());
    return coincideEstado && coincideTexto;
  });

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por código, ambiente o problema…"
            className="sm:w-72"
          />
        }
        filters={
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            aria-label="Filtrar por estado"
            className="w-48"
          >
            {OPCIONES_ESTADO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        }
      />

      {filtradas.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Listado de mis incidencias">
          {filtradas.map((i) => (
            <li key={i.codigo}>
              <Link
                href={`/seguimiento?codigo=${encodeURIComponent(i.codigo)}`}
                className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={`Incidencia ${i.codigo}, estado ${i.estado}. Ver seguimiento`}
              >
                <Card className="gap-3 py-4 transition-colors hover:bg-accent/40">
                  <CardContent className="flex flex-col gap-3 px-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{i.codigo}</span>
                      <StatusBadge estado={i.estado} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{i.subtipo}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                        {i.resumen}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <DoorOpen className="size-3.5" aria-hidden />
                        {i.ambiente}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden />
                        {fechaCorta(i.fechaReporte)}
                      </span>
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
            INCIDENCIAS_EJEMPLO.length === 0
              ? "Aún no reportaste incidencias. Escanea el QR del ambiente o usa el botón “Reportar incidencia”."
              : "Ninguna incidencia coincide con la búsqueda o el filtro aplicado."
          }
        />
      )}

      <AvisoDemo />
    </div>
  );
}
