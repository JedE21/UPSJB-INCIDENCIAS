"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  CircleSlash,
  Download,
  Eye,
  Printer,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { SearchInput } from "@/components/shared/search-input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { fechaHora } from "@/lib/fechas";
import { deshabilitarQr, regenerarQr } from "@/lib/qr/actions";
import type { FilaQR } from "@/lib/qr/datos";

/** Chip de estado con ICONO + TEXTO (§50; no depender solo del color). */
function EstadoQrChip({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300">
      <CheckCircle2 className="size-3.5" aria-hidden />
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/15 dark:text-gray-300">
      <CircleSlash className="size-3.5" aria-hidden />
      Deshabilitado
    </span>
  );
}

/** Tabla + acciones del panel QR. También renderiza la zona de impresión. */
export function TablaQr({ filas }: { filas: FilaQR[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [busqueda, setBusqueda] = React.useState("");
  const [estadoFiltro, setEstadoFiltro] = React.useState("todos");
  const [sedeFiltro, setSedeFiltro] = React.useState("todas");

  const [previewCodigo, setPreviewCodigo] = React.useState<string | null>(null);
  const [qrADeshabilitar, setQrADeshabilitar] = React.useState<FilaQR | null>(null);
  const [qrARegenerar, setQrARegenerar] = React.useState<FilaQR | null>(null);
  const [procesando, setProcesando] = React.useState(false);

  const sedes = React.useMemo(
    () => Array.from(new Set(filas.map((f) => f.sede).filter((s): s is string => Boolean(s)))),
    [filas]
  );

  const filtradas = filas.filter((f) => {
    const coincideEstado =
      estadoFiltro === "todos" ||
      (estadoFiltro === "activos" && f.activo) ||
      (estadoFiltro === "deshabilitados" && !f.activo);
    const coincideSede = sedeFiltro === "todas" || f.sede === sedeFiltro;
    const texto = `${f.codigo} ${f.ambiente_nombre} ${f.ambiente_codigo} ${f.ambiente_codigo}`.toLowerCase();
    return coincideEstado && coincideSede && texto.includes(busqueda.trim().toLowerCase());
  });

  const activosImprimibles = filtradas.filter((f) => f.activo);

  const ejecutar = async (
    accion: (prev: null, formData: FormData) => Promise<{ error: string | null; exito?: string | null }>,
    datos: Record<string, string>,
    tituloExito: string
  ) => {
    setProcesando(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(datos)) fd.set(k, v);
    const res = await accion(null, fd);
    setProcesando(false);
    if (res.error) {
      toast({ title: "No se completó la operación", description: res.error, variant: "destructive" });
      return false;
    }
    toast({ title: tituloExito, description: res.exito ?? undefined, variant: "success" });
    router.refresh();
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por código o ambiente…"
            className="sm:w-72"
          />
        }
        filters={
          <>
            <Select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              aria-label="Filtrar por estado"
              className="w-44"
            >
              <option value="todos">Todos los estados</option>
              <option value="activos">Activos</option>
              <option value="deshabilitados">Deshabilitados</option>
            </Select>
            <Select
              value={sedeFiltro}
              onChange={(e) => setSedeFiltro(e.target.value)}
              aria-label="Filtrar por sede"
              className="w-44"
            >
              <option value="todas">Todas las sedes</option>
              {sedes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => window.print()} disabled={activosImprimibles.length === 0}>
              <Printer aria-hidden />
              Imprimir QR activos ({activosImprimibles.length})
            </Button>
          </>
        }
      />

      {filtradas.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title={filas.length === 0 ? "Aún no hay códigos QR" : "Sin resultados"}
          description={
            filas.length === 0
              ? "Crea el primer código QR seleccionando un ambiente activo sin QR."
              : "Ningún código QR coincide con la búsqueda o los filtros aplicados."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Ambiente asociado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Generado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <div className="font-mono text-sm font-semibold">{f.codigo}</div>
                    <div className="font-mono text-xs text-muted-foreground">{f.url_destino}</div>
                    <div className="text-xs text-muted-foreground">Versión {f.version}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{f.ambiente_nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {[f.sede, f.pabellon, f.piso, f.tipo_ambiente].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <EstadoQrChip activo={f.activo} />
                    {f.deshabilitado_en ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Desde {fechaHora(f.deshabilitado_en)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fechaHora(f.generado_en)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewCodigo(f.codigo)}
                        aria-label={`Vista previa del QR ${f.codigo}`}
                        title="Vista previa"
                      >
                        <Eye aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`Descargar QR ${f.codigo}`}
                        title="Descargar PNG"
                      >
                        <a href={`/api/qr/${encodeURIComponent(f.codigo)}/png`} download={`${f.codigo}.png`}>
                          <Download aria-hidden />
                        </a>
                      </Button>
                      {f.activo ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setQrARegenerar(f)}
                            aria-label={`Regenerar QR ${f.codigo}`}
                            title="Regenerar (rota el código)"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setQrADeshabilitar(f)}
                            aria-label={`Deshabilitar QR ${f.codigo}`}
                            title="Deshabilitar"
                            className="text-destructive hover:text-destructive"
                          >
                            <Ban aria-hidden />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Vista previa del QR */}
      <Modal
        open={previewCodigo !== null}
        onClose={() => setPreviewCodigo(null)}
        title={`QR ${previewCodigo ?? ""}`}
        description="Contenido: la URL estable de reporte. Descarga o imprime esta imagen para colocarla en el ambiente."
      >
        {previewCodigo ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${encodeURIComponent(previewCodigo)}/png`}
              alt={`Código QR ${previewCodigo}`}
              width={280}
              height={280}
              className="rounded-lg border"
            />
            <p className="font-mono text-sm">{previewCodigo}</p>
            <Button asChild variant="outline">
              <a href={`/api/qr/${encodeURIComponent(previewCodigo)}/png`} download={`${previewCodigo}.png`}>
                <Download aria-hidden />
                Descargar PNG
              </a>
            </Button>
          </div>
        ) : null}
      </Modal>

      {/* Deshabilitar */}
      <ConfirmDialog
        open={qrADeshabilitar !== null}
        onClose={() => setQrADeshabilitar(null)}
        onConfirm={async () => {
          if (!qrADeshabilitar) return;
          const ok = await ejecutar(
            deshabilitarQr,
            { qr_id: qrADeshabilitar.id },
            "QR deshabilitado"
          );
          if (ok) setQrADeshabilitar(null);
        }}
        title="Deshabilitar código QR"
        description={
          qrADeshabilitar
            ? `El código ${qrADeshabilitar.codigo} (${qrADeshabilitar.ambiente_nombre}) dejará de funcionar: quien lo escanee verá una pantalla de "QR deshabilitado". Esta acción no borra el historial.`
            : ""
        }
        confirmLabel="Deshabilitar"
        destructive
        loading={procesando}
      />

      {/* Regenerar */}
      <ConfirmDialog
        open={qrARegenerar !== null}
        onClose={() => setQrARegenerar(null)}
        onConfirm={async () => {
          if (!qrARegenerar) return;
          const ok = await ejecutar(
            regenerarQr,
            { ambiente_id: qrARegenerar.ambiente_id },
            "QR regenerado"
          );
          if (ok) setQrARegenerar(null);
        }}
        title="Regenerar código QR"
        description={
          qrARegenerar
            ? `Se creará un código nuevo para ${qrARegenerar.ambiente_nombre} y el actual (${qrARegenerar.codigo}) quedará deshabilitado automáticamente. Deberás imprimir y colocar el QR nuevo.`
            : ""
        }
        confirmLabel="Regenerar"
        loading={procesando}
      />

      {/* ZONA DE IMPRESIÓN: solo visible al imprimir (tarjetas de QR activos) */}
      <div className="zona-impresion hidden print:block" aria-hidden={false}>
        <p className="mb-4 text-center text-sm">
          SIR-UPSJB · Sistema de Incidencias — Coloca esta tarjeta en un lugar visible del ambiente
        </p>
        <div className="grid grid-cols-2 gap-6">
          {activosImprimibles.map((f) => (
            <div
              key={f.id}
              className="break-inside-avoid rounded-lg border-2 border-black p-4 text-center"
            >
              <p className="text-sm font-bold">Reporta una incidencia</p>
              <p className="mb-2 text-xs">Escanea el código con la cámara de tu teléfono</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr/${encodeURIComponent(f.codigo)}/png`}
                alt={`Código QR ${f.codigo}`}
                width={200}
                height={200}
                className="mx-auto"
              />
              <p className="mt-2 font-mono text-sm font-bold">{f.codigo}</p>
              <p className="text-xs">{f.ambiente_nombre}</p>
              <p className="text-xs">
                {[f.sede, f.pabellon, f.piso].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Card className="hidden print:hidden">
        <CardContent className="text-xs text-muted-foreground">
          Al imprimir se generan tarjetas con los QR <strong>activos</strong> del filtro actual,
          listas para recortar y colocar en los ambientes.
        </CardContent>
      </Card>
    </div>
  );
}
