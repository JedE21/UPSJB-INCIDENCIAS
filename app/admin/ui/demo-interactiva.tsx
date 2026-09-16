"use client";

import * as React from "react";
import { ClipboardList, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FileUpload } from "@/components/shared/file-upload";
import { FilterBar } from "@/components/shared/filter-bar";
import { FormField } from "@/components/shared/form-field";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge, PriorityBadge } from "@/components/incidencias/badges";
import { useToast } from "@/components/ui/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Parte interactiva del catálogo UI (componente cliente):
 * toasts, modal, confirmación, formulario, tabla con datos de ejemplo
 * EN MEMORIA (no provienen de la base de datos) y adjuntos visuales.
 */

interface IncidenciaDemo {
  codigo: string;
  ambiente: string;
  resumen: string;
  estado: string;
  prioridad: string;
}

/** Datos de ejemplo SOLO para esta página de prueba (en memoria, no en BD). */
const INCIDENCIAS_DEMO: IncidenciaDemo[] = [
  { codigo: "INC-0000-0001", ambiente: "Aula B-104", resumen: "Proyector sin señal", estado: "Pendiente", prioridad: "Media" },
  { codigo: "INC-0000-0002", ambiente: "Lab C-201", resumen: "Internet lento", estado: "En proceso", prioridad: "Alta" },
  { codigo: "INC-0000-0003", ambiente: "Oficina D-102", resumen: "Impresora atascada", estado: "Resuelta", prioridad: "Baja" },
];

const columnasDemo: Array<DataTableColumn<IncidenciaDemo>> = [
  { id: "codigo", header: "Código", value: (r) => r.codigo, sortable: true, cell: (r) => <span className="font-mono text-xs">{r.codigo}</span> },
  { id: "ambiente", header: "Ambiente", value: (r) => r.ambiente, sortable: true },
  { id: "resumen", header: "Resumen", value: (r) => r.resumen },
  {
    id: "estado",
    header: "Estado",
    value: (r) => r.estado,
    sortable: true,
    cell: (r) => <StatusBadge estado={r.estado} />,
  },
  {
    id: "prioridad",
    header: "Prioridad",
    value: (r) => r.prioridad,
    sortable: true,
    cell: (r) => <PriorityBadge prioridad={r.prioridad} />,
  },
];

export function DemoInteractiva() {
  const { toast } = useToast();
  const [modalAbierto, setModalAbierto] = React.useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = React.useState(false);
  const [confirmado, setConfirmado] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [archivos, setArchivos] = React.useState<File[]>([]);

  return (
    <div className="flex flex-col gap-4">
      {/* Interacción: toasts, modal y confirmación */}
      <Card>
        <CardHeader>
          <CardTitle>Interacción</CardTitle>
          <CardDescription>Toasts, modal y confirmación (componentes cliente).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Notificación informativa", description: "Ejemplo de toast tipo info.", variant: "info" })}>
              Toast info
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Cambios guardados", description: "Ejemplo de toast de éxito.", variant: "success" })}>
              Toast éxito
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Atención", description: "Ejemplo de toast de advertencia.", variant: "warning" })}>
              Toast advertencia
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Ocurrió un error", description: "Ejemplo de toast destructivo.", variant: "destructive" })}>
              Toast error
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalAbierto(true)}>
              Abrir modal
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmarAbierto(true)}>
              Abrir confirmación
            </Button>
            {confirmado ? (
              <p className="self-center text-sm text-muted-foreground">
                Acción confirmada (solo demo, sin efectos).
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle>Campos de formulario</CardTitle>
          <CardDescription>
            FormField + Input/Select/Textarea. Formulario de ejemplo, sin envío.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Código de ambiente" htmlFor="demo-ambiente" hint="Se llena automáticamente desde el QR (Fase 5).">
            <Input id="demo-ambiente" placeholder="B-104" readOnly />
          </FormField>
          <FormField label="Tipo de incidencia" htmlFor="demo-tipo" required>
            <Select id="demo-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="" disabled>
                Selecciona el tipo…
              </option>
              <option value="tecnica">Técnica</option>
              <option value="infraestructura">Infraestructura</option>
              <option value="conectividad">Conectividad</option>
            </Select>
          </FormField>
          <FormField label="Descripción del problema" htmlFor="demo-descripcion" className="sm:col-span-2" hint="Describe brevemente qué ocurrió.">
            <Textarea
              id="demo-descripcion"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="El proyector no muestra imagen…"
            />
          </FormField>
          <FormField label="Campo con error" htmlFor="demo-error" error="Este campo es obligatorio.">
            <Input id="demo-error" aria-invalid placeholder="Texto inválido…" />
          </FormField>
        </CardContent>
      </Card>

      {/* Filtros + DataTable */}
      <Card>
        <CardHeader>
          <CardTitle>Barra de filtros y tabla de datos</CardTitle>
          <CardDescription>
            FilterBar + DataTable con búsqueda, orden y paginación. Datos de ejemplo en memoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FilterBar
            search={<SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por ambiente…" />}
            filters={
              <Select aria-label="Filtrar por estado" defaultValue="">
                <option value="" disabled>
                  Estado: todos
                </option>
                <option>Pendiente</option>
                <option>En proceso</option>
                <option>Resuelta</option>
              </Select>
            }
          />
          <DataTable
            columns={columnasDemo}
            rows={INCIDENCIAS_DEMO.filter((r) =>
              busqueda.trim() ? r.ambiente.toLowerCase().includes(busqueda.trim().toLowerCase()) : true
            )}
            rowKey={(r) => r.codigo}
            pageSize={10}
            emptyTitle="Sin incidencias"
            emptyDescription="Ajusta la búsqueda para ver resultados."
            emptyIcon={ClipboardList}
          />
        </CardContent>
      </Card>

      {/* Adjuntos */}
      <Card>
        <CardHeader>
          <CardTitle>Adjuntar evidencias (visual)</CardTitle>
          <CardDescription>
            Selección y vista previa local. La subida a Supabase Storage llega con la Fase 6.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload onChange={setArchivos} />
          {archivos.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {archivos.length} archivo(s) seleccionado(s) — solo demo, no se suben a ningún servidor.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal simple */}
      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title="Modal de ejemplo"
        description="Base para vistas de detalle, asignación y derivación de incidencias."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cerrar
            </Button>
            <Button onClick={() => setModalAbierto(false)}>
              <QrCode aria-hidden />
              Acción principal
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Este modal es el contenedor reutilizable para los futuros flujos del sistema.
        </p>
      </Modal>

      {/* Confirmación */}
      <ConfirmDialog
        open={confirmarAbierto}
        onClose={() => setConfirmarAbierto(false)}
        onConfirm={() => {
          setConfirmado(true);
          setConfirmarAbierto(false);
          toast({ title: "Acción confirmada", description: "Demo sin efectos reales.", variant: "success" });
        }}
        title="¿Confirmar acción?"
        description="Ejemplo de diálogo de confirmación para acciones sensibles (cerrar, cancelar, eliminar…)."
        confirmLabel="Sí, confirmar"
        destructive
      />
    </div>
  );
}
