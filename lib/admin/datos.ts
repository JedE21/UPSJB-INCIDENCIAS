import { createClient } from "@/lib/supabase/server";
import {
  GRUPOS_ADMIN,
  ENTIDADES_ADMIN,
  type EntidadAdmin,
  type FilaEntidad,
} from "@/lib/admin/entidades";

/**
 * CAPA DE DATOS DEL PANEL ADMIN · SIR-UPSJB (FASE 7)
 *
 * Todas las consultas usan el cliente Supabase de SERVIDOR con el JWT del
 * usuario: RLS (0007) decide qué filas son visibles. El ADMINISTRADOR pasa
 * las políticas p_*_admin; cualquier otro rol obtendrá listas vacías o
 * error de permisos (el layout además exige el panel admin).
 *
 * Sin service-role: la app nunca eleva privilegios.
 */

/* ------------------------------------------------------------------ */
/* Listado genérico                                                    */
/* ------------------------------------------------------------------ */

export interface ListadoEntidad {
  filas: FilaEntidad[];
  error: string | null;
}

/**
 * Lista una entidad con las etiquetas de jerarquía/relación normalizadas
 * para búsqueda y filtros del cliente. Los embeds FK llegan como objetos
 * { id, ... }; aquí se proyectan a campos planos.
 */
export async function listarEntidad(entidad: EntidadAdmin): Promise<ListadoEntidad> {
  const supabase = await createClient();

  let consulta = supabase.from(entidad.tabla).select(entidad.select);
  if (entidad.orden) {
    consulta = consulta.order(entidad.orden.campo, {
      ascending: entidad.orden.ascendente ?? true,
    });
  }

  const { data, error } = await consulta;
  if (error) return { filas: [], error: error.message };

  const filas = (data ?? []) as unknown as FilaEntidad[];
  return { filas: filas.map((f) => normalizarFila(entidad, f)), error: null };
}

/** Proyecciones de embeds → campos planos + etiquetas de jerarquía. */
function normalizarFila(entidad: EntidadAdmin, fila: FilaEntidad): FilaEntidad {
  const jerarquia: string[] = [];

  switch (entidad.slug) {
    case "pabellones": {
      const sede = fila.sedes as { id?: string; nombre?: string } | null;
      if (sede?.nombre) jerarquia.push(sede.nombre);
      break;
    }

    case "pisos": {
      const pab = fila.pabellones as
        | { id?: string; nombre?: string; sedes?: { id?: string; nombre?: string } | null }
        | null;
      const sedeNombre = pab?.sedes?.nombre ?? null;
      const pabellonNombre = pab?.nombre ?? null;
      fila.sede = sedeNombre;
      fila.pabellon = pabellonNombre;
      if (sedeNombre) jerarquia.push(sedeNombre);
      if (pabellonNombre) jerarquia.push(pabellonNombre);
      break;
    }

    case "ambientes": {
      const piso = fila.pisos as
        | {
            numero: number;
            nombre?: string | null;
            pabellones?: { nombre?: string; sedes?: { nombre?: string } | null } | null;
          }
        | null;
      const tipo = fila.tipos_ambiente as { id?: string; nombre?: string } | null;
      fila.tipo = tipo?.nombre ?? null;
      if (piso?.pabellones?.sedes?.nombre) jerarquia.push(piso.pabellones.sedes.nombre);
      if (piso?.pabellones?.nombre) jerarquia.push(piso.pabellones.nombre);
      if (piso) jerarquia.push(piso.nombre ?? `Piso ${piso.numero}`);
      break;
    }

    case "aulas":
    case "laboratorios":
    case "caracteristicas": {
      const amb = fila.ambiente_id as
        | {
            id?: string;
            nombre?: string;
            codigo?: string;
            activo?: boolean;
            pisos?: {
              numero: number;
              nombre?: string | null;
              pabellones?: { nombre?: string; sedes?: { nombre?: string } | null } | null;
            } | null;
          }
        | null;
      fila.nombre = amb?.nombre ?? null;
      fila.codigo = amb?.codigo ?? null;
      fila.activo = amb?.activo ?? false;
      const piso = amb?.pisos;
      const partes: string[] = [];
      if (piso?.pabellones?.sedes?.nombre) partes.push(piso.pabellones.sedes.nombre);
      if (piso?.pabellones?.nombre) partes.push(piso.pabellones.nombre);
      if (piso) partes.push(piso.nombre ?? `Piso ${piso.numero}`);
      fila.ubicacion = partes.join(" · ");
      break;
    }

    case "servicios": {
      const area = fila.areas as { id?: string; nombre?: string } | null;
      if (area?.nombre) jerarquia.push(area.nombre);
      break;
    }

    case "tecnicos": {
      const perfil = fila.perfiles as
        | { id?: string; nombres?: string; apellido_paterno?: string; apellido_materno?: string | null; correo?: string | null }
        | null;
      const area = fila.areas as { id?: string; nombre?: string } | null;
      const sede = fila.sedes as { id?: string; nombre?: string } | null;
      fila.nombre = [perfil?.nombres, perfil?.apellido_paterno, perfil?.apellido_materno]
        .filter(Boolean)
        .join(" ");
      fila.correo = perfil?.correo ?? null;
      if (area?.nombre) jerarquia.push(area.nombre);
      if (sede?.nombre) jerarquia.push(sede.nombre);
      break;
    }

    case "modelos": {
      const marca = fila.marcas_equipos as { id?: string; nombre?: string } | null;
      if (marca?.nombre) jerarquia.push(marca.nombre);
      break;
    }

    case "equipos": {
      const cat = fila.categorias_equipos as { id?: string; nombre?: string } | null;
      const mod = fila.modelos_equipos as
        | { id?: string; nombre?: string; marcas_equipos?: { id?: string; nombre?: string } | null }
        | null;
      const est = fila.estados_equipos as { id?: string; nombre?: string } | null;
      fila.marca_id = mod?.marcas_equipos?.id ?? null;
      if (cat?.nombre) jerarquia.push(cat.nombre);
      if (mod?.nombre) jerarquia.push(`${mod.nombre} (${mod.marcas_equipos?.nombre ?? "—"})`);
      if (est?.nombre) jerarquia.push(est.nombre);
      break;
    }

    case "asignaciones": {
      const equipo = fila.equipos as
        | { id?: string; codigo_interno?: string; numero_serie?: string | null; categorias_equipos?: { id?: string; nombre?: string } | null }
        | null;
      const amb = fila.ambientes as
        | {
            id?: string;
            nombre?: string;
            codigo?: string;
            pisos?: {
              numero: number;
              nombre?: string | null;
              pabellones?: { nombre?: string; sedes?: { nombre?: string } | null } | null;
            } | null;
          }
        | null;
      fila.equipo = [equipo?.codigo_interno, equipo?.numero_serie].filter(Boolean).join(" · ");
      fila.ambiente = [amb?.nombre, amb?.codigo].filter(Boolean).join(" · ");
      // La tabla genérica y el toggle usan `activo`; aquí la columna es `activa`.
      fila.activo = fila.activa === true;
      const partes: string[] = [];
      if (amb?.pisos?.pabellones?.sedes?.nombre) partes.push(amb.pisos.pabellones.sedes.nombre);
      if (amb?.pisos?.pabellones?.nombre) partes.push(amb.pisos.pabellones.nombre);
      if (amb?.pisos) partes.push(amb.pisos.nombre ?? `Piso ${amb.pisos.numero}`);
      fila.ubicacion = partes.join(" · ");
      if (equipo?.categorias_equipos?.nombre) jerarquia.push(equipo.categorias_equipos.nombre);
      break;
    }

    case "movimientos": {
      const equipo = fila.equipos as
        | { id?: string; codigo_interno?: string; categorias_equipos?: { id?: string; nombre?: string } | null }
        | null;
      const origen = fila.fk_movimientos_equipos_origen as { id?: string; nombre?: string; codigo?: string } | null;
      const destino = fila.fk_movimientos_equipos_destino as { id?: string; nombre?: string; codigo?: string } | null;
      fila.equipo = equipo?.codigo_interno ?? null;
      fila.origen = origen ? [origen.nombre, origen.codigo].filter(Boolean).join(" · ") : null;
      fila.destino = destino ? [destino.nombre, destino.codigo].filter(Boolean).join(" · ") : null;
      break;
    }

    default:
      break;
  }

  return { ...fila, jerarquia: jerarquia.filter(Boolean) };
}

/* ------------------------------------------------------------------ */
/* Referencias para selects y filtros                                  */
/* ------------------------------------------------------------------ */

export interface Referencia {
  id: string;
  nombre: string;
  /** Etiqueta jerárquica opcional (p. ej. sede del pabellón). */
  detalle?: string | null;
  activo?: boolean;
  /** Para pisos: pabellón dueño (filtro en cascada en el cliente). */
  padre_id?: string | null;
}

/**
 * Carga las referencias que una entidad necesita (campos uuid y filtros).
 * Cada loader devuelve id + nombre + detalle; `padre_id` habilita cascadas
 * (pabellón depende de sede; piso depende de pabellón).
 */
export async function cargarReferencias(
  keys: string[]
): Promise<Record<string, Referencia[]>> {
  const supabase = await createClient();
  const resultado: Record<string, Referencia[]> = {};
  const unicas = Array.from(new Set(keys));

  await Promise.all(
    unicas.map(async (key) => {
      switch (key) {
        case "sedes": {
          const { data } = await supabase
            .from("sedes")
            .select("id, nombre, activa")
            .order("nombre");
          resultado[key] = (data ?? []).map((s) => ({
            id: s.id,
            nombre: s.nombre,
            activo: s.activa,
          }));
          break;
        }
        case "pabellones": {
          const { data } = await supabase
            .from("pabellones")
            .select("id, nombre, sede_id, sedes ( nombre )")
            .order("nombre");
          resultado[key] = ((data ?? []) as unknown as Array<{
            id: string;
            nombre: string;
            sede_id: string;
            sedes: { nombre: string } | null;
          }>).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            detalle: p.sedes?.nombre ?? null,
            padre_id: p.sede_id,
          }));
          break;
        }
        case "pisos": {
          const { data } = await supabase
            .from("pisos")
            .select("id, numero, nombre, pabellon_id, pabellones ( nombre, sedes ( nombre ) )")
            .order("pabellones(nombre)");
          resultado[key] = ((data ?? []) as unknown as Array<{
            id: string;
            numero: number;
            nombre: string | null;
            pabellon_id: string;
            pabellones: { nombre: string } | null;
          }>).map((p) => ({
            id: p.id,
            nombre: p.nombre ?? `Piso ${p.numero}`,
            detalle: p.pabellones?.nombre ?? null,
            padre_id: p.pabellon_id,
          }));
          break;
        }
        case "tipos_ambiente": {
          const { data } = await supabase
            .from("tipos_ambiente")
            .select("id, nombre, activo")
            .order("nombre");
          resultado[key] = data ?? [];
          break;
        }
        case "areas": {
          const { data } = await supabase
            .from("areas")
            .select("id, nombre, activo")
            .order("nombre");
          resultado[key] = data ?? [];
          break;
        }
        case "tipos_incidencia": {
          const { data } = await supabase
            .from("tipos_incidencia")
            .select("id, nombre, activo")
            .order("nombre");
          resultado[key] = data ?? [];
          break;
        }
        case "subtipos_incidencia": {
          const { data } = await supabase
            .from("subtipos_incidencia")
            .select("id, nombre, tipo_incidencia_id, activo")
            .order("nombre");
          resultado[key] = ((data ?? []) as Array<{
            id: string;
            nombre: string;
            tipo_incidencia_id: string;
            activo: boolean;
          }>).map((s) => ({
            id: s.id,
            nombre: s.nombre,
            activo: s.activo,
            padre_id: s.tipo_incidencia_id,
          }));
          break;
        }
        case "prioridades": {
          const { data } = await supabase
            .from("prioridades")
            .select("id, nombre, nivel, activo")
            .order("nivel");
          resultado[key] = ((data ?? []) as Array<{
            id: string;
            nombre: string;
            nivel: number;
            activo: boolean;
          }>).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            activo: p.activo,
          }));
          break;
        }
        case "servicios_destino": {
          const { data } = await supabase
            .from("servicios")
            .select("id, nombre, area_id, activo")
            .order("nombre");
          resultado[key] = ((data ?? []) as Array<{
            id: string;
            nombre: string;
            area_id: string;
            activo: boolean;
          }>).map((s) => ({
            id: s.id,
            nombre: s.nombre,
            detalle: null,
            activo: s.activo,
            padre_id: s.area_id,
          }));
          break;
        }
        case "ambientes": {
          const { data } = await supabase
            .from("ambientes")
            .select("id, nombre, codigo, activo")
            .order("codigo");
          resultado[key] = (data ?? []).map((a) => ({
            id: a.id,
            nombre: `${a.nombre} (${a.codigo})`,
            activo: a.activo,
          }));
          break;
        }
        case "perfiles": {
          const { data } = await supabase
            .from("perfiles")
            .select("id, nombres, apellido_paterno, apellido_materno, correo, estado")
            .order("nombres");
          resultado[key] = (data ?? []).map((p) => ({
            id: p.id,
            nombre: [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" "),
            detalle: p.correo,
            activo: p.estado === "activo",
          }));
          break;
        }
        case "equipos": {
          const { data } = await supabase
            .from("equipos")
            .select("id, codigo_interno, numero_serie, categorias_equipos ( nombre )")
            .order("codigo_interno");
          resultado[key] = ((data ?? []) as unknown as Array<{
            id: string;
            codigo_interno: string;
            numero_serie: string | null;
            categorias_equipos: { nombre: string } | null;
          }>).map((e) => ({
            id: e.id,
            nombre: e.codigo_interno,
            detalle: [e.categorias_equipos?.nombre, e.numero_serie].filter(Boolean).join(" · ") || null,
            activo: true,
          }));
          break;
        }
        case "categorias": {
          const { data } = await supabase
            .from("categorias_equipos")
            .select("id, nombre, activo")
            .order("nombre");
          resultado[key] = data ?? [];
          break;
        }
        case "marcas": {
          const { data } = await supabase
            .from("marcas_equipos")
            .select("id, nombre, activo")
            .order("nombre");
          resultado[key] = data ?? [];
          break;
        }
        case "modelos": {
          const { data } = await supabase
            .from("modelos_equipos")
            .select("id, nombre, marca_id, marcas_equipos ( nombre )")
            .order("nombre");
          resultado[key] = ((data ?? []) as unknown as Array<{
            id: string;
            nombre: string;
            marca_id: string;
            marcas_equipos: { nombre: string } | null;
          }>).map((m) => ({
            id: m.id,
            nombre: m.nombre,
            detalle: m.marcas_equipos?.nombre ?? null,
            padre_id: m.marca_id,
          }));
          break;
        }
        case "estados": {
          const { data } = await supabase
            .from("estados_equipos")
            .select("id, nombre, es_final, activo")
            .order("nombre");
          resultado[key] = (data ?? []).map((e) => ({
            id: e.id,
            nombre: e.es_final ? `${e.nombre} (final)` : e.nombre,
            activo: e.activo,
          }));
          break;
        }
        default:
          resultado[key] = [];
      }
    })
  );

  return resultado;
}

/**
 * Referencias necesarias por entidad (campos uuid + filtros con referencia).
 * El alias traduce el nombre del CAMPO FK (sede_id) al nombre de la TABLA de
 * referencia (sedes); es la fuente única de verdad compartida con las páginas.
 */
export const ALIAS_REFERENCIAS: Record<string, string> = {
  sede_id: "sedes",
  pabellon_id: "pabellones",
  piso_id: "pisos",
  area_id: "areas",
  tipo_ambiente_id: "tipos_ambiente",
  perfil_id: "perfiles",
  equipo_id: "equipos",
  ambiente_id: "ambientes",
  categoria_id: "categorias",
  marca_id: "marcas",
  modelo_id: "modelos",
  estado_id: "estados",
  // Fase 8 (reglas de clasificación): tipo/subtipo con cascada, área y
  // servicio destino (servicio filtrado por el área elegido en el formulario).
  tipo_incidencia_id: "tipos_incidencia",
  subtipo_incidencia_id: "subtipos_incidencia",
  area_destino_id: "areas",
  servicio_destino_id: "servicios_destino",
  prioridad_defecto_id: "prioridades",
  // Fase 8b (SLA): acuerdo por prioridad (+ especialización por tipo).
  prioridad_id: "prioridades",
};

export function referenciasDeEntidad(entidad: EntidadAdmin): string[] {
  const keys: string[] = [];
  for (const campo of entidad.campos) {
    if (campo.tipo === "uuid") keys.push(ALIAS_REFERENCIAS[campo.name] ?? campo.name);
  }
  for (const filtro of entidad.filtros ?? []) {
    if (filtro.referencia) keys.push(filtro.referencia);
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Dashboard administrativo (KPIs contados en servidor)                */
/* ------------------------------------------------------------------ */

export interface KpisAdmin {
  usuarios: number;
  tecnicos: number;
  incidenciasAbiertas: number;
  incidenciasTotal: number;
  sedesActivas: number;
  ambientesActivos: number;
  equiposRegistrados: number;
  qrActivos: number;
}

export interface SerieSimple {
  nombre: string;
  cantidad: number;
}

export interface DatosDashboardAdmin {
  kpis: KpisAdmin;
  porEstado: SerieSimple[];
  porTipo: SerieSimple[];
  ultimas: Array<{
    id: string;
    codigo: string;
    estado: string;
    prioridad: string;
    descripcion: string;
    fecha_reporte: string;
    ambiente: string;
  }>;
  error: string | null;
}

async function contar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabla: string,
  filtro?: Record<string, boolean | string>
): Promise<number> {
  let consulta = supabase.from(tabla).select("id", { count: "exact", head: true });
  if (filtro) {
    for (const [col, valor] of Object.entries(filtro)) {
      consulta = consulta.eq(col, valor);
    }
  }
  const { count, error } = await consulta;
  return error ? 0 : (count ?? 0);
}

/**
 * KPIs del dashboard admin: conteos EXACTOS en servidor (head: true) sobre
 * tablas con RLS; con rol admin pasan las políticas de lectura.
 * Los desgloses por estado/tipo se agregan en memoria (sin depender de la
 * agregación de PostgREST, que puede no estar habilitada).
 */
export async function obtenerDatosDashboardAdmin(): Promise<DatosDashboardAdmin> {
  const supabase = await createClient();

  const [
    usuarios,
    tecnicos,
    incidenciasTotal,
    sedesActivas,
    ambientesActivos,
    qrActivos,
    equiposRegistrados,
  ] = await Promise.all([
    contar(supabase, "perfiles", { estado: "activo" }),
    contar(supabase, "tecnicos", { activo: true }),
    contar(supabase, "incidencias"),
    contar(supabase, "sedes", { activa: true }),
    contar(supabase, "ambientes", { activo: true }),
    contar(supabase, "codigos_qr", { activo: true }),
    contar(supabase, "equipos", { activo: true }),
  ]);

  // OPTIMIZACIÓN (Fase 14): los desgloses se agregan EN POSTGRES con la RPC
  // series_analiticas (0019) — antes se descargaban hasta 2×2000 filas y se
  // contaban en memoria. Ahora: 2 filas de resultado por serie (O(1) red).
  // El conteo de "abiertas" usa el total de estados no finales de la serie.
  const [porEstadoSerie, porTipoSerie] = await Promise.all([
    supabase.rpc("series_analiticas", { p_serie: "estado", p_limite: 20 }),
    supabase.rpc("series_analiticas", { p_serie: "tipo", p_limite: 8 }),
  ]);

  function serieDeResultado(
    data: unknown,
    error: { message: string } | null
  ): SerieSimple[] {
    if (error || !Array.isArray(data)) return []; // RPC no aplicada aún: degrada a vacío
    return (data as Array<Record<string, unknown>>).map((f) => ({
      nombre: String(f.etiqueta ?? "—"),
      cantidad: Number(f.cantidad ?? 0),
    }));
  }

  const porEstado = serieDeResultado(porEstadoSerie.data, porEstadoSerie.error);
  const porTipo = serieDeResultado(porTipoSerie.data, porTipoSerie.error);

  const { data: ultimasData } = await supabase
    .from("incidencias")
    .select(
      `id, codigo, descripcion, fecha_reporte,
       estados_incidencia ( nombre ),
       prioridades ( nombre ),
       ambientes ( nombre )`
    )
    .order("fecha_reporte", { ascending: false })
    .limit(6);

  const ultimas = ((ultimasData ?? []) as unknown as Array<{
    id: string;
    codigo: string;
    descripcion: string;
    fecha_reporte: string;
    estados_incidencia: { nombre: string } | null;
    prioridades: { nombre: string } | null;
    ambientes: { nombre: string } | null;
  }>).map((r) => ({
    id: r.id,
    codigo: r.codigo,
    estado: r.estados_incidencia?.nombre ?? "—",
    prioridad: r.prioridades?.nombre ?? "—",
    descripcion: r.descripcion,
    fecha_reporte: r.fecha_reporte,
    ambiente: r.ambientes?.nombre ?? "—",
  }));

  // Estados finales (2 filas): la consulta de catálogo es barata y estable.
  const { data: finalesData } = await supabase
    .from("estados_incidencia")
    .select("nombre")
    .eq("es_final", true);
  const finales = new Set((finalesData ?? []).map((e) => e.nombre));
  const incidenciasAbiertas = porEstado
    .filter((e) => !finales.has(e.nombre))
    .reduce((acc, e) => acc + e.cantidad, 0);

  return {
    kpis: {
      usuarios,
      tecnicos,
      incidenciasAbiertas,
      incidenciasTotal,
      sedesActivas,
      ambientesActivos,
      equiposRegistrados,
      qrActivos,
    },
    porEstado,
    porTipo,
    ultimas,
    error: null,
  };
}

/** Nombres de entidades de un grupo (helper de páginas de secciones). */
export function entidadesDeGrupo(grupo: keyof typeof GRUPOS_ADMIN): EntidadAdmin[] {
  return (GRUPOS_ADMIN[grupo]?.entidades ?? [])
    .map((slug) => ENTIDADES_ADMIN[slug])
    .filter(Boolean);
}
