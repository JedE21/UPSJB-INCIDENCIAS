"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdminConPermiso, mensajeDeErrorPg, type GuardiaAdmin } from "@/lib/admin/guardia";
import { entidadPorSlug, type CampoEntidad, type EntidadAdmin } from "@/lib/admin/entidades";

/**
 * SERVER ACTIONS CRUD GENÉRICAS · SIR-UPSJB (FASE 7)
 *
 * Una sola implementación tipada sirve a todas las entidades declarativas
 * (lib/admin/entidades.ts). Cada acción:
 *   1. Exige sesión + ADMINISTRADOR + permiso del grupo (guardia).
 *   2. Valida los campos contra la definición declarativa (tipos, rangos,
 *      longitudes, CHECK replicados) ANTES de llegar a la BD.
 *   3. Confía en RLS (p_*_admin, 0007) para la decisión final por fila.
 *
 * Sin DELETE físico: el modelo no lo contempla (docs/01 §2.7) — solo se
 * activa/desactiva (activo/activa) cuando la entidad lo admite.
 */

export interface EstadoAccionAdmin {
  error: string | null;
  exito?: string | null;
}

const RE_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Columna booleana de estado por slug (la mayoría usa `activo`). */
const COLUMNA_ACTIVO: Record<string, string> = {
  sedes: "activa",
  asignaciones: "activa", // equipos_ambientes usa `activa` (activación de la asignación)
};

/** Rutas que deben refrescarse tras un cambio en cualquier entidad. */
function rutasARefrescar(entidad: EntidadAdmin): string[] {
  const rutas = new Set<string>();
  if (entidad.grupo) {
    rutas.add(`/admin/${entidad.grupo}`);
    rutas.add(`/admin/${entidad.grupo}/${entidad.slug}`);
  }
  // Cambios de jerarquía afectan listados dependientes y el flujo QR.
  if (["sedes", "pabellones", "pisos", "tipos-ambiente", "ambientes"].includes(entidad.slug)) {
    rutas.add("/admin/infraestructura");
    rutas.add("/admin/qr");
  }
  if (["aulas", "laboratorios", "caracteristicas"].includes(entidad.slug)) {
    rutas.add("/admin/infraestructura");
  }
  if (["equipos", "asignaciones", "modelos"].includes(entidad.slug)) {
    rutas.add("/admin/equipos");
  }
  if (entidad.grupo === "organizacion") rutas.add("/admin/organizacion");
  if (entidad.grupo === "seguridad") rutas.add("/admin/roles");
  return Array.from(rutas);
}

/** Convierte y valida UN campo según su declaración; devuelve el valor SQL. */
function validarCampo(
  campo: CampoEntidad,
  crudo: FormDataEntryValue | null,
  esCreacion: boolean
): { valor: unknown; error: string | null } {
  const texto = typeof crudo === "string" ? crudo.trim() : "";

  // Checkbox ausente en FormData = false.
  if (campo.tipo === "booleano") {
    return { valor: crudo === "on" || crudo === "true" || crudo === "1", error: null };
  }

  const vacio = texto === "";

  switch (campo.tipo) {
    case "texto":
    case "textoLargo": {
      if (vacio) {
        return campo.requerido && (esCreacion || campo.soloCreacion !== true)
          ? { valor: null, error: `${campo.label} es obligatorio.` }
          : { valor: null, error: null };
      }
      if (campo.max && texto.length > campo.max) {
        return { valor: null, error: `${campo.label} admite hasta ${campo.max} caracteres.` };
      }
      return { valor: texto, error: null };
    }
    case "entero":
    case "decimal": {
      if (vacio) {
        return campo.requerido
          ? { valor: null, error: `${campo.label} es obligatorio.` }
          : { valor: null, error: null };
      }
      const num = Number(texto);
      if (!Number.isFinite(num)) {
        return { valor: null, error: `${campo.label} debe ser un número.` };
      }
      if (campo.tipo === "entero" && !Number.isInteger(num)) {
        return { valor: null, error: `${campo.label} debe ser un número entero.` };
      }
      if (campo.min !== undefined && num < campo.min) {
        return { valor: null, error: `${campo.label} no puede ser menor que ${campo.min}.` };
      }
      if (campo.maxNum !== undefined && num > campo.maxNum) {
        return { valor: null, error: `${campo.label} no puede ser mayor que ${campo.maxNum}.` };
      }
      return { valor: num, error: null };
    }
    case "uuid": {
      if (vacio) {
        return campo.requerido
          ? { valor: null, error: `Selecciona ${campo.label.toLowerCase()}.` }
          : { valor: null, error: null };
      }
      if (!RE_UUID.test(texto)) return { valor: null, error: `${campo.label} no es válido.` };
      return { valor: texto, error: null };
    }
    case "fecha": {
      if (vacio) {
        return campo.requerido
          ? { valor: null, error: `${campo.label} es obligatoria.` }
          : { valor: null, error: null };
      }
      const fecha = new Date(texto);
      if (Number.isNaN(fecha.getTime())) {
        return { valor: null, error: `${campo.label} no es una fecha válida.` };
      }
      return { valor: texto, error: null };
    }
    case "seleccion": {
      if (vacio) {
        return campo.requerido
          ? { valor: null, error: `Selecciona ${campo.label.toLowerCase()}.` }
          : { valor: null, error: null };
      }
      if (campo.opciones && !campo.opciones.includes(texto)) {
        return { valor: null, error: `${campo.label} no es una opción válida.` };
      }
      return { valor: texto, error: null };
    }
    case "listaEnteros": {
      if (vacio) return { valor: null, error: null };
      const partes = texto.split(",").map((p) => p.trim()).filter(Boolean);
      const numeros: number[] = [];
      for (const parte of partes) {
        const n = Number(parte);
        if (!Number.isInteger(n)) {
          return { valor: null, error: `${campo.label}: "${parte}" no es un número entero.` };
        }
        numeros.push(n);
      }
      return { valor: numeros, error: null };
    }
    default:
      return { valor: null, error: null };
  }
}

/** Valida todo el formulario y arma el payload SQL. */
function validarPayload(
  entidad: EntidadAdmin,
  formData: FormData,
  esCreacion: boolean
): { payload: Record<string, unknown> | null; error: string | null } {
  const payload: Record<string, unknown> = {};

  for (const campo of entidad.campos) {
    // En edición, los campos "soloCreacion" se ignoran (no cambian de padre).
    if (!esCreacion && campo.soloCreacion) continue;
    // Campo solo de UI (p. ej. marca_id en equipos, para filtrar modelos):
    // nunca se envía a la BD.
    if (campo.uiFiltroPor) continue;

    const { valor, error } = validarCampo(campo, formData.get(campo.name), esCreacion);
    if (error) return { payload: null, error };

    if (esCreacion || valor !== null) {
      payload[campo.name] = valor;
    }
  }

  return { payload, error: null };
}

/* ------------------------------------------------------------------ */
/* CREAR                                                               */
/* ------------------------------------------------------------------ */

export async function crearEntidad(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const slug = String(formData.get("__entidad") ?? "");
  const entidad = entidadPorSlug(slug);
  if (!entidad) return { error: "Entidad desconocida." };

  const guardia: GuardiaAdmin = await exigirAdminConPermiso(entidad.grupo ?? "");
  if (!guardia.ok) return { error: guardia.error };

  // El historial de movimientos lo escribe el trigger de asignaciones (0003);
  // la app no lo crea ni lo edita directamente.
  if (entidad.slug === "movimientos") {
    return { error: "Los movimientos se registran automáticamente al asignar o reasignar un equipo (módulo Asignaciones)." };
  }

  const { payload, error } = validarPayload(entidad, formData, true);
  if (error || !payload) return { error: error ?? "Datos incompletos." };

  // Trazabilidad de la asignación: quién la registró (de la sesión, nunca del cliente).
  if (entidad.slug === "asignaciones") payload.asignado_por = guardia.usuarioId;

  const supabase = await createClient();
  const { error: errorPg } = await supabase.from(entidad.tabla).insert(payload);

  if (errorPg) return { error: mensajeDeErrorPg(errorPg, entidad.titulo) };

  for (const ruta of rutasARefrescar(entidad)) revalidatePath(ruta);
  return { error: null, exito: `${entidad.titulo}: registro creado correctamente.` };
}

/* ------------------------------------------------------------------ */
/* EDITAR                                                              */
/* ------------------------------------------------------------------ */

/**
 * Clave compuesta (p. ej. equipos_ambientes, sin columna id): el cliente
 * envía __id como JSON { col: valor } de las columnas PK. Se valida que cada
 * columna exista y sea un UUID antes de usarla como filtro de UPDATE.
 */
function claveDeFila(
  entidad: EntidadAdmin,
  idCrudo: string
): Record<string, string> | null {
  if (!entidad.claveCompuesta) return null;
  try {
    const parsed = JSON.parse(idCrudo) as Record<string, unknown>;
    const clave: Record<string, string> = {};
    for (const col of entidad.claveCompuesta) {
      const valor = typeof parsed[col] === "string" ? parsed[col] : "";
      if (!RE_UUID.test(valor)) return null;
      clave[col] = valor;
    }
    return clave;
  } catch {
    return null;
  }
}

export async function editarEntidad(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const slug = String(formData.get("__entidad") ?? "");
  const id = String(formData.get("__id") ?? "").trim();
  const entidad = entidadPorSlug(slug);
  if (!entidad) return { error: "Entidad desconocida." };

  const guardia = await exigirAdminConPermiso(entidad.grupo ?? "");
  if (!guardia.ok) return { error: guardia.error };

  if (entidad.slug === "movimientos") {
    return { error: "Los movimientos son un historial automático: no se editan desde la aplicación." };
  }

  // Filtro de fila: PK simple (id) o clave compuesta validada.
  const filtro = entidad.claveCompuesta
    ? claveDeFila(entidad, id)
    : RE_UUID.test(id)
      ? { id }
      : null;
  if (!filtro) return { error: "Identificador no válido." };

  const { payload, error } = validarPayload(entidad, formData, false);
  if (error) return { error };
  if (!payload || Object.keys(payload).length === 0) {
    return { error: "No hay cambios que guardar." };
  }

  const supabase = await createClient();
  const { error: errorPg } = await supabase
    .from(entidad.tabla)
    .update(payload)
    .match(filtro);

  if (errorPg) return { error: mensajeDeErrorPg(errorPg, entidad.titulo) };

  for (const ruta of rutasARefrescar(entidad)) revalidatePath(ruta);
  return { error: null, exito: `${entidad.titulo}: cambios guardados.` };
}

/* ------------------------------------------------------------------ */
/* ACTIVAR / DESACTIVAR (toggle)                                       */
/* ------------------------------------------------------------------ */

/**
 * Alterna el estado activo de una fila. El nombre de la columna booleana
 * se resuelve en servidor a partir de la definición declarativa (sedes usa
 * `activa`; el resto `activo`) — nunca del cliente.
 */
export async function alternarEntidad(
  _prev: EstadoAccionAdmin | null,
  formData: FormData
): Promise<EstadoAccionAdmin> {
  const slug = String(formData.get("__entidad") ?? "");
  const id = String(formData.get("__id") ?? "").trim();
  const entidad = entidadPorSlug(slug);
  if (!entidad) return { error: "Entidad desconocida." };
  if (!entidad.tieneActivo) return { error: "Esta entidad no admite activación/desactivación." };

  const guardia = await exigirAdminConPermiso(entidad.grupo ?? "");
  if (!guardia.ok) return { error: guardia.error };

  // Filtro de fila: PK simple (id) o clave compuesta validada.
  const filtro = entidad.claveCompuesta
    ? claveDeFila(entidad, id)
    : RE_UUID.test(id)
      ? { id }
      : null;
  if (!filtro) return { error: "Identificador no válido." };

  const columnaActivo = COLUMNA_ACTIVO[entidad.slug] ?? "activo";
  const nuevoEstado = formData.get("__nuevo_estado") === "true";

  const supabase = await createClient();
  const { error: errorPg } = await supabase
    .from(entidad.tabla)
    .update({ [columnaActivo]: nuevoEstado })
    .match(filtro)
    .eq(columnaActivo, !nuevoEstado); // condición extra: transición real

  if (errorPg) return { error: mensajeDeErrorPg(errorPg, entidad.titulo) };

  for (const ruta of rutasARefrescar(entidad)) revalidatePath(ruta);
  return {
    error: null,
    exito: nuevoEstado
      ? `${entidad.titulo}: registro activado.`
      : `${entidad.titulo}: registro desactivado (conserva su historial).`,
  };
}
