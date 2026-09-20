"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  CircleSlash,
  Plus,
  SearchX,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Modal } from "@/components/ui/modal";
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
import { fechaCorta } from "@/lib/fechas";
import { asignarRol, retirarRol, cambiarEstadoCuenta } from "@/lib/admin/acciones-usuarios";
import type { FilaUsuario, RolOpcion } from "@/lib/admin/datos-usuarios";

/**
 * MÓDULO USUARIOS · tabla y ficha de roles (FASE 7).
 * Las acciones llaman a Server Actions que revalidan rol/permiso y delegan
 * en RLS; el claim del JWT se sincroniza vía RPC (0010).
 */
export function TablaUsuarios({
  usuarios,
  roles,
  errorCarga,
}: {
  usuarios: FilaUsuario[];
  roles: RolOpcion[];
  errorCarga?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [busqueda, setBusqueda] = React.useState("");
  const [estadoFiltro, setEstadoFiltro] = React.useState("todos");
  const [rolFiltro, setRolFiltro] = React.useState("todos");

  const [usuarioRoles, setUsuarioRoles] = React.useState<FilaUsuario | null>(null);
  const [usuarioEstado, setUsuarioEstado] = React.useState<FilaUsuario | null>(null);
  const [rolSeleccionado, setRolSeleccionado] = React.useState("");
  const [procesando, setProcesando] = React.useState(false);

  const rolesConUsuarios = React.useMemo(
    () => Array.from(new Set(usuarios.flatMap((u) => u.roles.map((r) => r.nombre)))).sort(),
    [usuarios]
  );

  const filtrados = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (estadoFiltro !== "todos" && u.estado !== estadoFiltro) return false;
      if (rolFiltro !== "todos" && !u.roles.some((r) => r.nombre === rolFiltro)) return false;
      if (!q) return true;
      return [u.nombre, u.correo, u.documento, u.codigo_usuario]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [usuarios, busqueda, estadoFiltro, rolFiltro]);

  const ejecutar = async (
    accion: (prev: null, fd: FormData) => Promise<{ error: string | null; exito?: string | null }>,
    datos: Record<string, string>,
    cerrar: () => void
  ) => {
    setProcesando(true);
    const fd = new FormData();
    for (const [k, v] of Object.entries(datos)) fd.set(k, v);
    let res;
    try {
      res = await accion(null, fd);
    } catch {
      res = { error: "No se pudo completar la operación." };
    }
    setProcesando(false);
    if (res.error) {
      toast({ title: "No se completó la operación", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: res.exito ?? "Operación completada", variant: "success" });
    cerrar();
    router.refresh();
  };

  if (errorCarga) {
    return (
      <Alert variant="destructive">
        <p className="font-medium">No se pudieron cargar los usuarios</p>
        <p>{errorCarga}</p>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre, correo o documento…"
            className="sm:w-80"
          />
        }
        filters={
          <>
            <Select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} aria-label="Filtrar por estado" className="w-44">
              <option value="todos">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="suspendido">Suspendidos</option>
            </Select>
            <Select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} aria-label="Filtrar por rol" className="w-44">
              <option value="todos">Todos los roles</option>
              {rolesConUsuarios.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </>
        }
      />

      {usuarios.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Aún no hay usuarios registrados"
          description="Los perfiles se crean automáticamente cuando alguien inicia sesión por primera vez con su cuenta institucional."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description="Ningún usuario coincide con la búsqueda o los filtros aplicados."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.nombre}</div>
                    <div className="text-xs text-muted-foreground">{u.codigo_usuario ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{u.correo}</div>
                    <div className="text-xs text-muted-foreground">{u.telefono ?? u.documento ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-48 flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin roles</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r.id} variant={r.nombre === "ADMINISTRADOR" ? "default" : "secondary"}>
                            {r.nombre}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.estado === "activo" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
                        <Ban className="size-3.5" aria-hidden />
                        Suspendido
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fechaCorta(u.creado_en)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setUsuarioRoles(u); setRolSeleccionado(""); }} aria-label={`Gestionar roles de ${u.nombre}`} title="Roles">
                        <ShieldCheck aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setUsuarioEstado(u)}
                        aria-label={u.estado === "activo" ? `Suspender a ${u.nombre}` : `Reactivar a ${u.nombre}`}
                        title={u.estado === "activo" ? "Suspender cuenta" : "Reactivar cuenta"}
                        className={u.estado === "activo" ? "text-destructive hover:text-destructive" : "text-green-700 hover:text-green-700"}
                      >
                        {u.estado === "activo" ? <CircleSlash aria-hidden /> : <CheckCircle2 aria-hidden />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Ficha de roles */}
      <Modal
        open={usuarioRoles !== null}
        onClose={() => setUsuarioRoles(null)}
        title={`Roles — ${usuarioRoles?.nombre ?? ""}`}
        description="El permiso efectivo del usuario es la unión de los permisos de todos sus roles (§8.1). Al cambiar roles, su sesión se actualiza en el próximo refresh del token."
      >
        {usuarioRoles ? (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {usuarioRoles.roles.length === 0 ? (
                <li className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  Este usuario no tiene roles asignados.
                </li>
              ) : (
                usuarioRoles.roles.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <span className="font-mono text-xs font-semibold">{r.nombre}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirar rol ${r.nombre}`}
                      title="Retirar rol"
                      disabled={procesando}
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        ejecutar(retirarRol, { perfil_id: usuarioRoles.id, rol_id: r.id }, () => setUsuarioRoles(null))
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ))
              )}
            </ul>

            <div className="flex items-end gap-2 border-t pt-4">
              <div className="flex-1">
                <label htmlFor="nuevo-rol" className="mb-1.5 block text-sm font-medium">
                  Asignar rol
                </label>
                <Select id="nuevo-rol" value={rolSeleccionado} onChange={(e) => setRolSeleccionado(e.target.value)} disabled={procesando}>
                  <option value="">Selecciona un rol…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} disabled={!r.activo}>
                      {r.nombre}{r.activo ? "" : " (inactivo)"}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                disabled={!rolSeleccionado || procesando}
                onClick={() =>
                  ejecutar(asignarRol, { perfil_id: usuarioRoles.id, rol_id: rolSeleccionado }, () => {
                    setRolSeleccionado("");
                    setUsuarioRoles(null);
                  })
                }
              >
                <Plus aria-hidden />
                Asignar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Suspender / reactivar */}
      <ConfirmDialog
        open={usuarioEstado !== null}
        onClose={() => setUsuarioEstado(null)}
        onConfirm={() => {
          if (!usuarioEstado) return;
          ejecutar(
            cambiarEstadoCuenta,
            { perfil_id: usuarioEstado.id, __nuevo_estado: usuarioEstado.estado === "activo" ? "suspendido" : "activo" },
            () => setUsuarioEstado(null)
          );
        }}
        title={usuarioEstado?.estado === "activo" ? "Suspender cuenta" : "Reactivar cuenta"}
        description={
          usuarioEstado
            ? usuarioEstado.estado === "activo"
              ? `${usuarioEstado.nombre} (${usuarioEstado.correo}) no podrá iniciar sesión ni operar mientras la cuenta esté suspendida. Sus datos e historial se conservan.`
              : `${usuarioEstado.nombre} (${usuarioEstado.correo}) volverá a acceder al sistema con sus roles vigentes.`
            : ""
        }
        confirmLabel={usuarioEstado?.estado === "activo" ? "Suspender" : "Reactivar"}
        destructive={usuarioEstado?.estado === "activo"}
        loading={procesando}
      />
    </div>
  );
}
