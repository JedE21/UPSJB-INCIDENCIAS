/**
 * ENTIDADES ADMINISTRABLES · SIR-UPSJB (FASE 7 — Administración de soporte)
 *
 * Descripción DECLARATIVA de cada entidad que el panel admin gestiona:
 *   · tabla      → fuente de verdad en PostgreSQL (RLS 0007: p_*_admin).
 *   · jerarquia  → columnas de agrupación (sede → pabellón → piso → ambiente).
 *   · filtros    → selects del FilterBar (referencias cargadas en servidor).
 *
 * Convención de selects FK: cada clave foránea se incluye EN LINEA con el
 * alias de tabla (`sedes ( id, nombre )`) y en la fila llega como objeto
 * { id, nombre }. Así el formulario lee el valor vigente con el MISMO nombre
 * del campo (campo.name = "sede_id" → fila.sede_id = { id }).
 *
 * Las Server Actions genéricas (lib/admin/acciones.ts) validan cada campo
 * contra esta definición ANTES de tocar la BD; RLS vuelve a validar en
 * PostgreSQL (defensa en profundidad: la UI nunca es el perímetro).
 *
 * Multi-sede: ninguna entidad asume una sede concreta; la Filial Ica es solo
 * la primera fila de datos. Sin datos institucionales inventados.
 */

import type { LucideIcon } from "lucide-react";

/** Tipo lógico de campo → validación y control de edición. */
export type TipoCampo =
  | "texto"
  | "textoLargo"
  | "entero"
  | "decimal"
  | "booleano"
  | "fecha"
  | "uuid"
  | "seleccion"
  | "listaEnteros";

export interface CampoEntidad {
  name: string;
  label: string;
  tipo: TipoCampo;
  requerido?: boolean;
  /** Longitud máxima (texto). */
  max?: number;
  /** Rango numérico (entero/decimal). */
  min?: number;
  maxNum?: number;
  /** Valores para tipo "seleccion" (CHECK de BD replicado en cliente). */
  opciones?: readonly string[];
  /** Placeholder/hint en el formulario. */
  hint?: string;
  /** No editable tras crear (p. ej. código padre de una jerarquía). */
  soloCreacion?: boolean;
  /** Valor por defecto para el formulario de creación. */
  defecto?: string | number | boolean;
  /** Solo UI: cargar la lista de modelos filtrada por la marca elegida. */
  uiFiltroPor?: string;
}

export interface CampoTabla {
  /** Identificador único de la columna (coincide con la clave de la fila). */
  id: string;
  header: string;
  /** Valor textual para búsqueda/orden. */
  value?: (fila: FilaEntidad) => string | number | null;
  /** Celda enriquecida (por defecto el texto del value). */
  cell?: (fila: FilaEntidad) => React.ReactNode;
  className?: string;
}

/** Fila normalizada que consumen las tablas (siempre strings/booleanos/planos). */
export interface FilaEntidad {
  id: string;
  activo?: boolean;
  /** Etiquetas de jerarquía ya resueltas en servidor. */
  jerarquia?: string[];
  [campo: string]: unknown;
}

/** Filtro de lista: se resuelve contra las referencias cargadas. */
export interface FiltroEntidad {
  key: string;
  label: string;
  /** Campo de la fila que se compara. */
  campo: string;
  /** Opciones estáticas (true/false/todos) o dinámicas (referencia). */
  estatico?: Array<{ value: string; label: string }>;
  /** Key de referencia dinámica (lista cargada en servidor). */
  referencia?: string;
}

/** Definición completa de una entidad administrable. */
export interface EntidadAdmin {
  slug: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  tabla: string;
  /** true si la fila tiene columna `activo` (activar/desactivar). */
  tieneActivo: boolean;
  /** Búsqueda textual del lado cliente (sobre value() de las columnas). */
  buscarPlaceholder: string;
  campos: CampoEntidad[];
  columnas: CampoTabla[];
  filtros?: FiltroEntidad[];
  /** Consulta select de servidor (encadenada a .from(tabla)). */
  select: string;
  orden?: { campo: string; ascendente?: boolean };
  /** Grupo de pestañas compartidas (infraestructura / organizacion / equipos). */
  grupo?:
    | "infraestructura"
    | "organizacion"
    | "equipos"
    | "usuarios"
    | "seguridad"
    | "qr"
    | "configuracion";
  /** Slug de la entidad padre inmediata (para breadcrumbs contextuales). */
  padre?: string;
  /** Columnas PK compuestas (sin columna id): equipos_ambientes. */
  claveCompuesta?: string[];
}

/* ------------------------------------------------------------------ */
/* Catálogos de infraestructura                                        */
/* ------------------------------------------------------------------ */

export const ENTIDAD_SEDES: EntidadAdmin = {
  slug: "sedes",
  titulo: "Sedes",
  descripcion:
    "Filiales y campus. La sede es la raíz de la jerarquía: pabellones → pisos → ambientes. Arquitectura multi-sede: cada nueva filial es una fila más.",
  icono: "Building2" as unknown as LucideIcon,
  tabla: "sedes",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre o código…",
  grupo: "infraestructura",
  select: "id, nombre, codigo, direccion, activa as activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    {
      name: "codigo",
      label: "Código",
      tipo: "texto",
      requerido: true,
      max: 20,
      hint: "Mayúsculas, números y guiones (p. ej. ICA). Prefijo de los códigos QR.",
      soloCreacion: true,
    },
    { name: "direccion", label: "Dirección", tipo: "texto", max: 200 },
    { name: "activo", label: "Activa", tipo: "booleano", defecto: true, hint: "Solo las sedes activas aparecen en el flujo público de reporte." },
  ],
  columnas: [
    { id: "nombre", header: "Nombre", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "codigo", header: "Código", value: (f) => f.codigo as string, cell: (f) => <span className="font-mono text-xs">{String(f.codigo)}</span> },
    { id: "direccion", header: "Dirección", value: (f) => (f.direccion as string) ?? "" },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activas" },
        { value: "inactivos", label: "Inactivas" },
      ],
    },
  ],
};

export const ENTIDAD_PABELLONES: EntidadAdmin = {
  slug: "pabellones",
  titulo: "Pabellones",
  descripcion: "Edificios de cada sede. El código es local a la sede (p. ej. B).",
  icono: "Warehouse" as unknown as LucideIcon,
  tabla: "pabellones",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre o código…",
  grupo: "infraestructura",
  padre: "sedes",
  select: "id, nombre, codigo, activo, sedes ( id, nombre )",
  orden: { campo: "nombre" },
  campos: [
    {
      name: "sede_id",
      label: "Sede",
      tipo: "uuid",
      requerido: true,
      hint: "Sede a la que pertenece el pabellón.",
      soloCreacion: true,
    },
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "codigo", label: "Código", tipo: "texto", requerido: true, max: 20, hint: "Corto y único dentro de la sede (p. ej. B)." },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Nombre", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "codigo", header: "Código", value: (f) => f.codigo as string, cell: (f) => <span className="font-mono text-xs">{String(f.codigo)}</span> },
    { id: "sede", header: "Sede", value: (f) => (f.jerarquia?.[0] ?? ""), cell: (f) => f.jerarquia?.[0] ?? "—" },
  ],
  filtros: [
    { key: "sede", label: "Sede", campo: "jerarquia", referencia: "sedes" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_PISOS: EntidadAdmin = {
  slug: "pisos",
  titulo: "Pisos",
  descripcion:
    "Niveles de cada pabellón (−2 a 20). El número debe ser único dentro del pabellón.",
  icono: "Layers" as unknown as LucideIcon,
  tabla: "pisos",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por nombre o número…",
  grupo: "infraestructura",
  padre: "pabellones",
  select:
    "id, numero, nombre, pabellones ( id, nombre, sedes ( id, nombre ) )",
  orden: { campo: "numero" },
  campos: [
    {
      name: "pabellon_id",
      label: "Pabellón",
      tipo: "uuid",
      requerido: true,
      hint: "Pabellón al que pertenece el piso.",
      soloCreacion: true,
    },
    { name: "numero", label: "Número", tipo: "entero", requerido: true, min: -2, maxNum: 20, hint: "Entero entre −2 (sótanos) y 20." },
    { name: "nombre", label: "Nombre (opcional)", tipo: "texto", max: 80, hint: 'Etiqueta opcional, p. ej. "Primer piso".' },
  ],
  columnas: [
    { id: "nombre", header: "Piso", value: (f) => (f.nombre as string) ?? `Piso ${f.numero}`, cell: (f) => <span className="font-medium">{(f.nombre as string) ?? `Piso ${f.numero}`}</span> },
    { id: "numero", header: "N°", value: (f) => f.numero as number },
    { id: "pabellon", header: "Pabellón", value: (f) => (f.pabellon as string) ?? "", cell: (f) => (f.pabellon as string) ?? "—" },
    { id: "sede", header: "Sede", value: (f) => (f.sede as string) ?? "", cell: (f) => (f.sede as string) ?? "—" },
  ],
  filtros: [
    { key: "sede", label: "Sede", campo: "sede", referencia: "sedes" },
    { key: "pabellon", label: "Pabellón", campo: "pabellon", referencia: "pabellones" },
  ],
};

export const ENTIDAD_TIPOS_AMBIENTE: EntidadAdmin = {
  slug: "tipos-ambiente",
  titulo: "Tipos de ambiente",
  descripcion:
    "Catálogo de tipos: Aula, Laboratorio, Oficina, Auditorio, Biblioteca, Baño, Taller, Almacén y Otro (semilla 0005). Determinan si un ambiente acepta especialización (aula/laboratorio).",
  icono: "Shapes" as unknown as LucideIcon,
  tabla: "tipos_ambiente",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "infraestructura",
  select: "id, nombre, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Tipo", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_AMBIENTES: EntidadAdmin = {
  slug: "ambientes",
  titulo: "Ambientes",
  descripcion:
    "Espacios físicos donde ocurren las incidencias (aulas, laboratorios, oficinas…). Fuente única de ubicación: toda FK de negocio apunta aquí.",
  icono: "DoorOpen" as unknown as LucideIcon,
  tabla: "ambientes",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre o código…",
  grupo: "infraestructura",
  padre: "pisos",
  select:
    "id, nombre, codigo, detalle_ubicacion, activo, tipos_ambiente ( id, nombre ), pisos ( id, numero, nombre, pabellones ( id, nombre, sedes ( id, nombre ) ) )",
  orden: { campo: "codigo" },
  campos: [
    {
      name: "piso_id",
      label: "Piso",
      tipo: "uuid",
      requerido: true,
      hint: "Piso donde se ubica el ambiente.",
      soloCreacion: true,
    },
    {
      name: "tipo_ambiente_id",
      label: "Tipo de ambiente",
      tipo: "uuid",
      requerido: true,
      hint: "Determina si acepta especialización (aula/laboratorio).",
    },
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120, hint: 'Nombre visible, p. ej. "Aula B-104".' },
    {
      name: "codigo",
      label: "Código",
      tipo: "texto",
      requerido: true,
      max: 40,
      hint: 'Jerárquico y único: SEDE-PABELLON-AMBIENTE, p. ej. "ICA-B-B104". Prefijo de los QR.',
      soloCreacion: true,
    },
    { name: "detalle_ubicacion", label: "Detalle de ubicación", tipo: "texto", max: 200, hint: "Opcional: ala, referencia interna…" },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Ambiente", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "codigo", header: "Código", value: (f) => f.codigo as string, cell: (f) => <span className="font-mono text-xs">{String(f.codigo)}</span> },
    { id: "tipo", header: "Tipo", value: (f) => (f.tipo as string) ?? "", cell: (f) => (f.tipo as string) ?? "—" },
    { id: "ubicacion", header: "Ubicación", value: (f) => (f.jerarquia?.join(" · ") ?? ""), cell: (f) => f.jerarquia?.join(" · ") || "—" },
  ],
  filtros: [
    { key: "sede", label: "Sede", campo: "jerarquia", referencia: "sedes" },
    { key: "pabellon", label: "Pabellón", campo: "jerarquia", referencia: "pabellones" },
    { key: "tipo", label: "Tipo", campo: "tipo", referencia: "tipos_ambiente" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_AULAS: EntidadAdmin = {
  slug: "aulas",
  titulo: "Aulas",
  descripcion:
    "Detalle especializado de los ambientes de tipo Aula (tabla hija 1:0..1, borrado en cascada con el ambiente). Capacidad y computadoras.",
  icono: "GraduationCap" as unknown as LucideIcon,
  tabla: "aulas",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por ambiente…",
  grupo: "infraestructura",
  select:
    "id, ambiente_id ( id, nombre, codigo, activo, pisos ( numero, nombre, pabellones ( nombre, sedes ( nombre ) ) ) ), capacidad, tiene_computadoras",
  orden: { campo: "ambiente_id" },
  campos: [
    {
      name: "ambiente_id",
      label: "Ambiente de tipo Aula",
      tipo: "uuid",
      requerido: true,
      hint: "Solo ambientes cuyo tipo sea Aula. Una aula por ambiente (PK = ambiente).",
      soloCreacion: true,
    },
    { name: "capacidad", label: "Capacidad", tipo: "entero", min: 1, maxNum: 9999, hint: "Número de estudiantes que admite el aula." },
    { name: "tiene_computadoras", label: "Tiene computadoras", tipo: "booleano", defecto: false },
  ],
  columnas: [
    { id: "nombre", header: "Aula", value: (f) => (f.nombre as string) ?? "", cell: (f) => <span className="font-medium">{(f.nombre as string) ?? "—"}</span> },
    { id: "codigo", header: "Código", value: (f) => (f.codigo as string) ?? "", cell: (f) => <span className="font-mono text-xs">{(f.codigo as string) ?? "—"}</span> },
    { id: "capacidad", header: "Capacidad", value: (f) => (f.capacidad as number) ?? "" },
    { id: "computadoras", header: "Computadoras", value: (f) => (f.tiene_computadoras ? "Sí" : "No") },
    { id: "ubicacion", header: "Ubicación", value: (f) => (f.ubicacion as string) ?? "", cell: (f) => (f.ubicacion as string) || "—" },
  ],
};

export const ENTIDAD_LABORATORIOS: EntidadAdmin = {
  slug: "laboratorios",
  titulo: "Laboratorios",
  descripcion:
    "Detalle especializado de los ambientes de tipo Laboratorio (tabla hija 1:0..1). Capacidad y tipo.",
  icono: "FlaskConical" as unknown as LucideIcon,
  tabla: "laboratorios",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por ambiente…",
  grupo: "infraestructura",
  select:
    "id, ambiente_id ( id, nombre, codigo, activo, pisos ( numero, nombre, pabellones ( nombre, sedes ( nombre ) ) ) ), capacidad, tipo_laboratorio",
  orden: { campo: "ambiente_id" },
  campos: [
    {
      name: "ambiente_id",
      label: "Ambiente de tipo Laboratorio",
      tipo: "uuid",
      requerido: true,
      hint: "Solo ambientes cuyo tipo sea Laboratorio. Un laboratorio por ambiente (PK = ambiente).",
      soloCreacion: true,
    },
    { name: "capacidad", label: "Capacidad", tipo: "entero", min: 1, maxNum: 9999, hint: "Puestos de trabajo del laboratorio." },
    { name: "tipo_laboratorio", label: "Tipo de laboratorio", tipo: "texto", max: 80, hint: 'P. ej. "Cómputo", "Física", "Química".' },
  ],
  columnas: [
    { id: "nombre", header: "Laboratorio", value: (f) => (f.nombre as string) ?? "", cell: (f) => <span className="font-medium">{(f.nombre as string) ?? "—"}</span> },
    { id: "codigo", header: "Código", value: (f) => (f.codigo as string) ?? "", cell: (f) => <span className="font-mono text-xs">{(f.codigo as string) ?? "—"}</span> },
    { id: "tipo", header: "Tipo", value: (f) => (f.tipo_laboratorio as string) ?? "" },
    { id: "capacidad", header: "Capacidad", value: (f) => (f.capacidad as number) ?? "" },
    { id: "ubicacion", header: "Ubicación", value: (f) => (f.ubicacion as string) ?? "", cell: (f) => (f.ubicacion as string) || "—" },
  ],
};

export const ENTIDAD_CARACTERISTICAS: EntidadAdmin = {
  slug: "caracteristicas",
  titulo: "Características",
  descripcion:
    "Ficha técnica de cada ambiente (tabla hija 1:0..1): capacidad, proyector, computadoras, internet, aire acondicionado, pizarra y observaciones.",
  icono: "ListChecks" as unknown as LucideIcon,
  tabla: "ambientes_caracteristicas",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por ambiente…",
  grupo: "infraestructura",
  select:
    "id, ambiente_id ( id, nombre, codigo, activo, pisos ( numero, nombre, pabellones ( nombre, sedes ( nombre ) ) ) ), capacidad, proyector, computadoras, internet, aire_acondicionado, pizarra, observaciones",
  orden: { campo: "ambiente_id" },
  campos: [
    {
      name: "ambiente_id",
      label: "Ambiente",
      tipo: "uuid",
      requerido: true,
      hint: "Una ficha por ambiente (PK = ambiente).",
      soloCreacion: true,
    },
    { name: "capacidad", label: "Capacidad", tipo: "entero", min: 0, maxNum: 9999 },
    { name: "computadoras", label: "N° de computadoras", tipo: "entero", min: 0, maxNum: 9999, defecto: 0 },
    { name: "proyector", label: "Proyector", tipo: "booleano", defecto: false },
    { name: "internet", label: "Internet", tipo: "booleano", defecto: true },
    { name: "aire_acondicionado", label: "Aire acondicionado", tipo: "booleano", defecto: false },
    { name: "pizarra", label: "Pizarra", tipo: "booleano", defecto: true },
    { name: "observaciones", label: "Observaciones", tipo: "textoLargo", max: 500 },
  ],
  columnas: [
    { id: "nombre", header: "Ambiente", value: (f) => (f.nombre as string) ?? "", cell: (f) => <span className="font-medium">{(f.nombre as string) ?? "—"}</span> },
    { id: "codigo", header: "Código", value: (f) => (f.codigo as string) ?? "", cell: (f) => <span className="font-mono text-xs">{(f.codigo as string) ?? "—"}</span> },
    { id: "capacidad", header: "Capacidad", value: (f) => (f.capacidad as number) ?? "" },
    { id: "equipamiento", header: "Equipamiento", value: (f) => (f.equipamiento as string) ?? "" },
  ],
};

/* ------------------------------------------------------------------ */
/* Catálogos de organización                                           */
/* ------------------------------------------------------------------ */

export const ENTIDAD_AREAS: EntidadAdmin = {
  slug: "areas",
  titulo: "Áreas",
  descripcion:
    "Áreas responsables de atender incidencias (destino de las derivaciones).",
  icono: "Boxes" as unknown as LucideIcon,
  tabla: "areas",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "organizacion",
  select: "id, nombre, descripcion, correo, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "descripcion", label: "Descripción", tipo: "textoLargo", max: 500 },
    { name: "correo", label: "Correo de contacto", tipo: "texto", max: 120, hint: "Opcional; correo funcional del área." },
    { name: "activo", label: "Activa", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Nombre", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "correo", header: "Correo", value: (f) => (f.correo as string) ?? "" },
    { id: "descripcion", header: "Descripción", value: (f) => (f.descripcion as string) ?? "", className: "max-w-xs truncate" },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activas" },
        { value: "inactivos", label: "Inactivas" },
      ],
    },
  ],
};

export const ENTIDAD_SERVICIOS: EntidadAdmin = {
  slug: "servicios",
  titulo: "Servicios",
  descripcion: "Servicios técnicos que ofrece cada área (p. ej. Redes dentro de Sistemas).",
  icono: "Wrench" as unknown as LucideIcon,
  tabla: "servicios",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "organizacion",
  padre: "areas",
  select: "id, nombre, activo, areas ( id, nombre )",
  orden: { campo: "nombre" },
  campos: [
    { name: "area_id", label: "Área", tipo: "uuid", requerido: true, hint: "Área a la que pertenece el servicio.", soloCreacion: true },
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Nombre", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "area", header: "Área", value: (f) => (f.jerarquia?.[0] ?? ""), cell: (f) => f.jerarquia?.[0] ?? "—" },
  ],
  filtros: [
    { key: "area", label: "Área", campo: "jerarquia", referencia: "areas" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_ESPECIALIDADES: EntidadAdmin = {
  slug: "especialidades",
  titulo: "Especialidades",
  descripcion: "Especialidades técnicas que pueden tener los técnicos (Soporte, Redes…).",
  icono: "BadgeCheck" as unknown as LucideIcon,
  tabla: "especialidades_tecnicas",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "organizacion",
  select: "id, nombre, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "activo", label: "Activa", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Nombre", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todas" },
        { value: "activos", label: "Activas" },
        { value: "inactivas", label: "Inactivas" },
      ],
    },
  ],
};

export const ENTIDAD_TECNICOS: EntidadAdmin = {
  slug: "tecnicos",
  titulo: "Técnicos",
  descripcion:
    "Fichas operativas de atención: un perfil de usuario registrado como técnico en un área y sede (1:0..1). El ROL TECNICO para el acceso al panel se asigna desde Usuarios.",
  icono: "Wrench" as unknown as LucideIcon,
  tabla: "tecnicos",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre, código o correo…",
  grupo: "organizacion",
  select:
    "id, codigo_tecnico, carga_maxima, activo, perfiles ( id, nombres, apellido_paterno, apellido_materno, correo ), areas ( id, nombre ), sedes ( id, nombre )",
  orden: { campo: "perfiles(nombres)" },
  campos: [
    {
      name: "perfil_id",
      label: "Usuario",
      tipo: "uuid",
      requerido: true,
      hint: "Perfil que ejercerá como técnico. No puede repetirse (uq_tecnicos_perfil).",
      soloCreacion: true,
    },
    { name: "area_id", label: "Área", tipo: "uuid", requerido: true },
    { name: "sede_id", label: "Sede", tipo: "uuid", requerido: true },
    { name: "codigo_tecnico", label: "Código de técnico", tipo: "texto", max: 30, hint: "Opcional; identificador interno." },
    { name: "carga_maxima", label: "Carga máxima", tipo: "entero", requerido: true, min: 1, maxNum: 100, defecto: 10, hint: "Incidencias simultáneas (1–100)." },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Técnico", value: (f) => (f.nombre as string) ?? "", cell: (f) => (
      <span>
        <span className="block font-medium">{(f.nombre as string) ?? "—"}</span>
        <span className="block text-xs text-muted-foreground">{(f.correo as string) ?? "—"}</span>
      </span>
    ) },
    { id: "area", header: "Área", value: (f) => (f.jerarquia?.[0] ?? ""), cell: (f) => f.jerarquia?.[0] ?? "—" },
    { id: "sede", header: "Sede", value: (f) => (f.jerarquia?.[1] ?? ""), cell: (f) => f.jerarquia?.[1] ?? "—" },
    { id: "codigo", header: "Código", value: (f) => (f.codigo_tecnico as string) ?? "", cell: (f) => <span className="font-mono text-xs">{(f.codigo_tecnico as string) ?? "—"}</span> },
    { id: "carga", header: "Carga máx.", value: (f) => f.carga_maxima as number },
  ],
  filtros: [
    { key: "area", label: "Área", campo: "jerarquia", referencia: "areas" },
    { key: "sede", label: "Sede", campo: "jerarquia", referencia: "sedes" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Seguridad (roles y permisos)                                        */
/* ------------------------------------------------------------------ */

export const ENTIDAD_ROLES: EntidadAdmin = {
  slug: "roles",
  titulo: "Roles",
  descripcion:
    "Roles del sistema. Cada rol agrupa permisos; los usuarios reciben roles (§8.1).",
  icono: "ShieldCheck" as unknown as LucideIcon,
  tabla: "roles",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "seguridad",
  select: "id, nombre, descripcion, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 60, hint: "En MAYÚSCULAS, p. ej. FACILITADOR. Lo usan el JWT y las políticas RLS." },
    { name: "descripcion", label: "Descripción", tipo: "textoLargo", max: 300 },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Rol", value: (f) => f.nombre as string, cell: (f) => <span className="font-mono text-xs font-semibold">{String(f.nombre)}</span> },
    { id: "descripcion", header: "Descripción", value: (f) => (f.descripcion as string) ?? "", className: "max-w-sm truncate" },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_PERMISOS: EntidadAdmin = {
  slug: "permisos",
  titulo: "Permisos",
  descripcion:
    "Permisos atómicos del sistema. El permiso efectivo de un usuario es la unión de los permisos de sus roles.",
  icono: "KeyRound" as unknown as LucideIcon,
  tabla: "permisos",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por código…",
  grupo: "seguridad",
  select: "id, codigo, descripcion",
  orden: { campo: "codigo" },
  campos: [
    { name: "codigo", label: "Código", tipo: "texto", requerido: true, max: 60, hint: 'Identificador usado por las políticas RLS, p. ej. "gestionar_equipos".' },
    { name: "descripcion", label: "Descripción", tipo: "textoLargo", max: 300 },
  ],
  columnas: [
    { id: "codigo", header: "Código", value: (f) => f.codigo as string, cell: (f) => <span className="font-mono text-xs font-semibold">{String(f.codigo)}</span> },
    { id: "descripcion", header: "Descripción", value: (f) => (f.descripcion as string) ?? "", className: "max-w-sm truncate" },
  ],
};

/* ------------------------------------------------------------------ */
/* Equipos                                                             */
/* ------------------------------------------------------------------ */

export const ENTIDAD_CATEGORIAS_EQUIPOS: EntidadAdmin = {
  slug: "categorias",
  titulo: "Categorías",
  descripcion: "Tipos de activo inventariable (Computadora, Proyector…).",
  icono: "Cpu" as unknown as LucideIcon,
  tabla: "categorias_equipos",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "equipos",
  select: "id, nombre, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "activo", label: "Activa", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Categoría", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todas" },
        { value: "activos", label: "Activas" },
        { value: "inactivas", label: "Inactivas" },
      ],
    },
  ],
};

export const ENTIDAD_MARCAS_EQUIPOS: EntidadAdmin = {
  slug: "marcas",
  titulo: "Marcas",
  descripcion: "Fabricantes de equipos. Los modelos se asocian a una marca.",
  icono: "Tag" as unknown as LucideIcon,
  tabla: "marcas_equipos",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "equipos",
  select: "id, nombre, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 120 },
    { name: "activo", label: "Activa", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Marca", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todas", label: "Todas" },
        { value: "activos", label: "Activas" },
        { value: "inactivas", label: "Inactivas" },
      ],
    },
  ],
};

export const ENTIDAD_MODELOS_EQUIPOS: EntidadAdmin = {
  slug: "modelos",
  titulo: "Modelos",
  descripcion:
    "Modelos por marca (uq marca+nombre). Un equipo puede referenciar un modelo opcionalmente.",
  icono: "Package" as unknown as LucideIcon,
  tabla: "modelos_equipos",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por modelo o marca…",
  grupo: "equipos",
  select: "id, nombre, marcas_equipos ( id, nombre )",
  orden: { campo: "marcas_equipos(nombre)" },
  campos: [
    { name: "marca_id", label: "Marca", tipo: "uuid", requerido: true, soloCreacion: false },
    { name: "nombre", label: "Nombre del modelo", tipo: "texto", requerido: true, max: 120 },
  ],
  columnas: [
    { id: "nombre", header: "Modelo", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "marca", header: "Marca", value: (f) => (f.jerarquia?.[0] ?? ""), cell: (f) => f.jerarquia?.[0] ?? "—" },
  ],
  filtros: [
    { key: "marca", label: "Marca", campo: "jerarquia", referencia: "marcas" },
  ],
};

export const ENTIDAD_ESTADOS_EQUIPOS: EntidadAdmin = {
  slug: "estados",
  titulo: "Estados",
  descripcion:
    "Ciclo de vida del activo (Operativo → Baja). Los estados finales no admiten más transiciones operativas.",
  icono: "CircleDot" as unknown as LucideIcon,
  tabla: "estados_equipos",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre…",
  grupo: "equipos",
  select: "id, nombre, es_final, activo",
  orden: { campo: "nombre" },
  campos: [
    { name: "nombre", label: "Nombre", tipo: "texto", requerido: true, max: 60 },
    { name: "es_final", label: "Estado final", tipo: "booleano", defecto: false, hint: "Baja / Fuera de servicio: el equipo ya no vuelve al flujo." },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true },
  ],
  columnas: [
    { id: "nombre", header: "Estado", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "es_final", header: "Final", value: (f) => (f.es_final ? "Sí" : "No") },
  ],
  filtros: [
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_EQUIPOS: EntidadAdmin = {
  slug: "equipos",
  titulo: "Equipos",
  descripcion:
    "Inventario de activos: código interno único, serie opcional única, categoría, modelo opcional, estado del ciclo de vida y garantía. La ubicación se gestiona en «Asignaciones».",
  icono: "Monitor" as unknown as LucideIcon,
  tabla: "equipos",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por código, serie u observaciones…",
  grupo: "equipos",
  select:
    "id, codigo_interno, numero_serie, fecha_adquisicion, garantia_hasta, observaciones, activo, categorias_equipos ( id, nombre ), modelos_equipos ( id, nombre, marcas_equipos ( id, nombre ) ), estados_equipos ( id, nombre )",
  orden: { campo: "codigo_interno" },
  campos: [
    { name: "codigo_interno", label: "Código interno", tipo: "texto", requerido: true, max: 40, hint: "Identificador único del activo (etiqueta patrimonial)." },
    { name: "numero_serie", label: "Número de serie", tipo: "texto", max: 100, hint: "Opcional; único cuando existe." },
    { name: "categoria_id", label: "Categoría", tipo: "uuid", requerido: true },
    { name: "marca_id", label: "Marca", tipo: "uuid", hint: "Solo UI: filtra la lista de modelos." },
    { name: "modelo_id", label: "Modelo", tipo: "uuid", uiFiltroPor: "marca_id", hint: "Opcional; elige primero una marca para filtrar." },
    { name: "estado_id", label: "Estado", tipo: "uuid", requerido: true, hint: "Ciclo de vida (Operativo, En mantenimiento, Baja…)." },
    { name: "fecha_adquisicion", label: "Fecha de adquisición", tipo: "fecha" },
    { name: "garantia_hasta", label: "Garantía hasta", tipo: "fecha" },
    { name: "observaciones", label: "Observaciones", tipo: "textoLargo", max: 500 },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true, hint: "Desactivar = retirado del inventario lógico (conserva historial)." },
  ],
  columnas: [
    { id: "codigo", header: "Código", value: (f) => f.codigo_interno as string, cell: (f) => <span className="font-mono text-xs font-medium">{String(f.codigo_interno)}</span> },
    { id: "serie", header: "Serie", value: (f) => (f.numero_serie as string) ?? "" },
    { id: "categoria", header: "Categoría", value: (f) => (f.jerarquia?.[0] ?? ""), cell: (f) => f.jerarquia?.[0] ?? "—" },
    { id: "modelo", header: "Modelo", value: (f) => (f.jerarquia?.[1] ?? ""), cell: (f) => f.jerarquia?.[1] ?? "—" },
    { id: "estado", header: "Estado", value: (f) => (f.jerarquia?.[2] ?? ""), cell: (f) => f.jerarquia?.[2] ?? "—" },
    { id: "garantia", header: "Garantía", value: (f) => (f.garantia_hasta as string) ?? "" },
  ],
  filtros: [
    { key: "categoria", label: "Categoría", campo: "jerarquia", referencia: "categorias" },
    { key: "estado", label: "Estado", campo: "jerarquia", referencia: "estados" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos los estados" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

export const ENTIDAD_EQUIPOS_AMBIENTES: EntidadAdmin = {
  slug: "asignaciones",
  titulo: "Asignaciones",
  claveCompuesta: ["equipo_id", "ambiente_id"],
  descripcion:
    "Equipo ↔ ambiente: la ubicación ACTUAL de cada activo. A lo sumo una asignación activa por equipo; al reasignar, la anterior se cierra y se registra el movimiento (trigger 0003).",
  icono: "Link2" as unknown as LucideIcon,
  tabla: "equipos_ambientes",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por equipo, código o ambiente…",
  grupo: "equipos",
  select:
    "equipo_id, ambiente_id, activa, asignado_en, equipos ( id, codigo_interno, numero_serie, categorias_equipos ( id, nombre ) ), ambientes ( id, nombre, codigo, pisos ( numero, nombre, pabellones ( nombre, sedes ( nombre ) ) ) )",
  orden: { campo: "equipos(codigo_interno)" },
  campos: [
    { name: "equipo_id", label: "Equipo", tipo: "uuid", requerido: true, hint: "Activo a ubicar (código interno).", soloCreacion: true },
    { name: "ambiente_id", label: "Ambiente", tipo: "uuid", requerido: true, hint: "Ubicación destino; debe existir (FK restrict).", soloCreacion: true },
    { name: "activa", label: "Asignación activa", tipo: "booleano", defecto: true, hint: "La activa define la ubicación actual del equipo." },
  ],
  columnas: [
    { id: "equipo", header: "Equipo", value: (f) => (f.equipo as string) ?? "", cell: (f) => <span className="font-mono text-xs font-medium">{(f.equipo as string) ?? "—"}</span> },
    { id: "categoria", header: "Categoría", value: (f) => (f.jerarquia?.[0] ?? ""), cell: (f) => f.jerarquia?.[0] ?? "—" },
    { id: "ambiente", header: "Ambiente", value: (f) => (f.ambiente as string) ?? "", cell: (f) => <span className="font-medium">{(f.ambiente as string) ?? "—"}</span> },
    { id: "ubicacion", header: "Ubicación", value: (f) => (f.ubicacion as string) ?? "", cell: (f) => (f.ubicacion as string) || "—" },
    { id: "asignado", header: "Desde", value: (f) => (f.asignado_en as string) ?? "", cell: (f) => (f.asignado_en ? new Date(String(f.asignado_en)).toLocaleDateString("es-PE") : "—") },
  ],
  filtros: [
    { key: "equipo", label: "Equipo", campo: "equipo", referencia: "equipos" },
    { key: "sede", label: "Sede", campo: "ubicacion", referencia: "sedes" },
    {
      key: "activa",
      label: "Situación",
      campo: "activa",
      estatico: [
        { value: "todas", label: "Todas" },
        { value: "activos", label: "Activas" },
        { value: "inactivos", label: "Cerradas" },
      ],
    },
  ],
};

export const ENTIDAD_MOVIMIENTOS_EQUIPOS: EntidadAdmin = {
  slug: "movimientos",
  titulo: "Movimientos",
  descripcion:
    "Historial de ubicaciones de los equipos (asignación, traslado, mantenimiento, baja). La fila con fecha_hasta NULL es la ubicación vigente. Append-only de facto: se consulta, no se edita.",
  icono: "History" as unknown as LucideIcon,
  tabla: "movimientos_equipos",
  tieneActivo: false,
  buscarPlaceholder: "Buscar por equipo u observaciones…",
  grupo: "equipos",
  select:
    "id, tipo_movimiento, fecha_desde, fecha_hasta, observaciones, equipos ( id, codigo_interno, categorias_equipos ( id, nombre ) ), fk_movimientos_equipos_origen ( id, nombre, codigo ), fk_movimientos_equipos_destino ( id, nombre, codigo, pisos ( numero, nombre, pabellones ( nombre, sedes ( nombre ) ) ) )",
  orden: { campo: "fecha_desde", ascendente: false },
  campos: [],
  columnas: [
    { id: "equipo", header: "Equipo", value: (f) => (f.equipo as string) ?? "", cell: (f) => <span className="font-mono text-xs font-medium">{(f.equipo as string) ?? "—"}</span> },
    { id: "tipo", header: "Tipo", value: (f) => f.tipo_movimiento as string },
    { id: "origen", header: "Origen", value: (f) => (f.origen as string) ?? "", cell: (f) => (f.origen as string) || "—" },
    { id: "destino", header: "Destino", value: (f) => (f.destino as string) ?? "", cell: (f) => <span className="font-medium">{(f.destino as string) ?? "—"}</span> },
    { id: "desde", header: "Desde", value: (f) => (f.fecha_desde as string) ?? "", cell: (f) => (f.fecha_desde ? new Date(String(f.fecha_desde)).toLocaleDateString("es-PE") : "—") },
    { id: "hasta", header: "Hasta", value: (f) => (f.fecha_hasta as string) ?? "", cell: (f) => (f.fecha_hasta ? new Date(String(f.fecha_hasta)).toLocaleDateString("es-PE") : "Vigente") },
  ],
  filtros: [
    {
      key: "tipo",
      label: "Tipo",
      campo: "tipo_movimiento",
      estatico: [
        { value: "todos", label: "Todos" },
        { value: "asignacion", label: "Asignación" },
        { value: "traslado", label: "Traslado" },
        { value: "mantenimiento", label: "Mantenimiento" },
        { value: "baja", label: "Baja" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Fase 8 · Reglas de clasificación/derivación (configurables)         */
/* ------------------------------------------------------------------ */

export const ENTIDAD_REGLAS_ENRUTAMIENTO: EntidadAdmin = {
  slug: "reglas",
  titulo: "Reglas de clasificación",
  descripcion:
    "Si tipo (+ subtipo) entonces área (+ servicio). La PRIMERA regla activa que coincide — ordenada por prioridad — clasifica la incidencia al crearse: define el área responsable, el servicio y una prioridad por defecto opcional. Una regla con subtipo específico pisa a la del tipo completo (dale un prioridad_orden menor). Desactivar una regla la saca del flujo sin borrarla.",
  icono: "Route" as unknown as LucideIcon,
  tabla: "reglas_enrutamiento",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por nombre, tipo o área destino…",
  grupo: "configuracion",
  select:
    "id, nombre, prioridad_orden, activa as activo, tipo_incidencia_id ( id, nombre ), subtipo_incidencia_id ( id, nombre ), area_destino_id ( id, nombre ), servicio_destino_id ( id, nombre ), prioridad_defecto_id ( id, nombre )",
  orden: { campo: "prioridad_orden" },
  campos: [
    { name: "nombre", label: "Nombre de la regla", tipo: "texto", requerido: true, max: 120, hint: 'Ej.: "Internet → Sistemas/Redes". Se muestra en el historial de la incidencia.' },
    {
      name: "tipo_incidencia_id",
      label: "Tipo de incidencia",
      tipo: "uuid",
      requerido: true,
      hint: "Condición SI: tipo del reporte.",
    },
    {
      name: "subtipo_incidencia_id",
      label: "Subtipo (opcional)",
      tipo: "uuid",
      uiFiltroPor: "tipo_incidencia_id",
      hint: "Condición SI refinada: subtipo del reporte (elige primero el tipo). Vacío = aplica a TODO el tipo.",
    },
    {
      name: "area_destino_id",
      label: "Entonces: área responsable",
      tipo: "uuid",
      requerido: true,
      hint: "Área que asume la incidencia (derivación inicial).",
    },
    {
      name: "servicio_destino_id",
      label: "Entonces: servicio (opcional)",
      tipo: "uuid",
      uiFiltroPor: "area_destino_id",
      hint: "Servicio del área destino (elige primero el área).",
    },
    {
      name: "prioridad_defecto_id",
      label: "Prioridad por defecto (opcional)",
      tipo: "uuid",
      hint: "Si la regla coincide, la incidencia toma esta prioridad.",
    },
    {
      name: "prioridad_orden",
      label: "Orden de evaluación",
      tipo: "entero",
      requerido: true,
      min: 1,
      maxNum: 9999,
      defecto: 100,
      hint: "Menor = se evalúa antes. Único entre reglas activas (uq_reglas_orden). Las reglas de subtipo específico van antes por diseño.",
    },
    { name: "activa", label: "Activa", tipo: "booleano", defecto: true, hint: "Solo las reglas activas participan de la clasificación automática." },
  ],
  columnas: [
    { id: "orden", header: "Orden", value: (f) => f.prioridad_orden as number },
    { id: "nombre", header: "Regla", value: (f) => f.nombre as string, cell: (f) => <span className="font-medium">{String(f.nombre)}</span> },
    { id: "condicion", header: "Si (tipo · subtipo)", value: (f) => `${((f.tipo_incidencia_id as { nombre?: string } | null)?.nombre ?? "—")} · ${((f.subtipo_incidencia_id as { nombre?: string } | null)?.nombre ?? "(todo el tipo)")}` },
    { id: "destino", header: "Entonces (área · servicio)", value: (f) => `${((f.area_destino_id as { nombre?: string } | null)?.nombre ?? "—")} · ${((f.servicio_destino_id as { nombre?: string } | null)?.nombre ?? "—")}`, cell: (f) => (
      <span>
        <span className="block font-medium">{(f.area_destino_id as { nombre?: string } | null)?.nombre ?? "—"}</span>
        <span className="block text-xs text-muted-foreground">{(f.servicio_destino_id as { nombre?: string } | null)?.nombre ?? "Sin servicio"}</span>
      </span>
    ) },
    { id: "prioridad", header: "Prioridad def.", value: (f) => (f.prioridad_defecto_id as { nombre?: string } | null)?.nombre ?? "" },
  ],
  filtros: [
    { key: "tipo", label: "Tipo", campo: "condicion", referencia: "tipos_incidencia" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos" },
        { value: "activos", label: "Activas" },
        { value: "inactivos", label: "Inactivas" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Fase 8b · SLA — acuerdos de nivel de servicio (configurables)        */
/* ------------------------------------------------------------------ */

export const ENTIDAD_ACUERDOS_SLA: EntidadAdmin = {
  slug: "sla",
  titulo: "Acuerdos SLA",
  descripcion:
    "Objetivos de respuesta y resolución por prioridad (y opcionalmente por tipo de incidencia). La especialización por tipo PISA al acuerdo base de la prioridad. Los tiempos aquí definidos son configurables y NO constituyen una política oficial de la UPSJB hasta su validación institucional. El cálculo de horas HÁBILES (feriados/turnos) queda pendiente: hoy el cómputo es en horas corridas.",
  icono: "Timer" as unknown as LucideIcon,
  tabla: "acuerdos_nivel_servicio",
  tieneActivo: true,
  buscarPlaceholder: "Buscar por prioridad o tipo…",
  grupo: "configuracion",
  select:
    "id, horas_respuesta, horas_resolucion, activo, prioridad_id ( id, nombre ), tipo_incidencia_id ( id, nombre )",
  orden: { campo: "prioridad_id", ascendente: false },
  campos: [
    {
      name: "prioridad_id",
      label: "Prioridad",
      tipo: "uuid",
      requerido: true,
      hint: "Nivel de prioridad al que aplica el acuerdo (Baja…Crítica).",
    },
    {
      name: "tipo_incidencia_id",
      label: "Tipo de incidencia (opcional)",
      tipo: "uuid",
      hint: "Vacío = SLA base de la prioridad. Con tipo, el acuerdo especializado reemplaza al base para ese tipo. Solo puede existir UN acuerdo base activo por prioridad (uq_sla_prioridad).",
    },
    {
      name: "horas_respuesta",
      label: "Horas para responder",
      tipo: "decimal",
      requerido: true,
      min: 0.1,
      maxNum: 9999,
      hint: "Reporte → inicio de atención (aceptar). Ej.: 24 o 0.5 (media hora).",
    },
    {
      name: "horas_resolucion",
      label: "Horas para resolver",
      tipo: "decimal",
      requerido: true,
      min: 0.1,
      maxNum: 9999,
      hint: "Reporte → resolución. Debe ser coherente con la respuesta.",
    },
    { name: "activo", label: "Activo", tipo: "booleano", defecto: true, hint: "Solo los acuerdos activos se aplican a nuevas incidencias (el snapshot de las existentes no cambia)." },
  ],
  columnas: [
    { id: "prioridad", header: "Prioridad", value: (f) => ((f.prioridad_id as { nombre?: string } | null)?.nombre ?? ""), cell: (f) => (
      <span className="font-medium">{(f.prioridad_id as { nombre?: string } | null)?.nombre ?? "—"}</span>
    ) },
    { id: "tipo", header: "Tipo (especialización)", value: (f) => ((f.tipo_incidencia_id as { nombre?: string } | null)?.nombre ?? ""), cell: (f) =>
      ((f.tipo_incidencia_id as { nombre?: string } | null)?.nombre ?? "Base (todos los tipos)")
    },
    { id: "horas_respuesta", header: "Respuesta", value: (f) => Number(f.horas_respuesta ?? 0), cell: (f) => <span className="tabular-nums">{String(f.horas_respuesta)} h</span> },
    { id: "horas_resolucion", header: "Resolución", value: (f) => Number(f.horas_resolucion ?? 0), cell: (f) => <span className="tabular-nums">{String(f.horas_resolucion)} h</span> },
  ],
  filtros: [
    { key: "prioridad", label: "Prioridad", campo: "prioridad", referencia: "prioridades" },
    {
      key: "activo",
      label: "Estado",
      campo: "activo",
      estatico: [
        { value: "todos", label: "Todos" },
        { value: "activos", label: "Activos" },
        { value: "inactivos", label: "Inactivos" },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Registro administrable completo                                     */
/* ------------------------------------------------------------------ */

export const ENTIDADES_ADMIN: Record<string, EntidadAdmin> = {
  sedes: ENTIDAD_SEDES,
  pabellones: ENTIDAD_PABELLONES,
  pisos: ENTIDAD_PISOS,
  "tipos-ambiente": ENTIDAD_TIPOS_AMBIENTE,
  ambientes: ENTIDAD_AMBIENTES,
  aulas: ENTIDAD_AULAS,
  laboratorios: ENTIDAD_LABORATORIOS,
  caracteristicas: ENTIDAD_CARACTERISTICAS,
  areas: ENTIDAD_AREAS,
  servicios: ENTIDAD_SERVICIOS,
  especialidades: ENTIDAD_ESPECIALIDADES,
  tecnicos: ENTIDAD_TECNICOS,
  roles: ENTIDAD_ROLES,
  permisos: ENTIDAD_PERMISOS,
  categorias: ENTIDAD_CATEGORIAS_EQUIPOS,
  marcas: ENTIDAD_MARCAS_EQUIPOS,
  modelos: ENTIDAD_MODELOS_EQUIPOS,
  estados: ENTIDAD_ESTADOS_EQUIPOS,
  equipos: ENTIDAD_EQUIPOS,
  asignaciones: ENTIDAD_EQUIPOS_AMBIENTES,
  movimientos: ENTIDAD_MOVIMIENTOS_EQUIPOS,
  reglas: ENTIDAD_REGLAS_ENRUTAMIENTO,
  sla: ENTIDAD_ACUERDOS_SLA,
};

/** Grupo → entidades que lo componen (pestañas de las secciones). */
export const GRUPOS_ADMIN: Record<
  NonNullable<EntidadAdmin["grupo"]>,
  { titulo: string; descripcion: string; entidades: string[] }
> = {
  infraestructura: {
    titulo: "Infraestructura",
    descripcion:
      "Jerarquía física del campus: sedes → pabellones → pisos → tipos → ambientes, con detalle de aulas, laboratorios y características.",
    entidades: [
      "sedes",
      "pabellones",
      "pisos",
      "tipos-ambiente",
      "ambientes",
      "aulas",
      "laboratorios",
      "caracteristicas",
    ],
  },
  organizacion: {
    titulo: "Organización",
    descripcion:
      "Áreas responsables, sus servicios, las especialidades de los técnicos y las fichas operativas de los técnicos.",
    entidades: ["areas", "servicios", "especialidades", "tecnicos"],
  },
  equipos: {
    titulo: "Equipos",
    descripcion:
      "Inventario: catálogos (categorías, marcas, modelos, estados), equipos, su ubicación por ambiente y el historial de movimientos.",
    entidades: ["categorias", "marcas", "modelos", "estados", "equipos", "asignaciones", "movimientos"],
  },
  usuarios: { titulo: "Usuarios", descripcion: "", entidades: [] },
  seguridad: {
    titulo: "Roles y permisos",
    descripcion: "Roles del sistema y su matriz de permisos efectivos.",
    entidades: ["roles", "permisos"],
  },
  qr: { titulo: "Códigos QR", descripcion: "", entidades: [] },
  configuracion: {
    titulo: "Configuración",
    descripcion:
      "Reglas de clasificación y derivación: SI tipo (+subtipo) ENTONCES área (+ servicio). Acuerdos SLA por prioridad/tipo. Configurables por el administrador; su aplicación queda registrada en la auditoría.",
    entidades: ["reglas", "sla"],
  },
};

/** Busca una entidad por slug (fuente de las páginas /admin/*). */
export function entidadPorSlug(slug: string): EntidadAdmin | null {
  return ENTIDADES_ADMIN[slug] ?? null;
}
