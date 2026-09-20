"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { alternarPermisoRol } from "@/lib/admin/acciones-matriz";

/**
 * MATRIZ ROL ↔ PERMISO (FASE 7).
 * Un toggle = una fila roles_permisos concedida/revocada con confirmación.
 * La Server Action revalida rol + permiso; RLS vuelve a decidir en la BD.
 */
export function MatrizRolesPermisos({
  roles,
  permisos,
  matriz,
}: {
  roles: Array<{ id: string; nombre: string; activo: boolean }>;
  permisos: Array<{ id: string; codigo: string; descripcion: string | null }>;
  matriz: Set<string>;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [pendiente, setPendiente] = React.useState<{
    rolId: string;
    permisoId: string;
    conceder: boolean;
    rolNombre: string;
    permisoCodigo: string;
  } | null>(null);
  const [procesando, setProcesando] = React.useState(false);

  const confirmar = async () => {
    if (!pendiente) return;
    setProcesando(true);
    const fd = new FormData();
    fd.set("rol_id", pendiente.rolId);
    fd.set("permiso_id", pendiente.permisoId);
    fd.set("__conceder", String(pendiente.conceder));
    let res;
    try {
      res = await alternarPermisoRol(null, fd);
    } catch {
      res = { error: "No se pudo completar la operación." };
    }
    setProcesando(false);
    if (res.error) {
      toast({ title: "No se completó la operación", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: res.exito ?? "Matriz actualizada", variant: "success" });
    setPendiente(null);
    router.refresh();
  };

  if (roles.length === 0 || permisos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No hay roles o permisos registrados todavía.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card">Permiso</TableHead>
              {roles.map((r) => (
                <TableHead key={r.id} className="text-center">
                  <span className="font-mono text-[11px]">{r.nombre}</span>
                  {!r.activo ? <span className="block text-[10px] font-normal">(inactivo)</span> : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permisos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="sticky left-0 z-10 bg-card">
                  <div className="font-mono text-xs font-semibold">{p.codigo}</div>
                  {p.descripcion ? (
                    <div className="max-w-64 truncate text-xs text-muted-foreground">{p.descripcion}</div>
                  ) : null}
                </TableCell>
                {roles.map((r) => {
                  const concedido = matriz.has(`${r.id}:${p.id}`);
                  return (
                    <TableCell key={r.id} className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mx-auto size-8"
                        aria-label={`${concedido ? "Revocar" : "Conceder"} ${p.codigo} a ${r.nombre}`}
                        title={concedido ? "Revocar" : "Conceder"}
                        onClick={() =>
                          setPendiente({
                            rolId: r.id,
                            permisoId: p.id,
                            conceder: !concedido,
                            rolNombre: r.nombre,
                            permisoCodigo: p.codigo,
                          })
                        }
                      >
                        {concedido ? (
                          <Check className="text-green-600 dark:text-green-400" aria-hidden />
                        ) : (
                          <Minus className="text-muted-foreground/50" aria-hidden />
                        )}
                      </Button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={pendiente !== null}
        onClose={() => setPendiente(null)}
        onConfirm={confirmar}
        title={pendiente?.conceder ? "Conceder permiso" : "Revocar permiso"}
        description={
          pendiente
            ? pendiente.conceder
              ? `El rol ${pendiente.rolNombre} podrá ejercer «${pendiente.permisoCodigo}». RLS aplicará el cambio de inmediato.`
              : `El rol ${pendiente.rolNombre} dejará de tener «${pendiente.permisoCodigo}». Los usuarios con ese rol perderán la capacidad al refrescar su sesión.`
            : ""
        }
        confirmLabel={pendiente?.conceder ? "Conceder" : "Revocar"}
        destructive={!pendiente?.conceder}
        loading={procesando}
      />
    </>
  );
}
