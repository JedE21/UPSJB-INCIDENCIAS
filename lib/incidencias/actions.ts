"use server";

import { createClient } from "@/lib/supabase/server";
import { getSesion, tienePermiso, tieneRol } from "@/lib/auth/session";
import {
  EVIDENCIA_MIME_PERMITIDOS,
  EVIDENCIA_TAMANO_MAX,
  extensionDeMime,
} from "@/lib/incidencias/evidencias";

/**
 * SERVER ACTIONS DEL MÓDULO DE INCIDENCIAS · SIR-UPSJB
 *
 * Creación de incidencias (Fase 6, alcance del usuario):
 *  · La identidad del reportante se resuelve EN SERVIDOR (sesión): el cliente
 *    nunca envía usuario_reportante_id. RLS (p_incidencias_insert) exige además
 *    perfil activo + permiso `crear_incidencia`.
 *  · Ambiente, tipo, subtipo y prioridad se VALIDAN contra la BD (coherencia
 *    subtipo ∈ tipo impuesta por la FK compuesta fk_incidencias_subtipo_coherente).
 *  · El código único INC-<AAAA>-<NNNNNN>, el estado inicial (Pendiente), la
 *    prioridad por defecto (Media) y el canal (QR) los asignan los triggers
 *    de BD (0003/0004) con secuencia anual atómica: sin colisiones, sin
 *    max()+1, sin hardcodeo.
 *  · No hay DELETE de incidencias en la aplicación: RLS no lo concede a nadie.
 *  · La descripción respeta ck_incidencias_descripcion (10–2000 caracteres).
 *
 * Trazabilidad (fase actual): evidencias en Storage PRIVADO + comentarios +
 * historial enriquecido. La identidad del actor y el path de Storage se
 * resuelven SIEMPRE en servidor; el cliente solo aporta el archivo y la
 * incidencia destino (que se revalida contra la BD con RLS).
 */

export interface EstadoCrearIncidencia {
  error: string | null;
  /** Código único generado por la BD (ej.: INC-2026-000128). */
  codigo: string | null;
  /** UUID de la incidencia creada (para adjuntar evidencias del mismo envío). */
  id: string | null;
}

/* ------------------------------------------------------------------ */
/* EVIDENCIAS (Storage privado) · COMENTARIOS · trazabilidad           */
/* ------------------------------------------------------------------ */

export interface EstadoEvidencia {
  error: string | null;
  /** Ids de evidencias registradas (incidencia_adjuntos). */
  registradas: number;
}

export interface EstadoComentario {
  error: string | null;
}

export interface EstadoAccionGenerica {
  error: string | null;
}

interface DatosNuevaIncidencia {
  ambiente_id: string;
  tipo_incidencia_id: string;
  subtipo_incidencia_id: string | null;
  prioridad_id: string | null;
  descripcion: string;
  /** Equipo opcional del ambiente (debe pertenecer al ambiente: RPC 0012). */
  equipo_id?: string | null;
  qr_codigo?: string | null;
}

/** Valida formato UUID v4-ish (los PK de la BD son UUID). */
function esUuid(valor: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    valor
  );
}

/**
 * Crea una incidencia y devuelve el código único generado por la BD.
 * El envío llega desde el formulario (con o sin QR); el ambiente viaja solo
 * como UUID validado contra la BD — nunca un ambiente escrito por el cliente.
 */
export async function crearIncidencia(
  datos: DatosNuevaIncidencia
): Promise<EstadoCrearIncidencia> {
  // 1) Sesión + permiso (defensa en profundidad además de RLS).
  const sesion = await getSesion();
  if (!sesion) {
    return { error: "Inicia sesión para reportar incidencias.", codigo: null, id: null };
  }
  const puedeCrear = await tienePermiso("crear_incidencia");
  if (!puedeCrear) {
    return {
      error: "Tu rol no permite registrar incidencias. Consulta al administrador.",
      codigo: null,
      id: null,
    };
  }

  // 2) Validaciones de formato (entrada del navegador: no confiable).
  const ambienteId = (datos.ambiente_id ?? "").trim();
  const tipoId = (datos.tipo_incidencia_id ?? "").trim();
  const subtipoId = (datos.subtipo_incidencia_id ?? "").trim();
  const prioridadId = (datos.prioridad_id ?? "").trim();
  const descripcion = (datos.descripcion ?? "").trim();

  if (!esUuid(ambienteId)) return { error: "Ambiente no válido.", codigo: null, id: null };
  if (!esUuid(tipoId)) return { error: "Elige el tipo de incidencia.", codigo: null, id: null };
  if (subtipoId && !esUuid(subtipoId)) {
    return { error: "El problema seleccionado no es válido.", codigo: null, id: null };
  }
  if (prioridadId && !esUuid(prioridadId)) {
    return { error: "La prioridad seleccionada no es válida.", codigo: null, id: null };
  }
  if (descripcion.length < 10 || descripcion.length > 2000) {
    return {
      error: "La descripción debe tener entre 10 y 2000 caracteres.",
      codigo: null,
      id: null,
    };
  }

  const supabase = await createClient();

  // 3) Validación del ambiente: debe existir y estar activo (lectura con RLS
  //    de infraestructura p_infra_lectura_ambientes; autenticado).
  type AmbienteValido = { id: string };
  const { data: ambiente } = await supabase
    .from("ambientes")
    .select("id")
    .eq("id", ambienteId)
    .eq("activo", true)
    .maybeSingle<AmbienteValido>();
  if (!ambiente) {
    return { error: "El ambiente no existe o no está disponible para reportes.", codigo: null, id: null };
  }

  // 4) El tipo debe existir y estar activo (el subtipo lo valida la FK
  //    compuesta en BD; aquí solo se normaliza a null si vino vacío).
  type TipoValido = { id: string };
  const { data: tipo } = await supabase
    .from("tipos_incidencia")
    .select("id")
    .eq("id", tipoId)
    .eq("activo", true)
    .maybeSingle<TipoValido>();
  if (!tipo) {
    return { error: "El tipo de incidencia no está disponible.", codigo: null, id: null };
  }

  // 5) Prioridad opcional (el trigger asigna Media si viene vacía).
  let equipoValido: string | null = null;
  if (prioridadId) {
    type PrioridadValida = { id: string };
    const { data: prioridad } = await supabase
      .from("prioridades")
      .select("id")
      .eq("id", prioridadId)
      .eq("activo", true)
      .maybeSingle<PrioridadValida>();
    if (!prioridad) {
      return { error: "La prioridad seleccionada no está disponible.", codigo: null, id: null };
    }
  }

  // 5b) Equipo opcional: SOLO se acepta si pertenece al ambiente (lista de la
  //     RPC 0012). Nunca un id enviado libremente desde el navegador.
  const equipoId = (datos.equipo_id ?? "").trim();
  if (equipoId) {
    if (!esUuid(equipoId)) {
      return { error: "El equipo seleccionado no es válido.", codigo: null, id: null };
    }
    const { data: equiposAmbiente } = await supabase.rpc("equipos_de_ambiente", {
      p_ambiente_id: ambienteId,
    });
    const pertenece = ((equiposAmbiente ?? []) as Array<{ equipo_id: string }>).some(
      (e) => e.equipo_id === equipoId
    );
    if (!pertenece) {
      return {
        error: "El equipo no pertenece al ambiente identificado.",
        codigo: null,
        id: null,
      };
    }
    equipoValido = equipoId;
  }

  // 6) Inserción: usuario_reportante_id SIEMPRE de la sesión de servidor.
  //    Código/estado/prioridad/canal por trigger. Canal: si vino de un QR el
  //    default 'QR' es correcto; el formulario web sin QR también usa QR/Website
  //    según semilla: 'QR' es el default de BD y la descripción del canal
  //    institucional se mantiene sin introducir valores nuevos.
  const insertPayload: Record<string, unknown> = {
    usuario_reportante_id: sesion.usuarioId,
    ambiente_id: ambienteId,
    tipo_incidencia_id: tipoId,
    subtipo_incidencia_id: subtipoId || null,
    prioridad_id: prioridadId || null,
    descripcion,
  };

  const { data: creada, error: errorInsert } = await supabase
    .from("incidencias")
    .insert(insertPayload)
    .select("id, codigo")
    .single<{ id: string; codigo: string }>();

  if (errorInsert || !creada) {
    // Mensajes de restricciones conocidas (FK compuesta del subtipo, etc.).
    const msg = errorInsert?.message ?? "";
    if (msg.includes("fk_incidencias_subtipo_coherente")) {
      return {
        error: "El problema seleccionado no corresponde al tipo elegido.",
        codigo: null,
        id: null,
      };
    }
    if (msg.includes("ck_incidencias_descripcion")) {
      return {
        error: "La descripción debe tener entre 10 y 2000 caracteres.",
        codigo: null,
        id: null,
      };
    }
    if (msg.includes("p_incidencias_insert") || msg.includes("row-level security")) {
      return {
        error: "Tu cuenta no permite registrar incidencias en este momento.",
        codigo: null,
        id: null,
      };
    }
    return {
      error: "No se pudo registrar la incidencia. Intenta nuevamente.",
      codigo: null,
      id: null,
    };
  }

  // 7) Equipo relacionado opcional (incidencia_equipos): la RLS (p_incidencia_equipos_all)
  //    permite al dueño insertar. La FK garantiza que el equipo exista; la
  //    pertenencia al ambiente ya fue validada arriba (paso 5b).
  if (equipoValido) {
    const { error: errorEquipo } = await supabase.from("incidencia_equipos").insert({
      incidencia_id: creada.id,
      equipo_id: equipoValido,
      es_equipo_principal: true,
    });
    if (errorEquipo) {
      // El reporte ya existe: el equipo es complementario y no debe bloquearlo.
      // Se registra el código devuelto igualmente (el técnico puede vincularlo luego).
      console.error("No se pudo vincular el equipo a la incidencia:", errorEquipo.message);
    }
  }

  // 8) CLASIFICACIÓN AUTOMÁTICA (Fase 8, Plan §36): la RPC evalúa las reglas
  //    CONFIGURABLES de reglas_enrutamiento (nunca casos hardcodeados). Si hay
  //    coincidencia crea la derivación inicial (área/servicio de la regla,
  //    motivo con su nombre), aplica prioridad_defecto y mueve el estado a
  //    Derivada. SIN regla coincidente el ticket queda Pendiente para gestión
  //    manual del coordinador. Un fallo de la clasificación NO invalida el
  //    reporte: el ticket existe y el coordinador puede derivarlo a mano.
  const { error: errorClasificar } = await supabase.rpc("clasificar_incidencia", {
    p_incidencia_id: creada.id,
    p_origen: "reporte_web",
  });
  if (errorClasificar) {
    console.error("Clasificación automática no aplicada:", errorClasificar.message);
  }

  // 9) SNAPSHOT DE SLA (Fase 8b, Plan §19): tras la clasificación, para que
  //    una prioridad por defecto de regla ya esté aplicada. La RPC 0017 fija
  //    el acuerdo, inicio y objetivos con now() de BD. Sin acuerdo activo la
  //    incidencia queda SIN SLA (sin fila) y el resto del módulo la trata como
  //    tal. Un fallo NO invalida el reporte; el backfill de administración lo
  //    recupera después.
  const { error: errorSla } = await supabase.rpc("registrar_sla_incidencia", {
    p_incidencia_id: creada.id,
  });
  if (errorSla) {
    console.error("Snapshot de SLA no registrado:", errorSla.message);
  }

  return { error: null, codigo: creada.codigo, id: creada.id };
}

/* ------------------------------------------------------------------ */
/* FASE 8 · REGLAS DE CLASIFICACIÓN, ASIGNACIÓN Y DERIVACIÓN           */
/* La lógica vive en las RPC 0016 (BD); estas acciones solo validan    */
/* entrada y traducen errores. La autorización la re-decide la RPC.    */
/* ------------------------------------------------------------------ */

/** Resultado de una operación de flujo (derivación/asignación). */
export interface EstadoDerivacion {
  error: string | null;
  /** Id de la derivación creada (null = la RPC no creó destino). */
  id: string | null;
}

/**
 * Clasifica MANUALMENTE una incidencia Pendiente con las reglas vigentes
 * (botón «Evaluar reglas» del panel de gestión; misma RPC que el flujo
 * automático — configurable, sin hardcodeo).
 */
export async function clasificarIncidencia(
  incidenciaId: string
): Promise<EstadoDerivacion> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida.", id: null };
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión.", id: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clasificar_incidencia", {
    p_incidencia_id: incidenciaId,
    p_origen: "manual_autorizada",
  });
  if (error) return { error: traducirErrorReglas(error.message), id: null };
  return { error: null, id: (data as string | null) ?? null };
}

/**
 * DERIVACIÓN MANUAL AUTORIZADA (Plan §5.5/§40): traslada la incidencia a otra
 * área (y servicio opcional) con motivo obligatorio. La RPC 0016 revalida en
 * BD: admin, coordinador del área vigente o permiso derivar_incidencia;
 * servicio ∈ área; estados finales excluidos; cierra la asignación previa y
 * deja auditoría DERIVAR + historial (trigger 0013).
 */
export async function derivarIncidencia(
  incidenciaId: string,
  areaDestinoId: string,
  servicioDestinoId: string | null,
  motivo: string
): Promise<EstadoDerivacion> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida.", id: null };
  if (!esUuid(areaDestinoId)) return { error: "Selecciona el área de destino.", id: null };
  if (servicioDestinoId && !esUuid(servicioDestinoId)) {
    return { error: "El servicio seleccionado no es válido.", id: null };
  }
  const texto = motivo.trim();
  if (texto.length < 5) {
    return { error: "Describe el motivo de la derivación (mínimo 5 caracteres).", id: null };
  }
  if (texto.length > 500) {
    return { error: "El motivo no puede superar los 500 caracteres.", id: null };
  }

  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión.", id: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("derivar_incidencia", {
    p_incidencia_id: incidenciaId,
    p_area_destino_id: areaDestinoId,
    p_servicio_destino_id: servicioDestinoId || null,
    p_motivo: texto,
  });
  if (error) return { error: traducirErrorReglas(error.message), id: null };
  return { error: null, id: (data as string | null) ?? null };
}

/**
 * ASIGNACIÓN MANUAL AUTORIZADA: asigna un técnico (activo del área destino
 * vigente) a la incidencia. La RPC 0016 revalida permisos y pertenencia; el
 * historial y la auditoría los escriben el trigger 0013 y la propia RPC.
 */
export async function asignarTecnicoIncidencia(
  incidenciaId: string,
  tecnicoId: string
): Promise<EstadoAccionGenerica> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida." };
  if (!esUuid(tecnicoId)) return { error: "Selecciona el técnico a asignar." };

  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_incidencia", {
    p_incidencia_id: incidenciaId,
    p_tecnico_id: tecnicoId,
  });
  if (error) return { error: traducirErrorReglas(error.message) };
  return { error: null };
}

/** Traduce errores de las RPC 0016 a mensajes claros en español. */
function traducirErrorReglas(mensaje: string): string {
  const m = mensaje || "";
  if (m.includes("No tienes autorización")) {
    return "No tienes autorización para esta operación sobre la incidencia.";
  }
  if (m.includes("motivo") && m.includes("obligatorio")) {
    return "El motivo de la derivación es obligatorio.";
  }
  if (m.includes("no pertenece al área")) {
    return "El servicio indicado no pertenece al área de destino.";
  }
  if (m.includes("no está activa")) return "El área de destino no está activa.";
  if (m.includes("no está activo en el área")) {
    return "El técnico no pertenece al área responsable de la incidencia.";
  }
  if (m.includes("Solo se clasifican")) {
    return "Solo se clasifican incidencias Pendientes (sin destino definido).";
  }
  if (m.includes("No se puede derivar") || m.includes("No se puede asignar")) {
    return "La incidencia ya no está en el flujo activo (resuelta, cerrada o cancelada).";
  }
  if (m.includes("row-level security") || m.includes("permission")) {
    return "Tu cuenta no tiene permisos para esta operación (validado en la base de datos).";
  }
  return "No se pudo completar la operación. Intenta nuevamente.";
}

/* ------------------------------------------------------------------ */
/* EVIDENCIAS · Storage privado (bucket `evidencias`, migración 0009)  */
/* ------------------------------------------------------------------ */

/** Evidencia que llega desde el formulario (File + su tipo declarado). */
export interface EvidenciaParaSubir {
  /** Archivo REAL del navegador (nunca solo metadatos serializados). */
  archivo: File;
  /** Tipo de evidencia: antes|durante|despues|documento|video. */
  tipo: string;
}

/**
 * Sede (código) del ambiente para armar el path de Storage (convención 0009:
 * <sede>/<año>/<incidencia_id>/<tipo>/<uuid>.<ext>). Se lee en servidor desde
 * la BD; el cliente nunca propone el path.
 */
async function codigoSedeDeIncidencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  incidenciaId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("incidencias")
    .select(
      `ambientes (
        pisos (
          pabellones (
            sedes ( codigo )
          )
        )
      )`
    )
    .eq("id", incidenciaId)
    .maybeSingle<{
      ambientes: {
        pisos: { pabellones: { sedes: { codigo: string } | null } | null } | null;
      } | null;
    }>();

  const codigo = data?.ambientes?.pisos?.pabellones?.sedes?.codigo ?? null;
  // La convención de 0009 pide el segmento de sede en minúsculas.
  return codigo ? codigo.toLowerCase() : null;
}

/**
 * Sube evidencias a Storage privado y registra sus metadatos (RPC 0013).
 *
 * Seguridad:
 *  · Sesión + permiso `adjuntar_evidencia` se verifican EN SERVIDOR.
 *  · El archivo llega como File real: el MIME y el tamaño se leen del binario
 *    (no se confía en nombres ni en validaciones del frontend).
 *  · El MIME se valida contra la misma lista blanca que el bucket (0009); la
 *    extensión del path se DERIVA del MIME validado, nunca del nombre original.
 *  · El path lo arma el servidor: <sede>/<año>/<incidencia_id>/<tipo>/<uuid>.<ext>.
 *  · La inserción del objeto pasa por la policy evidencias_insert (dueño,
 *    técnico asignado o admin) y la RPC valida el resto; sin service_role.
 *  · Si el registro de metadatos falla, se intenta borrar el objeto huérfano
 *    para no dejar basura en el bucket privado.
 */
export async function subirEvidencias(
  incidenciaId: string,
  evidencias: EvidenciaParaSubir[]
): Promise<EstadoEvidencia> {
  if (!esUuid(incidenciaId)) {
    return { error: "Incidencia no válida.", registradas: 0 };
  }
  if (!evidencias || evidencias.length === 0) {
    return { error: null, registradas: 0 };
  }
  if (evidencias.length > 5) {
    return { error: "Máximo 5 evidencias por envío.", registradas: 0 };
  }

  const sesion = await getSesion();
  if (!sesion) return { error: "Inicia sesión para adjuntar evidencias.", registradas: 0 };

  const puedeAdjuntar = await tienePermiso("adjuntar_evidencia");
  if (!puedeAdjuntar) {
    return { error: "Tu rol no permite adjuntar evidencias.", registradas: 0 };
  }

  const supabase = await createClient();

  // La incidencia debe existir y ser visible (RLS); se necesita su id real.
  const { data: incidencia } = await supabase
    .from("incidencias")
    .select("id")
    .eq("id", incidenciaId)
    .maybeSingle<{ id: string }>();
  if (!incidencia) {
    return { error: "La incidencia no existe o no es visible para tu cuenta.", registradas: 0 };
  }

  const sede = await codigoSedeDeIncidencia(supabase, incidencia.id);
  if (!sede) {
    return { error: "No se pudo determinar la sede de la incidencia.", registradas: 0 };
  }

  const anio = new Date().getFullYear();
  let registradas = 0;
  const primerError = await (async (): Promise<string | null> => {
    for (const ev of evidencias) {
      // 1) Validación SERVIDOR de MIME y tamaño (leídos del archivo real).
      const mime = ev.archivo.type;
      if (!EVIDENCIA_MIME_PERMITIDOS.includes(mime as (typeof EVIDENCIA_MIME_PERMITIDOS)[number])) {
        return `"${ev.archivo.name}": formato no permitido. Usa JPG, PNG, WEBP, PDF o MP4.`;
      }
      if (ev.archivo.size <= 0 || ev.archivo.size > EVIDENCIA_TAMANO_MAX) {
        return `"${ev.archivo.name}": supera el tamaño máximo (10 MB).`;
      }

      // 2) Tipo de evidencia (debe ser uno de los del CHECK de BD).
      const tipo = ev.tipo;
      if (!['antes', 'durante', 'despues', 'documento', 'video'].includes(tipo)) {
        return `"${ev.archivo.name}": tipo de evidencia no válido.`;
      }

      // 3) Path generado EN SERVIDOR con la convención de 0009.
      const objetoId = crypto.randomUUID();
      const extension = extensionDeMime(mime);
      const path = `${sede}/${anio}/${incidencia.id}/${tipo}/${objetoId}.${extension}`;

      // 4) Upload al bucket PRIVADO con el JWT del usuario (policy 0009).
      const { error: errorUpload } = await supabase.storage
        .from("evidencias")
        .upload(path, ev.archivo, {
          contentType: mime,
          cacheControl: "3600",
          upsert: false,
        });
      if (errorUpload) {
        if (errorUpload.message.includes("row-level security") || errorUpload.message.includes("policy")) {
          return `"${ev.archivo.name}": tu cuenta no permite subir archivos a esta incidencia.`;
        }
        return `"${ev.archivo.name}": no se pudo subir el archivo (${errorUpload.message}).`;
      }

      // 5) Registro de metadatos vía RPC 0013 (valida de nuevo + historial).
      const { error: errorRpc } = await supabase.rpc("adjuntar_evidencia", {
        p_incidencia_id: incidencia.id,
        p_tipo: tipo,
        p_path: path,
        p_nombre: ev.archivo.name,
        p_mime: mime,
        p_tamano: ev.archivo.size,
      });
      if (errorRpc) {
        // Sin metadatos no hay evidencia: se retira el objeto huérfano.
        await supabase.storage.from("evidencias").remove([path]);
        return `"${ev.archivo.name}": ${errorRpc.message}`;
      }
      registradas += 1;
    }
    return null;
  })();

  if (primerError) {
    return { error: primerError, registradas };
  }
  return { error: null, registradas };
}

/**
 * Elimina una evidencia (objeto Storage + metadatos + historial).
 * SOLO ADMINISTRADOR: lo decide la RPC 0013 (y la policy de Storage 0009);
 * la acción de servidor solo filtra temprano para dar un mensaje claro.
 */
export async function eliminarEvidencia(evidenciaId: string): Promise<EstadoAccionGenerica> {
  if (!esUuid(evidenciaId)) {
    return { error: "Evidencia no válida." };
  }
  const esAdmin = await tieneRol("ADMINISTRADOR");
  if (!esAdmin) {
    return { error: "Solo un administrador puede eliminar evidencias." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_evidencia", { p_evidencia_id: evidenciaId });
  if (error) {
    return { error: "No se pudo eliminar la evidencia." };
  }
  return { error: null };
}

/* ------------------------------------------------------------------ */
/* MÓDULO TÉCNICO · flujo de atención (RPC 0014; lógica en BD)         */
/* ------------------------------------------------------------------ */

/**
 * ACEPTAR la asignación (Asignada → En proceso; aceptado_en).
 * La RPC revalida en BD: asignación activa del técnico autenticado y estado
 * exacto; sin asignación o con otro estado la BD rechaza la operación.
 */
export async function aceptarIncidenciaAsignada(
  incidenciaId: string
): Promise<EstadoAccionGenerica> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida." };
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("tecnico_aceptar_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  if (error) {
    return { error: traducirErrorFlujo(error.message) };
  }

  // SLA (0017): aceptar = primera respuesta. La RPC estampa fecha_inicio y
  // horas reales; fallo no bloquea la aceptación (backfill lo recupera).
  const { error: errorSla } = await supabase.rpc("refrescar_sla_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  if (errorSla) {
    console.error("SLA no actualizado al aceptar:", errorSla.message);
  }

  return { error: null };
}

/**
 * CAMBIAR ESTADO con transición validada EN BD (RPC 0014):
 * Asignada→En proceso · En proceso→En espera · En espera→En proceso.
 * El motivo es obligatorio al poner en espera ([VI]; lo impone la RPC).
 */
export async function cambiarEstadoIncidencia(
  incidenciaId: string,
  nuevoEstado: "En proceso" | "En espera",
  detalle?: string
): Promise<EstadoAccionGenerica> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida." };
  if (nuevoEstado === "En espera" && !(detalle ?? "").trim()) {
    return { error: "Indica el motivo de la espera." };
  }
  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("tecnico_cambiar_estado", {
    p_incidencia_id: incidenciaId,
    p_nuevo_estado: nuevoEstado,
    p_detalle: detalle?.trim() || null,
  });
  if (error) {
    return { error: traducirErrorFlujo(error.message) };
  }
  return { error: null };
}

/** REGISTRAR DIAGNÓSTICO (crea/actualiza el registro técnico; RPC 0014). */
export async function registrarDiagnostico(
  incidenciaId: string,
  diagnostico: string
): Promise<EstadoAccionGenerica> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida." };
  const texto = diagnostico.trim();
  if (!texto) return { error: "Escribe el diagnóstico." };

  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("tecnico_registrar_diagnostico", {
    p_incidencia_id: incidenciaId,
    p_diagnostico: texto,
  });
  if (error) {
    return { error: traducirErrorFlujo(error.message) };
  }
  return { error: null };
}

/** REGISTRAR ACCIÓN realizada (se anexa al registro técnico; RPC 0014). */
export async function registrarAccionTecnico(
  incidenciaId: string,
  accion: string
): Promise<EstadoAccionGenerica> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida." };
  const texto = accion.trim();
  if (!texto) return { error: "Describe la acción realizada." };

  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("tecnico_registrar_accion", {
    p_incidencia_id: incidenciaId,
    p_accion: texto,
  });
  if (error) {
    return { error: traducirErrorFlujo(error.message) };
  }
  return { error: null };
}

/**
 * RESOLVER (En proceso → Resuelta) con solución obligatoria (RPC 0014).
 * El cierre posterior lo confirma el reportante (RLS 0007).
 */
export async function resolverIncidenciaAsignada(
  incidenciaId: string,
  solucion: string
): Promise<EstadoAccionGenerica> {
  if (!esUuid(incidenciaId)) return { error: "Incidencia no válida." };
  const texto = solucion.trim();
  if (!texto) return { error: "Describe la solución aplicada." };

  const sesion = await getSesion();
  if (!sesion) return { error: "Sesión expirada. Vuelve a iniciar sesión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("tecnico_resolver_incidencia", {
    p_incidencia_id: incidenciaId,
    p_solucion: texto,
  });
  if (error) {
    return { error: traducirErrorFlujo(error.message) };
  }

  // SLA (0017): resolver = fin del SLA de resolución (horas reales +
  // cumplimiento). Fallo no bloquea la resolución (backfill lo recupera).
  const { error: errorSla } = await supabase.rpc("refrescar_sla_incidencia", {
    p_incidencia_id: incidenciaId,
  });
  if (errorSla) {
    console.error("SLA no actualizado al resolver:", errorSla.message);
  }

  return { error: null };
}

/** Traduce errores de las RPC 0013/0014 a mensajes claros para el técnico. */
function traducirErrorFlujo(mensaje: string): string {
  const m = mensaje || "";
  if (m.includes("No tienes una asignación")) return "No tienes esta incidencia asignada (o ya no está activa).";
  if (m.includes("Solo se puede aceptar")) return "Solo puedes aceptar incidencias en estado Asignada.";
  if (m.includes("Transición no permitida")) return "Ese cambio de estado no sigue el flujo del sistema.";
  if (m.includes("Solo se resuelve")) return "Solo puedes resolver incidencias que estén En proceso.";
  if (m.includes("motivo de la espera")) return "Indica el motivo de la espera.";
 if (m.includes("resolver_incidencia") || m.includes("cambiar_estado")) {
    return "Tu rol no permite esa operación sobre la incidencia.";
  }
  if (m.includes("row-level security") || m.includes("policy")) {
    return "Tu cuenta no tiene permisos para esa operación en esta incidencia.";
  }
  return "No se pudo completar la operación. Intenta nuevamente.";
}

/**
 * Agrega un comentario a la incidencia (dueño o técnico asignado; RPC 0013).
 * La nota interna solo la puede crear técnico/admin: la RPC lo impone.
 */
export async function agregarComentario(
  incidenciaId: string,
  comentario: string,
  esInterno = false
): Promise<EstadoComentario> {
  if (!esUuid(incidenciaId)) {
    return { error: "Incidencia no válida." };
  }
  const texto = comentario.trim();
  if (texto.length < 1 || texto.length > 3000) {
    return { error: "El comentario debe tener entre 1 y 3000 caracteres." };
  }

  const sesion = await getSesion();
  if (!sesion) return { error: "Inicia sesión para comentar." };

  const puedeComentar = await tienePermiso("comentar_incidencia");
  if (!puedeComentar) {
    return { error: "Tu rol no permite comentar en incidencias." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("agregar_comentario", {
    p_incidencia_id: incidenciaId,
    p_comentario: texto,
    p_es_interno: esInterno,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("No autorizado")) {
      return { error: "No puedes comentar en esta incidencia." };
    }
    if (msg.includes("vacío") || msg.includes("3000")) {
      return { error: msg };
    }
    return { error: "No se pudo guardar el comentario. Intenta nuevamente." };
  }
  return { error: null };
}
