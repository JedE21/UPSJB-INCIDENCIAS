"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { crearUsuarioPanel } from "@/lib/admin/crear-usuario-panel";
import type { RolOpcion } from "@/lib/admin/datos-usuarios";

/**
 * MODAL "CREAR USUARIO" del módulo Admin → Usuarios.
 * Delega en la Server Action crearUsuarioPanel → Edge Function crear-usuario
 * (Supabase). La contraseña la define el admin y se la entrega al usuario
 * por un canal seguro; el sistema NO envía correos de invitación.
 */
export function ModalCrearUsuario({ roles, open, onClose }: { roles: RolOpcion[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();

  const [procesando, setProcesando] = React.useState(false);
  const [correo, setCorreo] = React.useState("");
  const [nombres, setNombres] = React.useState("");
  const [apellidoPaterno, setApellidoPaterno] = React.useState("");
  const [apellidoMaterno, setApellidoMaterno] = React.useState("");
  const [documento, setDocumento] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [rol, setRol] = React.useState("USUARIO");
  const [contrasena, setContrasena] = React.useState("");

  const esFormValido =
    correo.trim().includes("@") &&
    nombres.trim().length > 0 &&
    apellidoPaterno.trim().length > 0 &&
    contrasena.length >= 8 &&
    rol.length > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setProcesando(true);
    const fd = new FormData();
    fd.set("correo", correo);
    fd.set("contrasena", contrasena);
    fd.set("nombres", nombres);
    fd.set("apellidoPaterno", apellidoPaterno);
    fd.set("apellidoMaterno", apellidoMaterno);
    fd.set("documento", documento);
    fd.set("telefono", telefono);
    fd.set("rol", rol);

    let res;
    try {
      res = await crearUsuarioPanel(null, fd);
    } catch {
      res = { error: "No se pudo completar la operación." };
    }
    setProcesando(false);

    if (res.error) {
      toast({ title: "No se completó la operación", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: res.exito ?? "Usuario creado", variant: "success" });
    // Reset y cierre
    setCorreo(""); setNombres(""); setApellidoPaterno(""); setApellidoMaterno("");
    setDocumento(""); setTelefono(""); setRol("USUARIO"); setContrasena("");
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear usuario"
      description="Crea la cuenta en Supabase Auth con perfil y rol. La contraseña se define aquí y se entrega al usuario por un canal seguro (no se envía por correo)."
    >
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nuevo-correo">Correo *</Label>
            <Input
              id="nuevo-correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="usuario@upsjb.edu.pe"
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nuevo-rol">Rol *</Label>
            <Select id="nuevo-rol" value={rol} onChange={(e) => setRol(e.target.value)} required>
              {roles.map((r) => (
                <option key={r.id} value={r.nombre} disabled={!r.activo}>
                  {r.nombre}
                  {r.activo ? "" : " (inactivo)"}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nuevo-nombres">Nombres *</Label>
            <Input id="nuevo-nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nuevo-ap-paterno">Apellido paterno *</Label>
            <Input id="nuevo-ap-paterno" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} required />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nuevo-ap-materno">Apellido materno</Label>
            <Input id="nuevo-ap-materno" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nuevo-documento">Documento</Label>
            <Input id="nuevo-documento" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nuevo-telefono">Teléfono</Label>
          <Input id="nuevo-telefono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nuevo-contrasena">Contraseña inicial * (mín. 8 caracteres)</Label>
          <Input
            id="nuevo-contrasena"
            type="text"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-xs text-muted-foreground">
            El usuario podrá cambiarla en su perfil (Seguridad).
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="submit" disabled={procesando || !esFormValido}>
            <UserPlus aria-hidden />
            {procesando ? "Creando…" : "Crear usuario"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
