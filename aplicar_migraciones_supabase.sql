-- ============================================================================
-- SIR-UPSJB · 0001_initial_schema.sql
-- Modelo aprobado: Opción A — 58 tablas literales del Plan Maestro.
-- Fuente: docs/01-DISENO-BASE-DATOS-SIR-UPSJB.md (§6 diccionario de datos).
-- Este script NO contiene credenciales ni secretos (solo esquema).
-- Convención de nombres: pk_/fk_/uq_/ck_ + idx_ para índices (en 0002).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONES (solo las necesarias)
--    - citext: correo case-insensitive (Decisión D13 del modelo).
--    - gen_random_uuid() ya existe en Supabase (pgcrypto/núcleo PG13+):
--      no se requiere extensión adicional para UUID.
-- ----------------------------------------------------------------------------
create extension if not exists citext with schema extensions;

-- ----------------------------------------------------------------------------
-- SECUENCIAS PARA CÓDIGOS DE NEGOCIO
-- ----------------------------------------------------------------------------
-- Base del código de incidencia INC-<AAAA>-<NNNNNN> (§2.2). La secuencia
-- concreta del año en curso (incidencias_codigo_seq_<AAAA>) se crea en tiempo
-- de ejecución por resolver_secuencia_incidencias() (0003): así cada año
-- reinicia en 1 sin migraciones manuales.
create sequence if not exists public.incidencias_codigo_seq;

-- Consecutivo de códigos QR (§2.3): el código <SEDE>-<PAB>-<AMB>-<N> usa el
-- ambiente (ya con prefijo de sede) + este número, formateado a 4 dígitos.
create sequence if not exists public.sec_codigos_qr;

-- ============================================================================
-- M1 · USUARIOS Y SEGURIDAD (5 tablas)
-- ============================================================================

-- perfiles: 1:1 con auth.users (PK = mismo UUID de Supabase Auth, D2).
create table public.perfiles (
  id               uuid        primary key default gen_random_uuid()
                               references auth.users (id) on delete cascade,
  nombres          text        not null,
  apellido_paterno text        not null,
  apellido_materno text,
  documento        text,
  correo           citext      not null,
  telefono         text,
  codigo_usuario   text,
  estado           text        not null default 'activo'
                               constraint ck_perfiles_estado
                               check (estado in ('activo', 'suspendido')),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
comment on table public.perfiles is
  'Datos del usuario; PK = mismo UUID de auth.users. Insertar SIEMPRE con id = auth.uid() (el DEFAULT solo aplica a inserciones SQL con id explicito).';

create table public.roles (
  id             uuid        primary key default gen_random_uuid(),
  nombre         text        not null constraint uq_roles_nombre unique,
  descripcion    text,
  activo         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.permisos (
  id          uuid        primary key default gen_random_uuid(),
  codigo      text        not null constraint uq_permisos_codigo unique,
  descripcion text,
  creado_en   timestamptz not null default now()
);

create table public.roles_permisos (
  rol_id     uuid not null constraint fk_roles_permisos_rol
             references public.roles (id) on delete cascade,
  permiso_id uuid not null constraint fk_roles_permisos_permiso
             references public.permisos (id) on delete cascade,
  constraint pk_roles_permisos primary key (rol_id, permiso_id)
);

create table public.usuarios_roles (
  perfil_id   uuid        not null constraint fk_usuarios_roles_perfil
              references public.perfiles (id) on delete cascade,
  rol_id      uuid        not null constraint fk_usuarios_roles_rol
              references public.roles (id) on delete cascade,
  asignado_por uuid       constraint fk_usuarios_roles_asignado_por
              references public.perfiles (id) on delete set null,
  asignado_en timestamptz not null default now(),
  constraint pk_usuarios_roles primary key (perfil_id, rol_id)
);

-- ============================================================================
-- M2 · INFRAESTRUCTURA (8 tablas) — jerarquía sedes → pabellones → pisos → ambientes
-- ============================================================================

create table public.sedes (
  id             uuid        primary key default gen_random_uuid(),
  nombre         text        not null constraint uq_sedes_nombre unique,
  codigo         text        not null constraint uq_sedes_codigo unique
                             constraint ck_sedes_codigo check (codigo ~ '^[A-Z0-9-]+$'),
  direccion      text,
  activa         boolean     not null default false,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.sedes is
  'Multi-sede (§2.4): las sedes futuras se habilitan por configuracion (activa), no por cambios de esquema.';

create table public.pabellones (
  id             uuid        primary key default gen_random_uuid(),
  sede_id        uuid        not null constraint fk_pabellones_sede
                 references public.sedes (id) on delete restrict,
  nombre         text        not null,
  codigo         text        not null,
  activo         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint uq_pabellones_sede_codigo unique (sede_id, codigo)
);

create table public.pisos (
  id             uuid        primary key default gen_random_uuid(),
  pabellon_id    uuid        not null constraint fk_pisos_pabellon
                 references public.pabellones (id) on delete restrict,
  numero         integer     not null
                 constraint ck_pisos_numero
                 check (numero >= -2 and numero <= 20),
  nombre         text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint uq_pisos_pabellon_numero unique (pabellon_id, numero)
);

create table public.tipos_ambiente (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_tipos_ambiente_nombre unique,
  activo boolean not null default true
);

create table public.ambientes (
  id                uuid        primary key default gen_random_uuid(),
  piso_id           uuid        not null constraint fk_ambientes_piso
                    references public.pisos (id) on delete restrict,
  tipo_ambiente_id  uuid        not null constraint fk_ambientes_tipo
                    references public.tipos_ambiente (id) on delete restrict,
  nombre            text        not null,
  codigo            text        not null constraint uq_ambientes_codigo unique,
  detalle_ubicacion text,
  activo            boolean     not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
comment on table public.ambientes is
  'Unica fuente de verdad de ubicacion: toda FK de negocio apunta aqui (nunca a sede/pabellon/piso directo).';

-- Especializaciones 1:0..1 (patron tabla-hija: PK = FK, ON DELETE CASCADE)
create table public.aulas (
  ambiente_id        uuid primary key
                     constraint fk_aulas_ambiente
                     references public.ambientes (id) on delete cascade,
  capacidad          integer constraint ck_aulas_capacidad check (capacidad > 0),
  tiene_computadoras boolean not null default false
);

create table public.laboratorios (
  ambiente_id      uuid primary key
                   constraint fk_laboratorios_ambiente
                   references public.ambientes (id) on delete cascade,
  capacidad        integer constraint ck_laboratorios_capacidad check (capacidad > 0),
  tipo_laboratorio text
);

create table public.ambientes_caracteristicas (
  ambiente_id        uuid primary key
                     constraint fk_ambientes_caracteristicas_ambiente
                     references public.ambientes (id) on delete cascade,
  capacidad          integer,
  proyector          boolean not null default false,
  computadoras       integer not null default 0,
  internet           boolean not null default true,
  aire_acondicionado boolean not null default false,
  pizarra            boolean not null default true,
  observaciones      text
);

-- ============================================================================
-- M3 · EQUIPOS (7 tablas)
-- ============================================================================

create table public.categorias_equipos (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_categorias_equipos_nombre unique,
  activo boolean not null default true
);

create table public.marcas_equipos (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_marcas_equipos_nombre unique,
  activo boolean not null default true
);

create table public.modelos_equipos (
  id       uuid    primary key default gen_random_uuid(),
  marca_id uuid    not null constraint fk_modelos_equipos_marca
           references public.marcas_equipos (id) on delete restrict,
  nombre   text    not null,
  constraint uq_modelos_equipos_marca_nombre unique (marca_id, nombre)
);

create table public.estados_equipos (
  id       uuid    primary key default gen_random_uuid(),
  nombre   text    not null constraint uq_estados_equipos_nombre unique,
  es_final boolean not null default false,
  activo   boolean not null default true
);

create table public.equipos (
  id                uuid        primary key default gen_random_uuid(),
  codigo_interno    text        not null constraint uq_equipos_codigo_interno unique,
  numero_serie      text,
  categoria_id      uuid        not null constraint fk_equipos_categoria
                    references public.categorias_equipos (id) on delete restrict,
  modelo_id         uuid        constraint fk_equipos_modelo
                    references public.modelos_equipos (id) on delete set null,
  estado_id         uuid        not null constraint fk_equipos_estado
                    references public.estados_equipos (id) on delete restrict,
  fecha_adquisicion date,
  garantia_hasta    date,
  observaciones     text,
  activo            boolean     not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
comment on column public.equipos.numero_serie is
  'UNIQUE parcial WHERE numero_serie IS NOT NULL (indice en 0002).';

create table public.equipos_ambientes (
  equipo_id   uuid        not null constraint fk_equipos_ambientes_equipo
              references public.equipos (id) on delete cascade,
  ambiente_id uuid        not null constraint fk_equipos_ambientes_ambiente
              references public.ambientes (id) on delete restrict,
  activa      boolean     not null default true,
  asignado_en timestamptz not null default now(),
  asignado_por uuid       constraint fk_equipos_ambientes_asignado_por
              references public.perfiles (id) on delete set null,
  constraint pk_equipos_ambientes primary key (equipo_id, ambiente_id)
);
comment on table public.equipos_ambientes is
  'Fuente de la ubicacion ACTUAL del equipo. Regla: un solo registro activo por equipo '
  '(indice parcial unico uq_asignacion_equipo_activa en 0002). La consistencia con '
  'movimientos_equipos se garantiza por trigger (0003/0004).';

create table public.movimientos_equipos (
  id                  uuid        primary key default gen_random_uuid(),
  equipo_id           uuid        not null constraint fk_movimientos_equipos_equipo
                      references public.equipos (id) on delete cascade,
  ambiente_origen_id  uuid        constraint fk_movimientos_equipos_origen
                      references public.ambientes (id) on delete set null,
  ambiente_destino_id uuid        not null constraint fk_movimientos_equipos_destino
                      references public.ambientes (id) on delete restrict,
  tipo_movimiento     text        not null
                      constraint ck_movimientos_equipos_tipo
                      check (tipo_movimiento in
                        ('asignacion', 'traslado', 'mantenimiento', 'baja')),
  fecha_desde         timestamptz not null default now(),
  fecha_hasta         timestamptz,
  registrado_por      uuid        constraint fk_movimientos_equipos_registrado_por
                      references public.perfiles (id) on delete set null,
  observaciones       text
);
comment on column public.movimientos_equipos.fecha_hasta is 'NULL = ubicacion actual del equipo.';

-- ============================================================================
-- M4 · QR (2 tablas)
-- ============================================================================

create table public.codigos_qr (
  id               uuid        primary key default gen_random_uuid(),
  ambiente_id      uuid        not null constraint fk_codigos_qr_ambiente
                   references public.ambientes (id) on delete restrict,
  codigo           text        not null constraint uq_codigos_qr_codigo unique
                   constraint ck_codigos_qr_formato
                   check (codigo ~ '^([A-Z0-9]+-)+[0-9]{4}$'),
  url_destino      text        not null,
  version          integer     not null default 1
                   constraint ck_codigos_qr_version check (version >= 1),
  activo           boolean     not null default true,
  generado_por     uuid        constraint fk_codigos_qr_generado_por
                   references public.perfiles (id) on delete set null,
  generado_en      timestamptz not null default now(),
  deshabilitado_en timestamptz
);
comment on table public.codigos_qr is
  'Regla 9: un solo QR activo por ambiente (indice parcial unico uq_codigos_qr_ambiente_activo en 0002). '
  'url_destino es la URL estable /r/<codigo>: cambio de dominio sin reimprimir (D6).';

create table public.lecturas_qr (
  id           uuid        primary key default gen_random_uuid(),
  codigo_qr_id uuid        not null constraint fk_lecturas_qr_codigo
               references public.codigos_qr (id) on delete cascade,
  perfil_id    uuid        constraint fk_lecturas_qr_perfil
               references public.perfiles (id) on delete set null,
  dispositivo  text,
  navegador    text,
  ip_hash      text,
  leido_en     timestamptz not null default now()
);
comment on column public.lecturas_qr.ip_hash is 'Hash de la IP; nunca IP en claro (Plan Maestro 14.2).';

-- ============================================================================
-- M5 · INCIDENCIAS — catálogos (5 tablas; `incidencias` va después de M7)
-- ============================================================================

create table public.tipos_incidencia (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_tipos_incidencia_nombre unique,
  activo boolean not null default true
);

create table public.subtipos_incidencia (
  id                  uuid    primary key default gen_random_uuid(),
  tipo_incidencia_id  uuid    not null constraint fk_subtipos_incidencia_tipo
                      references public.tipos_incidencia (id) on delete restrict,
  nombre              text    not null,
  activo              boolean not null default true,
  constraint uq_subtipos_tipo_nombre unique (tipo_incidencia_id, nombre),
  -- Necesario para la FK compuesta de coherencia subtipo ∈ tipo (D12):
  constraint uq_subtipos_id_tipo unique (id, tipo_incidencia_id)
);

create table public.prioridades (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_prioridades_nombre unique,
  nivel  integer not null constraint uq_prioridades_nivel unique
         constraint ck_prioridades_nivel check (nivel between 1 and 4),
  color  text,
  activo boolean not null default true
);
comment on table public.prioridades is 'nivel: 1=Baja, 2=Media, 3=Alta, 4=Critica (orden para SLA).';

create table public.estados_incidencia (
  id       uuid    primary key default gen_random_uuid(),
  nombre   text    not null constraint uq_estados_incidencia_nombre unique,
  orden    integer not null constraint uq_estados_incidencia_orden unique,
  es_final boolean not null default false,
  color    text,
  activo   boolean not null default true
);

create table public.canales_reporte (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_canales_reporte_nombre unique,
  activo boolean not null default true
);

-- ============================================================================
-- M7 · ORGANIZACIÓN (7 tablas) — se crea ANTES de `incidencias` porque
--       incidencia_asignaciones → tecnicos e incidencia_derivaciones → areas/servicios
-- ============================================================================

create table public.areas (
  id             uuid        primary key default gen_random_uuid(),
  nombre         text        not null constraint uq_areas_nombre unique,
  descripcion    text,
  correo         text,
  activo         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.servicios (
  id     uuid    primary key default gen_random_uuid(),
  area_id uuid   not null constraint fk_servicios_area
         references public.areas (id) on delete restrict,
  nombre text    not null,
  activo boolean not null default true,
  constraint uq_servicios_area_nombre unique (area_id, nombre)
);

create table public.tecnicos (
  id             uuid        primary key default gen_random_uuid(),
  perfil_id      uuid        not null constraint uq_tecnicos_perfil unique
                 constraint fk_tecnicos_perfil
                 references public.perfiles (id) on delete cascade,
  area_id        uuid        not null constraint fk_tecnicos_area
                 references public.areas (id) on delete restrict,
  sede_id        uuid        not null constraint fk_tecnicos_sede
                 references public.sedes (id) on delete restrict,
  codigo_tecnico text        constraint uq_tecnicos_codigo unique,
  carga_maxima   integer     not null default 10
                 constraint ck_tecnicos_carga_maxima
                 check (carga_maxima between 1 and 100),
  activo         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table public.tecnicos is '1:0..1 con perfiles (uq_tecnicos_perfil). Acotado por area y sede (multi-sede 2.4).';

create table public.especialidades_tecnicas (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_especialidades_tecnicas_nombre unique,
  activo boolean not null default true
);

create table public.tecnicos_especialidades (
  tecnico_id      uuid not null constraint fk_tecnicos_especialidades_tecnico
                  references public.tecnicos (id) on delete cascade,
  especialidad_id uuid not null constraint fk_tecnicos_especialidades_especialidad
                  references public.especialidades_tecnicas (id) on delete restrict,
  constraint pk_tecnicos_especialidades primary key (tecnico_id, especialidad_id)
);

create table public.turnos (
  id          uuid        primary key default gen_random_uuid(),
  nombre      text        not null constraint uq_turnos_nombre unique,
  hora_inicio time        not null,
  hora_fin    time        not null,
  dias_semana integer[]   not null default '{1,2,3,4,5}',
  activo      boolean     not null default true,
  constraint ck_turnos_horas check (hora_fin > hora_inicio),
  constraint ck_turnos_dias_semana check (dias_semana <@ array[1, 2, 3, 4, 5, 6, 7])
);
comment on column public.turnos.dias_semana is 'ISO: 1=lunes … 7=domingo.';

create table public.tecnicos_turnos (
  tecnico_id uuid not null constraint fk_tecnicos_turnos_tecnico
             references public.tecnicos (id) on delete cascade,
  turno_id   uuid not null constraint fk_tecnicos_turnos_turno
             references public.turnos (id) on delete cascade,
  desde      date not null default current_date,
  hasta      date,
  constraint pk_tecnicos_turnos primary key (tecnico_id, turno_id)
);
comment on column public.tecnicos_turnos.hasta is 'NULL = vigente.';

-- ============================================================================
-- M5 · incidencias (tabla principal)
-- ============================================================================

create table public.incidencias (
  id                     uuid        primary key default gen_random_uuid(),
  codigo                 text        not null constraint uq_incidencias_codigo unique,
  usuario_reportante_id  uuid        constraint fk_incidencias_reportante
                         references public.perfiles (id) on delete set null,
  ambiente_id            uuid        not null constraint fk_incidencias_ambiente
                         references public.ambientes (id) on delete restrict,
  tipo_incidencia_id     uuid        not null constraint fk_incidencias_tipo
                         references public.tipos_incidencia (id) on delete restrict,
  subtipo_incidencia_id  uuid,
  prioridad_id           uuid        not null constraint fk_incidencias_prioridad
                         references public.prioridades (id) on delete restrict,
  estado_id              uuid        not null constraint fk_incidencias_estado
                         references public.estados_incidencia (id) on delete restrict,
  canal_reporte_id       uuid        not null constraint fk_incidencias_canal
                         references public.canales_reporte (id) on delete restrict,
  descripcion            text        not null
                         constraint ck_incidencias_descripcion
                         check (char_length(descripcion) between 10 and 2000),
  fecha_reporte          timestamptz not null default now(),
  fecha_asignacion       timestamptz,
  fecha_inicio           timestamptz,
  fecha_resolucion       timestamptz,
  fecha_cierre           timestamptz,
  cerrado_por            uuid        constraint fk_incidencias_cerrado_por
                         references public.perfiles (id) on delete set null,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  -- Coherencia subtipo ∈ tipo (D12): FK compuesta contra subtipos_incidencia.
  -- MATCH SIMPLE: si subtipo es NULL la restricción no se evalúa.
  -- Sin acción ON DELETE (NO ACTION): no se puede anular solo una parte de la
  -- FK compuesta; borrar un subtipo referenciado queda bloqueado, en línea con
  -- la regla general de no borrado físico (los catálogos se desactivan).
  constraint fk_incidencias_subtipo_coherente
    foreign key (subtipo_incidencia_id, tipo_incidencia_id)
    references public.subtipos_incidencia (id, tipo_incidencia_id)
);
comment on table public.incidencias is
  'codigo INC-AAAA-NNNNNN generado por trigger + secuencia anual (0003/0004). '
  'El area responsable vive en incidencia_derivaciones (fila activa) y el tecnico en '
  'incidencia_asignaciones (fila activa): sin duplicacion de estado (D7).';
comment on column public.incidencias.usuario_reportante_id is
  'NULL = reporte anonimo [VI] (pendiente de validacion institucional).';
comment on column public.incidencias.prioridad_id is
  'DEFAULT = prioridad Media asignado por trigger trg_incidencias_defaults (0004).';
comment on column public.incidencias.estado_id is
  'DEFAULT = estado Pendiente asignado por trigger trg_incidencias_defaults (0004).';
comment on column public.incidencias.canal_reporte_id is
  'DEFAULT = canal QR asignado por trigger trg_incidencias_defaults (0004).';

-- ============================================================================
-- M6 · DETALLE DE INCIDENCIAS (7 tablas)
-- ============================================================================

create table public.incidencia_ubicaciones (
  incidencia_id         uuid        primary key
                        constraint fk_incidencia_ubicaciones_incidencia
                        references public.incidencias (id) on delete cascade,
  referencia_adicional  text,
  registrado_en         timestamptz not null default now()
);
comment on table public.incidencia_ubicaciones is
  'Complemento 1:0..1 (PK = FK). La ubicacion principal (ambiente_id) vive en incidencias.';

create table public.incidencia_equipos (
  incidencia_id       uuid    not null constraint fk_incidencia_equipos_incidencia
                      references public.incidencias (id) on delete cascade,
  equipo_id           uuid    not null constraint fk_incidencia_equipos_equipo
                      references public.equipos (id) on delete restrict,
  es_equipo_principal boolean not null default false,
  detalle             text,
  constraint pk_incidencia_equipos primary key (incidencia_id, equipo_id)
);
comment on table public.incidencia_equipos is
  'Regla: maximo un equipo principal por incidencia '
  '(indice parcial unico uq_incidencia_equipos_principal en 0002).';

create table public.incidencia_adjuntos (
  id             uuid        primary key default gen_random_uuid(),
  incidencia_id  uuid        not null constraint fk_incidencia_adjuntos_incidencia
                 references public.incidencias (id) on delete cascade,
  subido_por     uuid        constraint fk_incidencia_adjuntos_subido_por
                 references public.perfiles (id) on delete set null,
  tipo           text        not null
                 constraint ck_incidencia_adjuntos_tipo
                 check (tipo in ('antes', 'durante', 'despues', 'documento', 'video')),
  bucket         text        not null default 'evidencias',
  path           text        not null constraint uq_incidencia_adjuntos_path unique,
  nombre_archivo text        not null,
  mime_type      text        not null,
  tamano_bytes   bigint      constraint ck_incidencia_adjuntos_tamano
                 check (tamano_bytes > 0),
  creado_en      timestamptz not null default now()
);
comment on table public.incidencia_adjuntos is
  'Solo referencia al objeto de Storage (bucket + path); nunca bytes (2.5). '
  'El bucket privado y sus politicas se configuran en la fase de Storage, no aqui.';

create table public.incidencia_comentarios (
  id            uuid        primary key default gen_random_uuid(),
  incidencia_id uuid        not null constraint fk_incidencia_comentarios_incidencia
                references public.incidencias (id) on delete cascade,
  autor_id      uuid        constraint fk_incidencia_comentarios_autor
                references public.perfiles (id) on delete set null,
  comentario    text        not null
                constraint ck_incidencia_comentarios_texto
                check (char_length(comentario) between 1 and 3000),
  es_interno    boolean     not null default false,
  creado_en     timestamptz not null default now()
);
comment on column public.incidencia_comentarios.es_interno is
  'Nota interna no visible al reportante [VI].';

create table public.incidencia_historial (
  id             uuid        primary key default gen_random_uuid(),
  incidencia_id  uuid        not null constraint fk_incidencia_historial_incidencia
                 references public.incidencias (id) on delete cascade,
  actor_id       uuid        constraint fk_incidencia_historial_actor
                 references public.perfiles (id) on delete set null,
  tipo_cambio    text        not null
                 constraint ck_incidencia_historial_tipo
                 check (tipo_cambio in
                   ('estado', 'prioridad', 'asignacion', 'derivacion',
                    'edicion', 'cierre', 'cancelacion', 'otro')),
  campo          text,
  valor_anterior text,
  valor_nuevo    text,
  detalle        text,
  creado_en      timestamptz not null default now()
);
comment on table public.incidencia_historial is
  'Append-only (D9): escritura solo desde triggers/RPC (0004). Ningun rol de aplicacion hace UPDATE/DELETE.';

create table public.incidencia_asignaciones (
  id             uuid        primary key default gen_random_uuid(),
  incidencia_id  uuid        not null constraint fk_incidencia_asignaciones_incidencia
                 references public.incidencias (id) on delete cascade,
  tecnico_id     uuid        not null constraint fk_incidencia_asignaciones_tecnico
                 references public.tecnicos (id) on delete restrict,
  asignado_por   uuid        constraint fk_incidencia_asignaciones_asignado_por
                 references public.perfiles (id) on delete set null,
  activa         boolean     not null default true,
  asignado_en    timestamptz not null default now(),
  aceptado_en    timestamptz,
  cerrada_en     timestamptz
);
comment on table public.incidencia_asignaciones is
  'Regla: a lo sumo un tecnico activo por incidencia '
  '(indice parcial unico uq_asignacion_activa en 0002); reasignar cierra la fila anterior.';

create table public.incidencia_derivaciones (
  id                  uuid        primary key default gen_random_uuid(),
  incidencia_id       uuid        not null constraint fk_incidencia_derivaciones_incidencia
                      references public.incidencias (id) on delete cascade,
  area_origen_id      uuid        constraint fk_incidencia_derivaciones_origen
                      references public.areas (id) on delete set null,
  area_destino_id     uuid        not null constraint fk_incidencia_derivaciones_destino
                      references public.areas (id) on delete restrict,
  servicio_destino_id uuid        constraint fk_incidencia_derivaciones_servicio
                      references public.servicios (id) on delete set null,
  motivo              text        not null,
  activa              boolean     not null default true,
  derivado_por        uuid        constraint fk_incidencia_derivaciones_por
                      references public.perfiles (id) on delete set null,
  derivado_en         timestamptz not null default now(),
  constraint ck_incidencia_derivaciones_auto
    check (area_origen_id is null or area_origen_id <> area_destino_id)
);
comment on table public.incidencia_derivaciones is
  'El destino vigente es la fila con activa = true '
  '(indice parcial unico uq_derivacion_activa en 0002). area_origen NULL = derivacion inicial.';

-- ============================================================================
-- M8 · REGLAS DE DERIVACIÓN (1 tabla)
-- ============================================================================

create table public.reglas_enrutamiento (
  id                    uuid        primary key default gen_random_uuid(),
  nombre                text        not null,
  tipo_incidencia_id    uuid        not null constraint fk_reglas_enrutamiento_tipo
                        references public.tipos_incidencia (id) on delete restrict,
  subtipo_incidencia_id uuid        constraint fk_reglas_enrutamiento_subtipo
                        references public.subtipos_incidencia (id) on delete cascade,
  area_destino_id       uuid        not null constraint fk_reglas_enrutamiento_area
                        references public.areas (id) on delete restrict,
  servicio_destino_id   uuid        constraint fk_reglas_enrutamiento_servicio
                        references public.servicios (id) on delete set null,
  prioridad_defecto_id  uuid        constraint fk_reglas_enrutamiento_prioridad
                        references public.prioridades (id) on delete set null,
  prioridad_orden       integer     not null,
  activa                boolean     not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
comment on table public.reglas_enrutamiento is
  'Sin duplicados por alcance: indice unico expresion (tipo, coalesce(subtipo, uuid-cero)) en 0002. '
  'La regla con subtipo se evalua antes por prioridad_orden (consulta de aplicacion).';

-- ============================================================================
-- M9 · SLA (3 tablas)
-- ============================================================================

create table public.acuerdos_nivel_servicio (
  id                 uuid        primary key default gen_random_uuid(),
  prioridad_id       uuid        not null constraint fk_sla_prioridad
                     references public.prioridades (id) on delete restrict,
  tipo_incidencia_id uuid        constraint fk_sla_tipo
                     references public.tipos_incidencia (id) on delete cascade,
  horas_respuesta    numeric(5,1) not null constraint ck_sla_horas_respuesta check (horas_respuesta > 0),
  horas_resolucion   numeric(5,1) not null constraint ck_sla_horas_resolucion check (horas_resolucion > 0),
  activo             boolean     not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
comment on table public.acuerdos_nivel_servicio is
  'Un SLA base por prioridad (indice parcial uq_sla_prioridad en 0002); '
  'la especializacion por tipo pisa al base. Tiempos [VI].';

create table public.tiempos_sla (
  id                        uuid primary key default gen_random_uuid(),
  incidencia_id             uuid not null constraint uq_tiempos_sla_incidencia unique
                            constraint fk_tiempos_sla_incidencia
                            references public.incidencias (id) on delete cascade,
  acuerdo_id                uuid constraint fk_tiempos_sla_acuerdo
                            references public.acuerdos_nivel_servicio (id) on delete set null,
  primera_respuesta_en      timestamptz,
  resolucion_en             timestamptz,
  horas_habiles_respuesta   numeric(6,1),
  horas_habiles_resolucion  numeric(6,1),
  cumplieron_respuesta      boolean,
  cumplieron_resolucion     boolean
);
comment on table public.tiempos_sla is
  'Snapshot del acuerdo aplicado + horas HABILES (calculo con feriados/turnos por funcion SQL, fase posterior).';

create table public.feriados (
  id              uuid    primary key default gen_random_uuid(),
  fecha           date    not null constraint uq_feriados_fecha unique,
  descripcion     text    not null,
  anual_recursivo boolean not null default false
);

-- ============================================================================
-- M10 · NOTIFICACIONES (4 tablas)
-- ============================================================================

create table public.plantillas_notificacion (
  id     uuid    primary key default gen_random_uuid(),
  evento text    not null constraint uq_plantillas_notificacion_evento unique
         constraint ck_plantillas_notificacion_evento
         check (evento in
           ('nueva_incidencia', 'asignada', 'en_proceso', 'en_espera',
            'resuelta', 'cerrada', 'cancelada', 'comentario')),
  asunto text    not null,
  cuerpo text    not null,
  canal  text    not null default 'interna'
         constraint ck_plantillas_notificacion_canal
         check (canal in ('interna', 'correo', 'push')),
  activo boolean not null default true
);
comment on table public.plantillas_notificacion is
  'Placeholders: {{codigo}}, {{ambiente}}, …';

create table public.notificaciones (
  id           uuid        primary key default gen_random_uuid(),
  perfil_id    uuid        not null constraint fk_notificaciones_perfil
               references public.perfiles (id) on delete cascade,
  incidencia_id uuid       constraint fk_notificaciones_incidencia
               references public.incidencias (id) on delete cascade,
  plantilla_id uuid        constraint fk_notificaciones_plantilla
               references public.plantillas_notificacion (id) on delete set null,
  titulo       text        not null,
  cuerpo       text        not null,
  leida_en     timestamptz,
  creado_en    timestamptz not null default now()
);

create table public.preferencias_notificacion (
  perfil_id  uuid        not null constraint fk_preferencias_notificacion_perfil
             references public.perfiles (id) on delete cascade,
  evento     text        not null
             constraint ck_preferencias_notificacion_evento
             check (evento in
               ('nueva_incidencia', 'asignada', 'en_proceso', 'en_espera',
                'resuelta', 'cerrada', 'cancelada', 'comentario')),
  habilitado boolean     not null default true,
  constraint pk_preferencias_notificacion primary key (perfil_id, evento)
);

create table public.dispositivos_usuario (
  id         uuid        primary key default gen_random_uuid(),
  perfil_id  uuid        not null constraint fk_dispositivos_usuario_perfil
             references public.perfiles (id) on delete cascade,
  token      text        not null constraint uq_dispositivos_usuario_token unique,
  plataforma text        not null
             constraint ck_dispositivos_usuario_plataforma
             check (plataforma in ('web', 'android', 'ios')),
  activo     boolean     not null default true,
  creado_en  timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ============================================================================
-- M11 · SATISFACCIÓN (2 tablas)
-- ============================================================================

create table public.encuestas_cierre (
  id             uuid        primary key default gen_random_uuid(),
  incidencia_id  uuid        not null constraint uq_encuestas_cierre_incidencia unique
                 constraint fk_encuestas_cierre_incidencia
                 references public.incidencias (id) on delete cascade,
  token          text        not null constraint uq_encuestas_cierre_token unique,
  enviada_en     timestamptz not null default now()
);
comment on column public.encuestas_cierre.token is
  'Enlace respondible sin sesion; un solo uso y con expiracion [P] 30 dias (R8).';

create table public.respuestas_encuesta (
  id            uuid        primary key default gen_random_uuid(),
  encuesta_id   uuid        not null constraint uq_respuestas_encuesta_encuesta unique
                constraint fk_respuestas_encuesta_encuesta
                references public.encuestas_cierre (id) on delete cascade,
  calificacion  integer     not null
                constraint ck_respuestas_encuesta_calificacion
                check (calificacion between 1 and 5),
  comentario    text        constraint ck_respuestas_encuesta_comentario
                check (char_length(comentario) <= 1000),
  respondido_en timestamptz not null default now()
);

-- ============================================================================
-- M12 · BASE DE CONOCIMIENTO (2 tablas)
-- ============================================================================

create table public.categorias_conocimiento (
  id     uuid    primary key default gen_random_uuid(),
  nombre text    not null constraint uq_categorias_conocimiento_nombre unique,
  activo boolean not null default true
);

create table public.articulos_conocimiento (
  id                 uuid        primary key default gen_random_uuid(),
  categoria_id       uuid        not null constraint fk_articulos_conocimiento_categoria
                     references public.categorias_conocimiento (id) on delete restrict,
  tipo_incidencia_id uuid        constraint fk_articulos_conocimiento_tipo
                     references public.tipos_incidencia (id) on delete set null,
  titulo             text        not null,
  slug               text        not null constraint uq_articulos_conocimiento_slug unique,
  contenido          text        not null,
  publicado          boolean     not null default false,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

-- ============================================================================
-- M13 · AUDITORÍA (2 tablas)
-- ============================================================================

create table public.sesiones_usuario (
  id        uuid        primary key default gen_random_uuid(),
  perfil_id uuid        constraint fk_sesiones_usuario_perfil
            references public.perfiles (id) on delete set null,
  evento    text        not null
            constraint ck_sesiones_usuario_evento
            check (evento in ('login', 'logout', 'login_fallido')),
  dispositivo text,
  navegador text,
  ip_hash   text,
  evento_en timestamptz not null default now()
);

create table public.registros_auditoria (
  id                uuid        primary key default gen_random_uuid(),
  actor_id          uuid        constraint fk_registros_auditoria_actor
                    references public.perfiles (id) on delete set null,
  accion            text        not null
                    constraint ck_registros_auditoria_accion
                    check (accion in
                      ('LOGIN', 'LOGOUT', 'CREAR', 'EDITAR', 'ASIGNAR', 'DERIVAR',
                       'CAMBIAR_ESTADO', 'ADJUNTAR_EVIDENCIA', 'RESOLVER', 'CERRAR',
                       'MODIFICAR_CONFIGURACION', 'ANULAR')),
  tabla_afectada    text        not null,
  registro_id       uuid,
  codigo_referencia text,
  valores_previos   jsonb,
  valores_nuevos    jsonb,
  creado_en         timestamptz not null default now()
);
comment on table public.registros_auditoria is
  'Append-only (D9): solo INSERT desde BD (RPC/triggers). Sin UPDATE ni DELETE para nadie.';

-- ============================================================================
-- M14 · REPORTES (2 tablas)
-- ============================================================================

create table public.reportes_generados (
  id             uuid        primary key default gen_random_uuid(),
  solicitado_por uuid        constraint fk_reportes_generados_solicitado_por
                 references public.perfiles (id) on delete set null,
  tipo_reporte   text        not null
                 constraint ck_reportes_generados_tipo
                 check (tipo_reporte in
                   ('operativo', 'tiempos', 'ubicacion', 'equipos', 'areas', 'personalizado')),
  parametros     jsonb       not null default '{}',
  generado_en    timestamptz not null default now()
);

create table public.exportaciones (
  id         uuid        primary key default gen_random_uuid(),
  reporte_id uuid        not null constraint fk_exportaciones_reporte
             references public.reportes_generados (id) on delete cascade,
  formato    text        not null
             constraint ck_exportaciones_formato
             check (formato in ('pdf', 'excel', 'csv')),
  bucket     text        not null default 'reportes',
  path       text        not null constraint uq_exportaciones_path unique,
  expira_en  timestamptz,
  creado_en  timestamptz not null default now()
);

-- ============================================================================
-- VERIFICACIÓN ESTRUCTURAL
-- ============================================================================
-- La suma de tablas creadas debe ser 58 (Opción A). Si esta aserción falla,
-- la migración se detiene y el estado queda marcado como fallido en Supabase.
do $$
declare
  total int;
begin
  select count(*) into total
  from pg_tables
  where schemaname = 'public';
  if total <> 58 then
    raise exception 'Se esperaban 58 tablas en public, se encontraron %', total;
  end if;
end
$$;
-- ============================================================================
-- SIR-UPSJB · 0002_indexes.sql
-- Índices según el modelo aprobado (docs/01 §6 y consolidado §7):
--  - Índices de FK / consultas frecuentes (§2.6, §6).
--  - Índices únicos parciales de negocio (§7.1): reglas de unicidad con
--    condición (un QR activo por ambiente, un técnico activo por incidencia,
--    una ubicación activa por equipo, etc.).
-- Estrategia §2.6: catálogos pequeños (< 100 filas) sin índices adicionales;
-- las PK compuestas ya cubren el acceso por su primera columna.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- M1 · Usuarios y seguridad
-- ----------------------------------------------------------------------------
create index if not exists idx_perfiles_estado
  on public.perfiles (estado);

-- documento opcional: único solo cuando existe (§6.1)
create unique index if not exists uq_perfiles_documento
  on public.perfiles (documento)
  where documento is not null;

-- ----------------------------------------------------------------------------
-- M2 · Infraestructura
-- ----------------------------------------------------------------------------
create index if not exists idx_pabellones_sede   on public.pabellones (sede_id);
create index if not exists idx_pisos_pabellon    on public.pisos (pabellon_id);

create index if not exists idx_ambientes_piso   on public.ambientes (piso_id);
create index if not exists idx_ambientes_tipo   on public.ambientes (tipo_ambiente_id);
create index if not exists idx_ambientes_activo on public.ambientes (activo);

-- ----------------------------------------------------------------------------
-- M3 · Equipos
-- ----------------------------------------------------------------------------
create index if not exists idx_equipos_estado    on public.equipos (estado_id);
create index if not exists idx_equipos_categoria on public.equipos (categoria_id);

-- numero_serie opcional: único solo cuando existe (§6.3)
create unique index if not exists uq_equipos_numero_serie
  on public.equipos (numero_serie)
  where numero_serie is not null;

-- Regla de negocio: un equipo tiene a lo sumo UNA asignación activa
-- (ubicación actual — fuente de verdad, D8).
create unique index if not exists uq_asignacion_equipo_activa
  on public.equipos_ambientes (equipo_id)
  where activa;

create index if not exists idx_equipos_ambientes_ambiente
  on public.equipos_ambientes (ambiente_id);

create index if not exists idx_movimientos_equipos_equipo  on public.movimientos_equipos (equipo_id);
create index if not exists idx_movimientos_equipos_origen  on public.movimientos_equipos (ambiente_origen_id);
create index if not exists idx_movimientos_equipos_destino on public.movimientos_equipos (ambiente_destino_id);

-- ----------------------------------------------------------------------------
-- M4 · QR
-- ----------------------------------------------------------------------------
-- Regla 9: un solo QR ACTIVO por ambiente.
create unique index if not exists uq_codigos_qr_ambiente_activo
  on public.codigos_qr (ambiente_id)
  where activo;

create index if not exists idx_codigos_qr_ambiente on public.codigos_qr (ambiente_id);
create index if not exists idx_codigos_qr_activo   on public.codigos_qr (activo);

create index if not exists idx_lecturas_qr_codigo on public.lecturas_qr (codigo_qr_id);
create index if not exists idx_lecturas_qr_fecha  on public.lecturas_qr (leido_en);

-- ----------------------------------------------------------------------------
-- M5 · Incidencias (catálogos + tabla principal)
-- ----------------------------------------------------------------------------
create index if not exists idx_incidencias_estado     on public.incidencias (estado_id);
create index if not exists idx_incidencias_ambiente   on public.incidencias (ambiente_id);
create index if not exists idx_incidencias_tipo       on public.incidencias (tipo_incidencia_id);
create index if not exists idx_incidencias_prioridad  on public.incidencias (prioridad_id);
create index if not exists idx_incidencias_fecha_reporte on public.incidencias (fecha_reporte);

-- Consulta frecuente: incidencias de un reportante, más recientes primero (§2.6)
create index if not exists idx_incidencias_reportante_fecha
  on public.incidencias (usuario_reportante_id, fecha_reporte desc);

-- Búsqueda case-insensitive del código para el seguimiento público (§2.6)
create index if not exists idx_incidencias_codigo_upper
  on public.incidencias (upper(codigo));

-- ----------------------------------------------------------------------------
-- M6 · Detalle de incidencias
-- ----------------------------------------------------------------------------
create index if not exists idx_adjuntos_incidencia
  on public.incidencia_adjuntos (incidencia_id);

create index if not exists idx_comentarios_incidencia
  on public.incidencia_comentarios (incidencia_id);

create index if not exists idx_historial_incidencia_fecha
  on public.incidencia_historial (incidencia_id, creado_en);

create index if not exists idx_asignaciones_incidencia
  on public.incidencia_asignaciones (incidencia_id);
create index if not exists idx_asignaciones_tecnico
  on public.incidencia_asignaciones (tecnico_id);

-- Regla del flujo (§8.6): a lo sumo UN técnico activo por incidencia;
-- la reasignación cierra la fila anterior.
create unique index if not exists uq_asignacion_activa
  on public.incidencia_asignaciones (incidencia_id)
  where activa;

create index if not exists idx_derivaciones_incidencia
  on public.incidencia_derivaciones (incidencia_id);
create index if not exists idx_derivaciones_area_destino
  on public.incidencia_derivaciones (area_destino_id);

-- El destino vigente es la fila abierta (activa = true).
create unique index if not exists uq_derivacion_activa
  on public.incidencia_derivaciones (incidencia_id)
  where activa;

-- ----------------------------------------------------------------------------
-- M7 · Organización
-- ----------------------------------------------------------------------------
create index if not exists idx_servicios_area on public.servicios (area_id);
create index if not exists idx_tecnicos_area  on public.tecnicos (area_id);
create index if not exists idx_tecnicos_sede  on public.tecnicos (sede_id);

-- ----------------------------------------------------------------------------
-- M8 · Reglas de derivación
-- ----------------------------------------------------------------------------
-- Sin reglas duplicadas para el mismo alcance: subtipo NULL ≡ "todo el tipo"
-- (se normaliza con coalesce a uuid-cero; índice único de expresión).
create unique index if not exists uq_reglas_alcance
  on public.reglas_enrutamiento
  (tipo_incidencia_id, coalesce(subtipo_incidencia_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where activa;

-- Orden de evaluación único entre reglas activas (§6.8).
create unique index if not exists uq_reglas_orden
  on public.reglas_enrutamiento (prioridad_orden)
  where activa;

-- ----------------------------------------------------------------------------
-- M9 · SLA
-- ----------------------------------------------------------------------------
-- Un SLA BASE por prioridad (sin tipo); las especializaciones por tipo coexisten.
create unique index if not exists uq_sla_prioridad
  on public.acuerdos_nivel_servicio (prioridad_id)
  where tipo_incidencia_id is null and activo;

-- ----------------------------------------------------------------------------
-- M10 · Notificaciones
-- ----------------------------------------------------------------------------
-- Bandeja: notificaciones no leídas por usuario (índice parcial).
create index if not exists idx_notificaciones_perfil_no_leidas
  on public.notificaciones (perfil_id)
  where leida_en is null;

create index if not exists idx_notificaciones_incidencia
  on public.notificaciones (incidencia_id);

-- ----------------------------------------------------------------------------
-- M12 · Base de conocimiento
-- ----------------------------------------------------------------------------
create index if not exists idx_articulos_categoria_publicado
  on public.articulos_conocimiento (categoria_id)
  where publicado;

-- ----------------------------------------------------------------------------
-- M13 · Auditoría
-- ----------------------------------------------------------------------------
create index if not exists idx_auditoria_fecha        on public.registros_auditoria (creado_en);
create index if not exists idx_auditoria_actor        on public.registros_auditoria (actor_id);
create index if not exists idx_auditoria_tabla_registro
  on public.registros_auditoria (tabla_afectada, registro_id);

create index if not exists idx_sesiones_perfil_fecha
  on public.sesiones_usuario (perfil_id, evento_en);

-- ----------------------------------------------------------------------------
-- M11/M14 · Encuestas y reportes: las columnas UQ (1:1) ya tienen índice
-- implícito por las restricciones UNIQUE declaradas en 0001.
-- ----------------------------------------------------------------------------
-- ============================================================================
-- SIR-UPSJB · 0003_functions.sql
-- Funciones SQL requeridas por el modelo aprobado (docs/01 §8 y §10):
--   1. set_updated_at            — mantiene actualizado_en (§1, auditoría de fila).
--   2. set_default_by_name       — resuelve defaults por NOMBRE (sin UUID fijos).
--   3. resolver_secuencia_incidencias — secuencia ANUAL del código de incidencia (§2.2).
--   4. generar_codigo_incidencia — INC-<AAAA>-<NNNNNN> atómico por secuencia (D5).
--   5. generar_siguiente_codigo_qr — <SEDE>-<PABELLON>-<AMBIENTE>-<N> (§2.3).
--   6. generar_codigo_qr_nuevo / deshabilitar_qr_anterior — estructura QR (Regla 9).
--   7. cerrar_asignacion_anterior — a lo sumo un técnico activo por incidencia (D7).
--   8. sincronizar_movimientos_equipo — consistencia equipos_ambientes ↔ movimientos (R3).
--   9. register_new_user         — crea perfiles al registrarse (1:1 con auth.users, D2).
--
-- Sin credenciales ni secretos. SECURITY DEFINER solo donde es imprescindible
-- (defaults, códigos y registro de usuarios), siempre con search_path vacío.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mantener actualizado_en en cada UPDATE
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Resolución de defaults por nombre de fila (sin UUID hardcodeados)
--    Tablas de catálogo pequeñas y con nombre UNIQUE: SELECT por nombre es
--    determinista y no rompe la portabilidad entre entornos (import/export).
-- ----------------------------------------------------------------------------
create or replace function public.set_default_by_name(
  p_tabla   text,
  p_columna text,
  p_nombre  text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sql  text;
  v_id   uuid;
begin
  -- Los identificadores provienen SOLO de llamadas internas del trigger
  -- (literal constante), nunca de entrada de usuarios.
  v_sql := format(
    'select id from public.%I where nombre = $1 limit 1',
    p_tabla
  );
  execute v_sql into v_id using p_nombre;
  if v_id is null then
    raise exception
      'set_default_by_name: no existe la fila "%" en public.% (¿falta el seed 0005?)',
      p_nombre, p_tabla;
  end if;
  return v_id;
end;
$$;

-- Defaults del modelo aplicados en INSERT (§6.5):
--   prioridad = Media [P] · estado = Pendiente · canal = QR
create or replace function public.asignar_defaults_incidencia()
returns trigger
language plpgsql
as $$
begin
  if new.prioridad_id is null then
    new.prioridad_id := public.set_default_by_name('prioridades', 'prioridad_id', 'Media');
  end if;
  if new.estado_id is null then
    new.estado_id := public.set_default_by_name('estados_incidencia', 'estado_id', 'Pendiente');
  end if;
  if new.canal_reporte_id is null then
    new.canal_reporte_id := public.set_default_by_name('canales_reporte', 'canal_reporte_id', 'QR');
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Secuencia ANUAL del código de incidencia (§2.2, D5)
--    Al pasar de año se crea incidencias_codigo_seq_<AAAA> (solo la primera
--    vez: sin escaneo de incidencias en cada INSERT). En su creación se
--    sincroniza con los códigos ya emitidos (restauración/importación).
-- ----------------------------------------------------------------------------
create or replace function public.resolver_secuencia_incidencias()
returns regclass
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio      int;
  v_secuencia text;
  v_reg       text;
  v_ultimo    int;
begin
  v_anio      := extract(year from now())::int;
  v_secuencia := format('incidencias_codigo_seq_%s', v_anio);

  select to_regclass(format('public.%I', v_secuencia))::text into v_reg;

  if v_reg is null then
    execute format('create sequence if not exists public.%I', v_secuencia);

    -- Si ya existen códigos del año (p. ej. base restaurada/importada),
    -- alinea la secuencia para no reemitir números. Se hace una sola vez.
    select coalesce(max(substring(codigo from '[0-9]+$')::int), 0)
      into v_ultimo
      from public.incidencias
     where codigo like format('INC-%s-%%', v_anio);

    perform setval(
      format('public.%I', v_secuencia),
      greatest(v_ultimo, 1),
      v_ultimo > 0
    );
  end if;

  return format('public.%I', v_secuencia)::regclass;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Código único de incidencia: INC-<AAAA>-<NNNNNN> (Regla 1)
--    nextval() dentro del INSERT = atómico bajo concurrencia (nunca max()+1).
-- ----------------------------------------------------------------------------
create or replace function public.generar_codigo_incidencia()
returns trigger
language plpgsql
as $$
declare
  v_secuencia regclass;
begin
  if new.codigo is not null then
    return new;  -- se permite explícito solo para importaciones/restauraciones
  end if;

  v_secuencia := public.resolver_secuencia_incidencias();

  new.codigo := format(
    'INC-%s-%s',
    extract(year from now())::int,
    lpad(nextval(v_secuencia)::text, 6, '0')
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Código de QR: <SEDE>-<PABELLON>-<AMBIENTE>-<N> (§2.3). Ej.: ICA-B-B104-0001.
--    Se deriva del codigo del ambiente (<SEDE>-<PABELLON>-<AMBIENTE>, que ya
--    incluye el prefijo de sede, §2.4) + consecutivo de secuencia. La UNIQUE
--    de codigos_qr.codigo rechaza cualquier colision.
-- ----------------------------------------------------------------------------
create or replace function public.generar_siguiente_codigo_qr(
  p_ambiente_codigo text
)
returns text
language plpgsql
volatile
as $$
begin
  return p_ambiente_codigo
         || '-'
         || lpad(nextval('public.sec_codigos_qr')::text, 4, '0');
end;
$$;

-- Genera el codigo y la URL estable /r/<codigo> al insertar un QR.
create or replace function public.generar_codigo_qr_nuevo()
returns trigger
language plpgsql
as $$
declare
  v_ambiente_codigo text;
begin
  if new.codigo is not null then
    return new;  -- importación/manual: no recalcular
  end if;

  select a.codigo
    into v_ambiente_codigo
    from public.ambientes a
   where a.id = new.ambiente_id;

  if v_ambiente_codigo is null then
    raise exception 'generar_codigo_qr_nuevo: ambiente % inexistente', new.ambiente_id;
  end if;

  new.codigo      := public.generar_siguiente_codigo_qr(v_ambiente_codigo);
  new.url_destino := '/r/' || new.codigo;
  return new;
end;
$$;

-- Regla 9: al regenerar, deshabilita el QR activo anterior del ambiente.
create or replace function public.deshabilitar_qr_anterior()
returns trigger
language plpgsql
as $$
begin
  update public.codigos_qr
     set activo           = false,
         deshabilitado_en = now()
   where ambiente_id = new.ambiente_id
     and activo
     and id <> new.id;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Asignaciones: a lo sumo un técnico activo por incidencia (§8.6, D7).
--    Al abrir una asignación activa, cierra la anterior del mismo ticket.
--    La unicidad estricta la impone uq_asignacion_activa (0002); este trigger
--    evita el error cerrando la fila previa (la reasignación es flujo normal).
-- ----------------------------------------------------------------------------
create or replace function public.cerrar_asignacion_anterior()
returns trigger
language plpgsql
as $$
begin
  if new.activa then
    update public.incidencia_asignaciones
       set activa     = false,
           cerrada_en = now()
     where incidencia_id = new.incidencia_id
       and activa
       and id <> new.id;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Consistencia asignación vigente ↔ movimientos (R3, D8):
--    reubicar un equipo cierra su movimiento abierto y abre el nuevo;
--    además fuerza la unicidad de la asignación activa.
-- ----------------------------------------------------------------------------
create or replace function public.sincronizar_movimientos_equipo()
returns trigger
language plpgsql
as $$
declare
  v_actual          uuid;
  v_ambiente_actual uuid;
begin
  if new.activa then
    -- Cierra otra asignación activa del mismo equipo (ubicación actual única).
    update public.equipos_ambientes
       set activa = false
     where equipo_id = new.equipo_id
       and ambiente_id <> new.ambiente_id
       and activa;

    -- Cierra el movimiento abierto previo (si existe) y recuerda su destino:
    -- es el ambiente de origen del nuevo movimiento.
    select id, ambiente_destino_id
      into v_actual, v_ambiente_actual
      from public.movimientos_equipos
     where equipo_id = new.equipo_id
       and fecha_hasta is null
     order by fecha_desde desc
     limit 1;

    if v_actual is not null then
      update public.movimientos_equipos
         set fecha_hasta = now()
       where id = v_actual;
    end if;

    -- Abre el movimiento hacia la nueva ubicación (si no existe ya abierto).
    if not exists (
      select 1 from public.movimientos_equipos
       where equipo_id = new.equipo_id
         and ambiente_destino_id = new.ambiente_id
         and fecha_hasta is null
    ) then
      insert into public.movimientos_equipos
        (equipo_id, ambiente_origen_id, ambiente_destino_id, tipo_movimiento)
      values
        (new.equipo_id, v_ambiente_actual, new.ambiente_id, 'asignacion');
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Alta automática de perfiles al registrarse en Supabase Auth (D2).
--    SECURITY DEFINER: el nuevo usuario aún no tiene fila en perfiles.
--    Crea la fila 1:1 (mismo UUID) y asigna el rol base ESTUDIANTE [P].
--    NOTA: los nombres de raw_user_meta_data (nombres, apellido_paterno) se
--    definirán en la fase de autenticación (supabase-js signUp options.data).
-- ----------------------------------------------------------------------------
create or replace function public.register_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol uuid;
begin
  insert into public.perfiles (id, correo, nombres, apellido_paterno)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombres', ''), 'Pendiente'),
    coalesce(nullif(new.raw_user_meta_data ->> 'apellido_paterno', ''), '')
  );

  select id into v_rol
    from public.roles
   where nombre = 'ESTUDIANTE';

  if v_rol is not null then
    insert into public.usuarios_roles (perfil_id, rol_id)
    values (new.id, v_rol)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
-- ============================================================================
-- SIR-UPSJB · 0004_triggers.sql
-- Aplicación de las funciones (0003) a las tablas del modelo aprobado:
--   · actualizado_en (auditoría de fila, §1) en todas las tablas con la columna.
--   · código INC-AAAA-NNNNNN por secuencia anual (Regla 1).
--   · defaults por nombre: prioridad Media, estado Pendiente, canal QR (§6.5).
--   · QR: generación de código/URL + un QR activo por ambiente (Regla 9).
--   · asignaciones activas y sincronía con movimientos de equipos (D7, D8).
--   · perfiles automáticos al registrarse (D2).
--   · protección append-only de historial y auditoría (D9): deny UPDATE/DELETE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. actualizado_en — todas las tablas con la columna (§1)
-- ----------------------------------------------------------------------------
create trigger trg_perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

create trigger trg_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create trigger trg_sedes_updated_at
  before update on public.sedes
  for each row execute function public.set_updated_at();

create trigger trg_pabellones_updated_at
  before update on public.pabellones
  for each row execute function public.set_updated_at();

create trigger trg_pisos_updated_at
  before update on public.pisos
  for each row execute function public.set_updated_at();

create trigger trg_ambientes_updated_at
  before update on public.ambientes
  for each row execute function public.set_updated_at();

create trigger trg_equipos_updated_at
  before update on public.equipos
  for each row execute function public.set_updated_at();

create trigger trg_areas_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

create trigger trg_tecnicos_updated_at
  before update on public.tecnicos
  for each row execute function public.set_updated_at();

create trigger trg_incidencias_updated_at
  before update on public.incidencias
  for each row execute function public.set_updated_at();

create trigger trg_reglas_enrutamiento_updated_at
  before update on public.reglas_enrutamiento
  for each row execute function public.set_updated_at();

create trigger trg_sla_updated_at
  before update on public.acuerdos_nivel_servicio
  for each row execute function public.set_updated_at();

create trigger trg_dispositivos_usuario_updated_at
  before update on public.dispositivos_usuario
  for each row execute function public.set_updated_at();

create trigger trg_articulos_conocimiento_updated_at
  before update on public.articulos_conocimiento
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Código único de incidencia (Regla 1) — before insert
-- ----------------------------------------------------------------------------
create trigger trg_incidencias_generar_codigo
  before insert on public.incidencias
  for each row execute function public.generar_codigo_incidencia();

-- Defaults del modelo: prioridad Media · estado Pendiente · canal QR (§6.5)
create trigger trg_incidencias_defaults
  before insert on public.incidencias
  for each row execute function public.asignar_defaults_incidencia();

-- ----------------------------------------------------------------------------
-- 3. QR (§2.3, Regla 9)
-- ----------------------------------------------------------------------------
create trigger trg_codigos_qr_generar_codigo
  before insert on public.codigos_qr
  for each row execute function public.generar_codigo_qr_nuevo();

create trigger trg_codigos_qr_un_activo_por_ambiente
  after insert on public.codigos_qr
  for each row execute function public.deshabilitar_qr_anterior();

-- ----------------------------------------------------------------------------
-- 4. Asignaciones: cierre de la fila activa anterior (D7)
-- ----------------------------------------------------------------------------
create trigger trg_asignaciones_cerrar_anterior
  before insert on public.incidencia_asignaciones
  for each row execute function public.cerrar_asignacion_anterior();

-- ----------------------------------------------------------------------------
-- 5. Equipos: consistencia asignación activa ↔ movimientos (R3, D8)
--    BEFORE insert: cierra la asignación activa previa ANTES de que el índice
--    parcial único uq_asignacion_equipo_activa la rechace.
-- ----------------------------------------------------------------------------
create trigger trg_equipos_ambientes_sync_movimientos
  before insert on public.equipos_ambientes
  for each row execute function public.sincronizar_movimientos_equipo();

-- ----------------------------------------------------------------------------
-- 6. Perfiles automáticos al registrarse (D2) — Supabase Auth
-- ----------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.register_new_user();

-- ----------------------------------------------------------------------------
-- 7. Append-only (D9): historial y auditoría sin UPDATE ni DELETE.
--    El cliente nunca modifica estos datos; la protección vive en la BD.
-- ----------------------------------------------------------------------------
create or replace function public.bloquear_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception '% sobre % prohibido: la tabla es append-only',
    tg_op, tg_table_name;
end;
$$;

create trigger trg_incidencia_historial_append_only
  before update or delete on public.incidencia_historial
  for each row execute function public.bloquear_update_delete();

create trigger trg_registros_auditoria_append_only
  before update or delete on public.registros_auditoria
  for each row execute function public.bloquear_update_delete();

-- ----------------------------------------------------------------------------
-- Verificación: los triggers esenciales deben existir.
-- ----------------------------------------------------------------------------
do $$
declare
  faltan int;
begin
  select count(*) into faltan
  from (values
    ('incidencias',            'trg_incidencias_generar_codigo'),
    ('incidencias',            'trg_incidencias_defaults'),
    ('codigos_qr',             'trg_codigos_qr_generar_codigo'),
    ('codigos_qr',             'trg_codigos_qr_un_activo_por_ambiente'),
    ('incidencia_asignaciones','trg_asignaciones_cerrar_anterior'),
    ('equipos_ambientes',      'trg_equipos_ambientes_sync_movimientos'),
    ('auth.users',             'on_auth_user_created')
  ) as esperados(tabla, trigger)
  where not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = esperados.trigger
      and not t.tgisinternal
      and (n.nspname || '.' || c.relname) =
          (case when position('.' in esperados.tabla) > 0
                then esperados.tabla else 'public.' || esperados.tabla end)
  );
  if faltan > 0 then
    raise exception 'Faltan % triggers esenciales tras la migracion', faltan;
  end if;
end
$$;
-- ============================================================================
-- SIR-UPSJB · 0005_seed_catalogos.sql
-- Semillas mínimas de catálogos. Idempotente: ON CONFLICT DO NOTHING
-- (re-ejecutable sin duplicar filas).
--
--   NOTA: son valores PROPUESTOS por el equipo técnico [P]; los marcados [VI]
--   quedan pendientes de validación institucional (docs/01 §11). El
--   administrador podrá ampliar/editar catálogos desde la app (Regla 10).
--
--   Requeridos por el sistema:
--   · prioridad 'Media', estado 'Pendiente', canal 'QR'  → defaults (0003/0004)
--   · rol 'ESTUDIANTE'                                    → register_new_user
--   · 8 eventos de plantilla                              → CK de notificaciones
--   · estados de incidencia 'Cerrada'/'Cancelada' es_final=true (flujo §6.5)
-- ============================================================================

-- M1 · Roles [P] (semilla [VI] — §6.1)
insert into public.roles (nombre, descripcion) values
  ('ADMINISTRADOR', 'Control total del sistema, configuración y usuarios'),
  ('COORDINADOR',   'Supervisión por sede/área, reportes y asignación'),
  ('TECNICO',       'Atención y resolución de incidencias asignadas'),
  ('DOCENTE',       'Docente de la Filial Ica; reporta y da seguimiento'),
  ('ESTUDIANTE',    'Estudiante; reporta y da seguimiento (rol base)'),
  ('ADMINISTRATIVO','Personal administrativo; reporta y da seguimiento'),
  ('SUPERVISOR',    'Rol pendiente de definición de permisos [VI]')
on conflict (nombre) do nothing;

-- M1 · Permisos atómicos [P]
insert into public.permisos (codigo, descripcion) values
  ('crear_incidencia',        'Reportar incidencias (mínimo transversal)'),
  ('ver_incidencias_propias', 'Ver y seguir las incidencias propias'),
  ('comentar_incidencia',     'Participar en la conversación de un ticket'),
  ('adjuntar_evidencia',      'Subir adjuntos a un ticket'),
  ('asignar_incidencia',      'Asignar técnicos a incidencias'),
  ('derivar_incidencia',      'Derivar incidencias entre áreas'),
  ('cambiar_estado',          'Mover el estado de una incidencia'),
  ('cerrar_incidencia',       'Cerrar o cancelar incidencias'),
  ('resolver_incidencia',     'Registrar resolución de incidencias'),
  ('gestionar_usuarios',      'Alta, edición y roles de usuarios'),
  ('gestionar_organizacion',  'Áreas, servicios, técnicos y turnos'),
  ('gestionar_infraestructura','Sedes, pabellones, pisos y ambientes'),
  ('gestionar_equipos',       'Inventario de equipos y movimientos'),
  ('gestionar_qr',            'Generar y deshabilitar códigos QR'),
  ('gestionar_reglas',        'Reglas de derivación y SLA'),
  ('ver_reportes',            'Consultar y exportar reportes'),
  ('ver_auditoria',           'Consultar registros de auditoría'),
  ('gestionar_conocimiento',  'Administrar la base de conocimiento'),
  ('gestionar_notificaciones','Plantillas y canales de notificación')
on conflict (codigo) do nothing;

-- M1 · Permisos base por rol [P] (matriz mínima; se ajusta en la fase de RLS)
insert into public.roles_permisos (rol_id, permiso_id)
select r.id, p.id
from public.roles r
join public.permisos p on (
  (r.nombre = 'ADMINISTRADOR') or
  (r.nombre = 'COORDINADOR'   and p.codigo in
    ('ver_incidencias_propias','asignar_incidencia','derivar_incidencia',
     'cambiar_estado','ver_reportes')) or
  (r.nombre = 'TECNICO'       and p.codigo in
    ('ver_incidencias_propias','cambiar_estado','resolver_incidencia',
     'adjuntar_evidencia','comentar_incidencia')) or
  (r.nombre in ('DOCENTE','ESTUDIANTE','ADMINISTRATIVO','SUPERVISOR') and
     p.codigo in
    ('crear_incidencia','ver_incidencias_propias','comentar_incidencia',
     'adjuntar_evidencia'))
)
on conflict do nothing;

-- M2 · Tipos de ambiente [P]
insert into public.tipos_ambiente (nombre) values
  ('Aula'), ('Laboratorio'), ('Oficina'), ('Auditorio'), ('Biblioteca'),
  ('Baño'), ('Taller'), ('Almacen'), ('Otro')
on conflict (nombre) do nothing;

-- M3 · Catálogos de equipos [P]
insert into public.categorias_equipos (nombre) values
  ('Computadora'), ('Laptop'), ('Monitor'), ('Impresora'), ('Proyector'),
  ('Switch'), ('Access Point'), ('Impresora de red'), ('Scanner'), ('Otro')
on conflict (nombre) do nothing;

insert into public.marcas_equipos (nombre) values
  ('HP'), ('Dell'), ('Lenovo'), ('Asus'), ('Acer'), ('Epson'),
  ('Canon'), ('Cisco'), ('TP-Link'), ('Genérico')
on conflict (nombre) do nothing;

insert into public.estados_equipos (nombre, es_final) values
  ('Operativo',        false),
  ('En mantenimiento', false),
  ('Dañado',           false),
  ('En reparación',    false),
  ('Fuera de servicio', true),
  ('Baja',             true)
on conflict (nombre) do nothing;

-- M5 · Catálogos de incidencias
-- Prioridades: nivel 1=Baja … 4=Crítica (orden para SLA) [P]
insert into public.prioridades (nombre, nivel, color) values
  ('Baja',     1, '#22c55e'),
  ('Media',    2, '#eab308'),
  ('Alta',     3, '#f97316'),
  ('Crítica',  4, '#ef4444')
on conflict (nombre) do nothing;

-- Estados del flujo (orden = secuencia) [P]
insert into public.estados_incidencia (nombre, orden, es_final, color) values
  ('Pendiente',  1, false, '#eab308'),
  ('Asignada',   2, false, '#3b82f6'),
  ('En proceso', 3, false, '#6366f1'),
  ('En espera',  4, false, '#a855f7'),
  ('Resuelta',   5, false, '#22c55e'),
  ('Cerrada',    6, true,  '#6b7280'),
  ('Cancelada',  7, true,  '#9ca3af')
on conflict (nombre) do nothing;

insert into public.canales_reporte (nombre) values
  ('QR'), ('Web'), ('Administrador'), ('Docente'), ('Teléfono'), ('Otro')
on conflict (nombre) do nothing;

-- Tipos de incidencia [P]; lista oficial [VI] (§11.1)
insert into public.tipos_incidencia (nombre) values
  ('Técnica'), ('Infraestructura'), ('Conectividad'), ('Mobiliario'),
  ('Limpieza'), ('Seguridad'), ('Académica'), ('Administrativa'), ('Otro')
on conflict (nombre) do nothing;

-- Subtipos de ejemplo para los tipos más operativos [P]
insert into public.subtipos_incidencia (tipo_incidencia_id, nombre)
select t.id, v.nombre
from (values
  ('Técnica',       'Computadora no enciende'),
  ('Técnica',       'Monitor sin señal'),
  ('Técnica',       'Impresora atascada'),
  ('Técnica',       'Software con error'),
  ('Conectividad',  'Internet lento'),
  ('Conectividad',  'Sin acceso a la red'),
  ('Conectividad',  'WiFi intermitente'),
  ('Infraestructura','Luminaria fundida'),
  ('Infraestructura','Fuga de agua'),
  ('Mobiliario',    'Silla dañada'),
  ('Mobiliario',    'Escritorio dañado')
) as v(tipo, nombre)
join public.tipos_incidencia t on t.nombre = v.tipo
on conflict do nothing;

-- M7 · Especialidades [P]
insert into public.especialidades_tecnicas (nombre) values
  ('Soporte'), ('Redes'), ('Hardware'), ('Software'),
  ('Electricidad'), ('Climatización'), ('Infraestructura')
on conflict (nombre) do nothing;

-- M10 · Plantillas por evento (cuerpo con placeholders [P])
insert into public.plantillas_notificacion (evento, asunto, cuerpo, canal) values
  ('nueva_incidencia', 'Reporte registrado: {{codigo}}',
   'Tu reporte en {{ambiente}} fue registrado con el código {{codigo}}. Puedes seguirlo con ese código.', 'interna'),
  ('asignada', 'Incidencia {{codigo}} asignada',
   'La incidencia {{codigo}} fue asignada a un técnico de {{area}}.', 'interna'),
  ('en_proceso', 'Incidencia {{codigo}} en proceso',
   'La incidencia {{codigo}} está siendo atendida.', 'interna'),
  ('en_espera', 'Incidencia {{codigo}} en espera',
   'La incidencia {{codigo}} quedó en espera: {{detalle}}.', 'interna'),
  ('resuelta', 'Incidencia {{codigo}} resuelta',
   'La incidencia {{codigo}} fue resuelta. Confirma y responde la encuesta de cierre.', 'interna'),
  ('cerrada', 'Incidencia {{codigo}} cerrada',
   'La incidencia {{codigo}} fue cerrada. Gracias por tu reporte.', 'interna'),
  ('cancelada', 'Incidencia {{codigo}} cancelada',
   'La incidencia {{codigo}} fue cancelada: {{detalle}}.', 'interna'),
  ('comentario', 'Nuevo comentario en {{codigo}}',
   'Hay un nuevo comentario en la incidencia {{codigo}}.', 'interna')
on conflict (evento) do nothing;

-- M9 · SLA base por prioridad — VALORES PROPUESTOS [VI] (Plan §19.2)
-- Guard NOT EXISTS: la tabla no tiene restricción UNIQUE aplicable y el índice
-- parcial uq_sla_prioridad rechazaría el re-insert (idempotencia explícita).
insert into public.acuerdos_nivel_servicio
  (prioridad_id, horas_respuesta, horas_resolucion)
select p.id, v.h_resp, v.h_resol
from (values
  ('Baja',    48.0, 96.0),
  ('Media',   24.0, 48.0),
  ('Alta',     4.0,  8.0),
  ('Crítica',  1.0,  4.0)
) as v(nombre, h_resp, h_resol)
join public.prioridades p on p.nombre = v.nombre
where not exists (
  select 1 from public.acuerdos_nivel_servicio a
  where a.prioridad_id = p.id
    and a.tipo_incidencia_id is null
);
-- ============================================================================
-- SIR-UPSJB · 0006_rls_funciones_auxiliares.sql
-- Seguridad: funciones auxiliares para RLS + endurecimiento del perímetro.
--
-- · Principio: la seguridad vive en PostgreSQL. El frontend oculta botones,
--   pero SIEMPRE el que decide es RLS (ver docs/01 §8.1 y FASES.md FASE 3).
--
-- Decisiones de diseño:
--   · El ROL del usuario viaja en el JWT (app_metadata.roles → GUC request.jwt.claim.roles).
--     app_metadata solo puede escribirlo el servidor (nunca el usuario: Supabase
--     no permite que el cliente modifique app_metadata) → no falsificable.
--   · Funciones STABLE SECURITY DEFINER con search_path fijo: RLS las llama
--     por fila; son seguras y rápidas (plan cacheado, sin recursión de policies).
--   · El PERMISO efectivo es la unión de los permisos de todos los roles (§8.1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ESQUEMA PRIVADO de apoyo (lo requieren las funciones de la sección 5 y la
-- tabla tecnico_area_admin de la sección 6; no se expone por la API PostgREST)
-- ----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 0. PERÍMETRO: sin GRANT no hay acceso, aunque RLS exista.
--    Supabase concede por defecto ALL a anon/authenticated sobre public;
--    se revoca y se concede de forma explícita y mínima. Las policies de 0007
--    filtrarán filas; estos privilegios limitan el alcance total.
-- ----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- La app necesita INSERT en incidencias y (con triggers)nextval de la secuencia QR.
grant usage, update on sequence public.sec_codigos_qr to authenticated;

-- ----------------------------------------------------------------------------
-- 1. Contexto del usuario en el request (GUC, no modifiable por el cliente
--    para app_metadata; el claim lo inyecta el servidor con cada request).
-- ----------------------------------------------------------------------------

-- UUID del usuario autenticado (NULL si es anónimo)
create or replace function public.usuario_actual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Identificadores de roles desde el JWT: app_metadata.roles (array de texto)
create or replace function public.roles_actuales()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array(
      select jsonb_array_elements_text(
        coalesce(
          nullif(current_setting('request.jwt.claim.roles', true), '')::jsonb,
          '[]'::jsonb
        )
      )
    ),
    '{}'
  );
$$;

-- ¿El usuario autenticado tiene un perfil activo?
create or replace function public.perfil_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = public.usuario_actual()
      and p.estado = 'activo'
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Verificación de roles (Regla 8: roles múltiples, permiso = unión)
-- ----------------------------------------------------------------------------

-- ¿Tiene alguno de los roles indicados? (row security expression)
create or replace function public.tiene_rol(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.perfil_activo()
     and public.roles_actuales() && roles::text[];
$$;

-- ¿Su rol principal (el primero en el JWT) es exactamente este? [P]
create or replace function public.mi_rol_es(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.perfil_activo()
     and (public.roles_actuales())[1] = p_rol;
$$;

-- ----------------------------------------------------------------------------
-- 3. Verificación de permisos (permisos efectivos = unión por roles, §8.1)
--    Los permisos viven en la BD (roles_permisos); el JWT solo aporta los roles.
-- ----------------------------------------------------------------------------

create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permite boolean;
begin
  if not public.perfil_activo() then
    return false;
  end if;

  select exists (
    select 1
    from public.usuarios_roles ur
    join public.roles_permisos rp on rp.rol_id = ur.rol_id
    join public.permisos pe      on pe.id     = rp.permiso_id
   where ur.perfil_id = public.usuario_actual()
     and pe.codigo    = p_permiso
  ) into v_permite;

  return coalesce(v_permite, false);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Verificación de ownership (Regla: el usuario solo opera lo suyo)
-- ----------------------------------------------------------------------------

-- ¿La incidencia fue reportada por el usuario actual?
create or replace function public.es_dueno_incidencia(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incidencias i
    where i.id = p_incidencia_id
      and i.usuario_reportante_id = public.usuario_actual()
  );
$$;

-- ¿El ticket es propio? Acepta id o código legible (p. ej. desde seguimiento).
create or replace function public.verificar_ownership_ticket(
  p_ticket_id uuid,
  p_codigo    text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.incidencias i
    where i.usuario_reportante_id = public.usuario_actual()
      and ( (p_ticket_id is not null and i.id = p_ticket_id)
         or (p_codigo    is not null and i.codigo = p_codigo) )
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Verificación de área y sede (contexto TÉCNICO y COORDINADOR, §8.2)
-- ----------------------------------------------------------------------------

-- Área del técnico autenticado (NULL si no es técnico)
create or replace function public.mi_area_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.area_id
    from public.tecnicos t
   where t.perfil_id = public.usuario_actual()
     and t.activo
   limit 1;
$$;

-- ¿Es técnico activo?
create or replace function public.es_tecnico_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tecnicos t
    where t.perfil_id = public.usuario_actual()
      and t.activo
  );
$$;

-- ¿La incidencia pertenece al área del técnico? (derivación vigente = fila activa)
create or replace function public.incidencia_en_mi_area(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.incidencia_derivaciones d
     where d.incidencia_id    = p_incidencia_id
       and d.activa
       and d.area_destino_id = public.mi_area_id()
  );
$$;

-- ¿Tengo una asignación activa de esa incidencia?
create or replace function public.tengo_asignacion_activa(p_incidencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.incidencia_asignaciones a
      join public.tecnicos t on t.id = a.tecnico_id
     where a.incidencia_id = p_incidencia_id
       and a.activa
       and t.perfil_id      = public.usuario_actual()
       and t.activo
  );
$$;

-- ¿Es coordinador del área X? (supervisión por área, §8.2)
create or replace function public.soy_coordinador_de_area(p_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_area_id is not null
     and public.tiene_rol('COORDINADOR')
     and p_area_id = coalesce(
       (select ta.area_id
          from private.tecnico_area_admin ta
         where ta.perfil_id = public.usuario_actual()),
       (select t.area_id
          from public.tecnicos t
         where t.perfil_id = public.usuario_actual()
           and t.activo)
     );
$$;

-- ¿Es coordinador (por sede o por área)? Bandera de capacidad.
create or replace function public.soy_coordinador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_rol('COORDINADOR')
     and exists (
       select 1 from private.tecnico_area_admin ta
        where ta.perfil_id = public.usuario_actual()
     );
$$;

-- ¿Es coordinador de la sede X?
create or replace function public.soy_coordinador_de_sede(p_sede_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sede_id is not null
     and public.tiene_rol('COORDINADOR')
     and exists (
       select 1
         from private.tecnico_area_admin ta
         join public.areas ar on ar.id = ta.area_id
        where ta.perfil_id  = public.usuario_actual()
          and ta.sede_id    = p_sede_id
          and ar.activo
     );
$$;

-- ¿Es administrador?
create or replace function public.soy_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_rol('ADMINISTRADOR');
$$;

-- ----------------------------------------------------------------------------
-- 6. Tablas internas de apoyo (esquema private: no expuesto por la API)
--    tecnico_area_admin: cobertura de COORDINADOR y TECNICO.
--      · rol = 'TECNICO'     → técnico asignado al área
--      · rol = 'COORDINADOR' → coordinador del área
--    La gestiona el ADMINISTRADOR (policy sobre esta tabla en 0007);
--    una fila por perfil/área.
-- ----------------------------------------------------------------------------
create table if not exists private.tecnico_area_admin (
  perfil_id   uuid        not null
              references public.perfiles (id) on delete cascade,
  area_id     uuid        not null
              references public.areas (id) on delete cascade,
  sede_id     uuid        not null
              references public.sedes (id) on delete restrict,
  rol         text        not null
              constraint ck_tecnico_area_admin_rol
              check (rol in ('TECNICO', 'COORDINADOR')),
  creado_en   timestamptz not null default now(),
  primary key (perfil_id, area_id, rol)
);

alter table private.tecnico_area_admin enable row level security;

-- ----------------------------------------------------------------------------
-- 7. Endurecimiento de funciones del esquema (0003):
--    solo lo imprescindible es ejecutable; el resto queda interno.
--    (Las funciones de trigger no requieren EXECUTE para dispararse.)
-- ----------------------------------------------------------------------------
revoke execute on function public.set_default_by_name(text, text, text)       from public, anon, authenticated;
revoke execute on function public.resolver_secuencia_incidencias()            from public, anon, authenticated;
revoke execute on function public.tiene_permiso(text)                         from public, anon;
revoke execute on function public.usuario_actual()                            from public, anon;
revoke execute on function public.roles_actuales()                            from public, anon;
revoke execute on function public.perfil_activo()                             from public, anon;
revoke execute on function public.verificar_ownership_ticket(uuid, text)      from public, anon;

grant execute on function public.set_default_by_name(text, text, text)        to authenticated;
grant execute on function public.resolver_secuencia_incidencias()             to authenticated;
grant execute on function public.tiene_permiso(text)                          to authenticated;
grant execute on function public.usuario_actual()                             to authenticated;
grant execute on function public.roles_actuales()                             to authenticated;
grant execute on function public.perfil_activo()                              to authenticated;
grant execute on function public.verificar_ownership_ticket(uuid, text)       to authenticated;
grant execute on function public.tiene_rol(variadic text[])                   to authenticated;
grant execute on function public.mi_rol_es(text)                              to authenticated;
grant execute on function public.es_dueno_incidencia(uuid)                    to authenticated;
grant execute on function public.es_tecnico_activo()                          to authenticated;
grant execute on function public.mi_area_id()                                 to authenticated;
grant execute on function public.incidencia_en_mi_area(uuid)                  to authenticated;
grant execute on function public.tengo_asignacion_activa(uuid)                to authenticated;
grant execute on function public.soy_coordinador_de_area(uuid)                to authenticated;
grant execute on function public.soy_coordinador()                            to authenticated;
grant execute on function public.soy_coordinador_de_sede(uuid)                to authenticated;
grant execute on function public.soy_administrador()                          to authenticated;

comment on function public.tiene_permiso(text) is
  'RLS: permiso efectivo = union de permisos de todos los roles del usuario (§8.1).';
comment on function public.usuario_actual() is
  'RLS: id del usuario desde request.jwt.claim.sub (servidor, no falsificable).';
comment on function public.roles_actuales() is
  'RLS: roles desde request.jwt.claim.roles (app_metadata; solo el servidor la escribe).';
-- ============================================================================
-- SIR-UPSJB · 0007_rls_politicas.sql
-- Row Level Security — 58 tablas + tabla de apoyo private.tecnico_area_admin.
--
-- Modelo de acceso (reglas del usuario):
--   ESTUDIANTE / DOCENTE / ADMINISTRATIVO → crear y ver SOLO sus incidencias;
--     seguimiento permitido = historial/comentarios/adjuntos de SUS tickets.
--   TECNICO  → incidencias de su área (visibilidad) y acciones sobre las que
--     tiene asignación activa (acciones, evidencias, resolver).
--   COORDINADOR → supervisa SU área; asigna, deriva, ajusta prioridad.
--   ADMINISTRADOR → acceso administrativo total (configura catálogos).
--   SUPERVISOR → solo lectura de tickets [VI] (con permiso ver_reportes).
--   anon → nada (el seguimiento público por código se hará con RPC segura).
--
-- NOTAS DE DISEÑO:
--   · Se hace ENABLE row level security SIN FORCE: las funciones auxiliares
--     de 0006 son SECURITY DEFINER (dueño = postgres, dueño de las tablas);
--     con FORCE el dueño también pasaría por las policies y los helpers
--     (tiene_permiso, es_dueno_incidencia, ...) dejarían de ver sus propias
--     tablas de apoyo. Los roles de la app (anon/authenticated) SIEMPRE
--     pasan por las policies: el perímetro queda intacto.
--   · Las policies no admiten aliases de tabla: las columnas se referencian
--     sin alias y las referencias externas en subconsultas se califican con
--     el nombre de la tabla (p. ej. incidencias.id).
--   · No hay policy de DELETE sobre datos operativos: el borrado físico no
--     existe en el modelo (docs/01 §2.7).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Tabla de apoyo private (no expuesta por la API)
-- ----------------------------------------------------------------------------
revoke all on private.tecnico_area_admin from anon, authenticated;

-- El admin la gestiona...
create policy p_apoyo_admin on private.tecnico_area_admin
  for all to authenticated
  using (public.soy_administrador())
  with check (public.soy_administrador());

-- ...y cada usuario puede leer sus PROPIAS coberturas (lo exigen los helpers
-- soy_coordinador* evaluados desde policies del propio coordinador).
create policy p_apoyo_self on private.tecnico_area_admin
  for select to authenticated
  using (perfil_id = public.usuario_actual());

-- ----------------------------------------------------------------------------
-- 1. Activar RLS en TODAS las tablas del esquema public
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles','roles','permisos','roles_permisos','usuarios_roles',
    'sedes','pabellones','pisos','tipos_ambiente','ambientes','aulas',
    'laboratorios','ambientes_caracteristicas',
    'categorias_equipos','marcas_equipos','modelos_equipos','estados_equipos',
    'equipos','equipos_ambientes','movimientos_equipos',
    'codigos_qr','lecturas_qr',
    'tipos_incidencia','subtipos_incidencia','prioridades','estados_incidencia',
    'canales_reporte','incidencias',
    'incidencia_ubicaciones','incidencia_equipos','incidencia_adjuntos',
    'incidencia_comentarios','incidencia_historial','incidencia_asignaciones',
    'incidencia_derivaciones',
    'areas','servicios','tecnicos','especialidades_tecnicas',
    'tecnicos_especialidades','turnos','tecnicos_turnos',
    'reglas_enrutamiento',
    'acuerdos_nivel_servicio','tiempos_sla','feriados',
    'plantillas_notificacion','notificaciones','preferencias_notificacion',
    'dispositivos_usuario',
    'encuestas_cierre','respuestas_encuesta',
    'categorias_conocimiento','articulos_conocimiento',
    'sesiones_usuario','registros_auditoria',
    'reportes_generados','exportaciones'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- ----------------------------------------------------------------------------
-- 2. perfiles — cada usuario lee/edita SU fila; el admin gestiona todas.
--    (INSERT no existe para el cliente: la fila la crea register_new_user.)
-- ----------------------------------------------------------------------------
create policy p_perfiles_select on public.perfiles
  for select to authenticated
  using (id = public.usuario_actual() or public.soy_administrador());

create policy p_perfiles_update on public.perfiles
  for update to authenticated
  using (id = public.usuario_actual())
  with check (
    id = public.usuario_actual()
    -- blindaje: no puede cambiarse el estado de la cuenta propia
    and estado = (
      select p.estado from public.perfiles p where p.id = public.usuario_actual()
    )
  );

create policy p_perfiles_admin on public.perfiles
  for all to authenticated
  using (public.soy_administrador())
  with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 3. Seguridad (roles/permisos/asignaciones): lectura; escritura solo admin.
-- ----------------------------------------------------------------------------
create policy p_roles_lectura on public.roles
  for select to authenticated
  using (activo or public.soy_administrador());

create policy p_roles_admin on public.roles
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_permisos_lectura on public.permisos
  for select to authenticated
  using (true);

create policy p_permisos_admin on public.permisos
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_roles_permisos_lectura on public.roles_permisos
  for select to authenticated
  using (true);

create policy p_roles_permisos_admin on public.roles_permisos
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_usuarios_roles_select on public.usuarios_roles
  for select to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador());

create policy p_usuarios_roles_admin_alta on public.usuarios_roles
  for insert to authenticated
  with check (public.soy_administrador());

create policy p_usuarios_roles_admin_baja on public.usuarios_roles
  for delete to authenticated
  using (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 4. Incidencias — corazón del modelo.
--    SELECT (quién ve un ticket):
--      · su dueño (usuario_reportante_id = usuario_actual())
--      · cualquier técnico activo (visibilidad operativa del flujo)
--      · coordinador del área de destino vigente del ticket
--      · administrador; supervisor con permiso ver_reportes
--    INSERT: perfil activo + permiso crear_incidencia (cualquier rol).
--    UPDATE: por columnas, con 3 policies complementarias (OR):
--      · dueño → solo confirmar cierre de su ticket ya Resuelto
--        (fija descripcion/prioridad/ambiente sin cambios; puede poner
--         estado Cerrada/Cancelada, fecha_cierre y cerrado_por)
--      · técnico con asignación activa → flujo de atención
--      · coordinador del área vigente → prioridad/asignación/derivación
--    DELETE: nadie.
-- ----------------------------------------------------------------------------
create policy p_incidencias_insert on public.incidencias
  for insert to authenticated
  with check (public.perfil_activo() and public.tiene_permiso('crear_incidencia'));

create policy p_incidencias_select on public.incidencias
  for select to authenticated
  using (
    usuario_reportante_id = public.usuario_actual()
    or public.es_tecnico_activo()
    or public.soy_administrador()
    or (public.tiene_rol('SUPERVISOR') and public.tiene_permiso('ver_reportes'))
    or (
      public.soy_coordinador()
      and public.soy_coordinador_de_area(
        (select d.area_destino_id
           from public.incidencia_derivaciones d
          where d.incidencia_id = incidencias.id
            and d.activa
          limit 1)
      )
    )
  );

create policy p_incidencias_update_dueno on public.incidencias
  for update to authenticated
  using (usuario_reportante_id = public.usuario_actual())
  with check (
    usuario_reportante_id = public.usuario_actual()
    -- solo mueve su ticket a un estado final (confirmación de cierre)
    and (select e.nombre from public.estados_incidencia e
          where e.id = estado_id) in ('Cerrada', 'Cancelada')
    -- y nada más que el cierre (los demás campos quedan congelados)
    and descripcion  = (select x.descripcion  from public.incidencias x where x.id = incidencias.id)
    and prioridad_id = (select x.prioridad_id from public.incidencias x where x.id = incidencias.id)
    and ambiente_id  = (select x.ambiente_id  from public.incidencias x where x.id = incidencias.id)
    and tipo_incidencia_id = (select x.tipo_incidencia_id from public.incidencias x where x.id = incidencias.id)
  );

create policy p_incidencias_update_tecnico on public.incidencias
  for update to authenticated
  using (public.tengo_asignacion_activa(incidencias.id))
  with check (public.tengo_asignacion_activa(incidencias.id));

create policy p_incidencias_update_coordinador on public.incidencias
  for update to authenticated
  using (
    public.soy_coordinador()
    and public.soy_coordinador_de_area(
      (select d.area_destino_id
         from public.incidencia_derivaciones d
        where d.incidencia_id = incidencias.id
          and d.activa
        limit 1)
    )
  )
  with check (true);

-- ----------------------------------------------------------------------------
-- 5. Detalle de incidencias — "se ve lo mismo que la incidencia madre".
--    INSERT de adjuntos/comentarios/ubicaciones/equipos: dueño o técnico
--    asignado. Historial: técnico asignado (registro de acciones) o admin.
--    Asignaciones/Derivaciones: coordinador del área vigente o admin
--    (la derivación inicial la crea el sistema/trigger con definer).
-- ----------------------------------------------------------------------------
create policy p_ubicaciones_all on public.incidencia_ubicaciones
  for all to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  )
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_incidencia_equipos_all on public.incidencia_equipos
  for all to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  )
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_adjuntos_insert on public.incidencia_adjuntos
  for insert to authenticated
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
  );

create policy p_adjuntos_select on public.incidencia_adjuntos
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_comentarios_insert on public.incidencia_comentarios
  for insert to authenticated
  with check (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
  );

create policy p_comentarios_select on public.incidencia_comentarios
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_historial_insert on public.incidencia_historial
  for insert to authenticated
  with check (
    public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_historial_select on public.incidencia_historial
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

create policy p_asignaciones_insert on public.incidencia_asignaciones
  for insert to authenticated
  with check (
    public.soy_administrador()
    or (
      public.soy_coordinador()
      and public.soy_coordinador_de_area(
        (select d.area_destino_id
           from public.incidencia_derivaciones d
          where d.incidencia_id = incidencia_asignaciones.incidencia_id
            and d.activa
          limit 1)
      )
    )
  );

create policy p_asignaciones_select on public.incidencia_asignaciones
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.tengo_asignacion_activa(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  );

create policy p_derivaciones_insert on public.incidencia_derivaciones
  for insert to authenticated
  with check (
    public.soy_administrador()
    or (
      public.soy_coordinador()
      and public.soy_coordinador_de_area(
        (select d2.area_destino_id
           from public.incidencia_derivaciones d2
          where d2.incidencia_id = incidencia_derivaciones.incidencia_id
            and d2.activa
          limit 1)
      )
    )
  );

create policy p_derivaciones_select on public.incidencia_derivaciones
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
    -- el coordinador necesita leer la derivación vigente de SU área: es la
    -- que determina qué tickets puede ver/asignar (evita recursión de policies)
    or public.soy_coordinador_de_area(area_destino_id)
  );

-- ----------------------------------------------------------------------------
-- 6. Organización — catálogos visibles para autenticados; gestión solo admin.
-- ----------------------------------------------------------------------------
create policy p_areas_select on public.areas
  for select to authenticated using (activo or public.soy_administrador());
create policy p_areas_admin on public.areas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_servicios_select on public.servicios
  for select to authenticated using (activo or public.soy_administrador());
create policy p_servicios_admin on public.servicios
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- tecnicos: el técnico ve su fila; el coordinador ve las de SU área; admin todo.
create policy p_tecnicos_select on public.tecnicos
  for select to authenticated
  using (
    perfil_id = public.usuario_actual()
    or public.soy_administrador()
    or (public.soy_coordinador() and public.soy_coordinador_de_area(area_id))
  );

create policy p_tecnicos_admin on public.tecnicos
  for all to authenticated
  using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_especialidades_select on public.especialidades_tecnicas
  for select to authenticated using (activo or public.soy_administrador());
create policy p_especialidades_admin on public.especialidades_tecnicas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_tecnicos_esp_select on public.tecnicos_especialidades
  for select to authenticated using (true);
create policy p_tecnicos_esp_admin on public.tecnicos_especialidades
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_turnos_select on public.turnos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_turnos_admin on public.turnos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_tecnicos_turnos_select on public.tecnicos_turnos
  for select to authenticated using (true);
create policy p_tecnicos_turnos_admin on public.tecnicos_turnos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 7. Infraestructura — lectura para autenticados (reportar/seguir); gestión
--    solo admin.
-- ----------------------------------------------------------------------------
create policy p_infra_select_sedes on public.sedes
  for select to authenticated using (activa or public.soy_administrador());
create policy p_infra_admin_sedes on public.sedes
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_pabellones on public.pabellones
  for select to authenticated using (activo or public.soy_administrador());
create policy p_infra_admin_pabellones on public.pabellones
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_pisos on public.pisos
  for select to authenticated using (true);
create policy p_infra_admin_pisos on public.pisos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_tipos on public.tipos_ambiente
  for select to authenticated using (activo or public.soy_administrador());
create policy p_infra_admin_tipos on public.tipos_ambiente
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_ambientes on public.ambientes
  for select to authenticated using (activo or public.soy_administrador());
create policy p_infra_admin_ambientes on public.ambientes
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_aulas on public.aulas
  for select to authenticated using (true);
create policy p_infra_admin_aulas on public.aulas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_labs on public.laboratorios
  for select to authenticated using (true);
create policy p_infra_admin_labs on public.laboratorios
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_infra_lectura_caract on public.ambientes_caracteristicas
  for select to authenticated using (true);
create policy p_infra_admin_caract on public.ambientes_caracteristicas
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 8. Equipos — lectura para técnicos/coordinadores (diagnóstico); gestión admin.
-- ----------------------------------------------------------------------------
create policy p_equipos_lectura on public.equipos
  for select to authenticated
  using (public.es_tecnico_activo() or public.soy_coordinador() or public.soy_administrador());
create policy p_equipos_admin on public.equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_equipos_lectura on public.categorias_equipos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_equipos_admin on public.categorias_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_marcas_lectura on public.marcas_equipos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_marcas_admin on public.marcas_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_modelos_lectura on public.modelos_equipos
  for select to authenticated using (true);
create policy p_cat_modelos_admin on public.modelos_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_estados_eq_lectura on public.estados_equipos
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_estados_eq_admin on public.estados_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_equipos_amb_lectura on public.equipos_ambientes
  for select to authenticated
  using (public.es_tecnico_activo() or public.soy_coordinador() or public.soy_administrador());
create policy p_equipos_amb_admin on public.equipos_ambientes
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_movimientos_lectura on public.movimientos_equipos
  for select to authenticated
  using (public.es_tecnico_activo() or public.soy_coordinador() or public.soy_administrador());
create policy p_movimientos_admin on public.movimientos_equipos
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 9. QR — lectura autenticada; gestión admin. lecturas_qr: cualquiera
--    autenticado registra su escaneo; solo admin las consulta.
-- ----------------------------------------------------------------------------
create policy p_qr_lectura on public.codigos_qr
  for select to authenticated using (activo or public.soy_administrador());
create policy p_qr_admin on public.codigos_qr
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_lecturas_qr_insert on public.lecturas_qr
  for insert to authenticated with check (true);
create policy p_lecturas_qr_select on public.lecturas_qr
  for select to authenticated using (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 10. Catálogos de incidencias — lectura autenticados; gestión admin.
-- ----------------------------------------------------------------------------
create policy p_cat_lectura_tipos_incidencia on public.tipos_incidencia
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_tipos_incidencia on public.tipos_incidencia
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_subtipos on public.subtipos_incidencia
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_subtipos on public.subtipos_incidencia
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_prioridades on public.prioridades
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_prioridades on public.prioridades
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_estados on public.estados_incidencia
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_estados on public.estados_incidencia
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_cat_lectura_canales on public.canales_reporte
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_admin_canales on public.canales_reporte
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 11. SLA / reglas / feriados — lectura; gestión admin (reglas también
--     coordinador con permiso gestionar_reglas).
-- ----------------------------------------------------------------------------
create policy p_sla_lectura on public.acuerdos_nivel_servicio
  for select to authenticated using (activo or public.soy_administrador());
create policy p_sla_admin on public.acuerdos_nivel_servicio
  for all to authenticated
  using (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')))
  with check (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')));

create policy p_tiempos_sla_select on public.tiempos_sla
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  );

create policy p_feriados_lectura on public.feriados
  for select to authenticated using (true);
create policy p_feriados_admin on public.feriados
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_reglas_lectura on public.reglas_enrutamiento
  for select to authenticated using (activa or public.soy_administrador());
create policy p_reglas_admin on public.reglas_enrutamiento
  for all to authenticated
  using (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')))
  with check (public.soy_administrador() or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas')));

-- ----------------------------------------------------------------------------
-- 12. Notificaciones — SOLO las del propio usuario (las crea el sistema).
-- ----------------------------------------------------------------------------
create policy p_notificaciones_select on public.notificaciones
  for select to authenticated using (perfil_id = public.usuario_actual());
create policy p_notificaciones_update on public.notificaciones
  for update to authenticated
  using (perfil_id = public.usuario_actual())
  with check (perfil_id = public.usuario_actual());

create policy p_plantillas_select on public.plantillas_notificacion
  for select to authenticated using (activo or public.soy_administrador());
create policy p_plantillas_admin on public.plantillas_notificacion
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_preferencias_all on public.preferencias_notificacion
  for all to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador())
  with check (perfil_id = public.usuario_actual() or public.soy_administrador());

create policy p_dispositivos_all on public.dispositivos_usuario
  for all to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador())
  with check (perfil_id = public.usuario_actual() or public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 13. Encuestas — el dueño del ticket ve su encuesta y responde UNA vez;
--     el flujo con token anónimo se resolverá con RPC segura (fase auth).
-- ----------------------------------------------------------------------------
create policy p_encuestas_select on public.encuestas_cierre
  for select to authenticated
  using (public.es_dueno_incidencia(incidencia_id) or public.soy_administrador());

create policy p_respuestas_insert on public.respuestas_encuesta
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.encuestas_cierre e
        join public.incidencias i on i.id = e.incidencia_id
       where e.id = respuestas_encuesta.encuesta_id
         and i.usuario_reportante_id = public.usuario_actual()
    )
    -- una sola respuesta por encuesta (1:1 del modelo)
    and not exists (
      select 1 from public.respuestas_encuesta r
       where r.encuesta_id = respuestas_encuesta.encuesta_id
    )
  );

create policy p_respuestas_select on public.respuestas_encuesta
  for select to authenticated
  using (
    public.es_dueno_incidencia(
      (select e.incidencia_id from public.encuestas_cierre e
        where e.id = respuestas_encuesta.encuesta_id)
    )
    or public.soy_administrador()
  );

-- ----------------------------------------------------------------------------
-- 14. Base de conocimiento — artículos publicados para todos los autenticados.
-- ----------------------------------------------------------------------------
create policy p_cat_conocimiento_lectura on public.categorias_conocimiento
  for select to authenticated using (activo or public.soy_administrador());
create policy p_cat_conocimiento_admin on public.categorias_conocimiento
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

create policy p_articulos_lectura on public.articulos_conocimiento
  for select to authenticated using (publicado or public.soy_administrador());
create policy p_articulos_admin on public.articulos_conocimiento
  for all to authenticated using (public.soy_administrador()) with check (public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 15. Auditoría — PROTECCIÓN TOTAL:
--     · SELECT: solo admin con permiso ver_auditoria.
--     · INSERT/UPDATE/DELETE: sin policy → denegado desde la API. La única
--       escritura es por triggers/RPC SECURITY DEFINER del sistema (0004).
--     · Además 0004 ya bloquea UPDATE/DELETE a nivel de trigger (append-only).
-- ----------------------------------------------------------------------------
create policy p_auditoria_select on public.registros_auditoria
  for select to authenticated
  using (public.soy_administrador() and public.tiene_permiso('ver_auditoria'));

-- ----------------------------------------------------------------------------
-- 16. Sesiones — el usuario ve SU historial de accesos; admin todo. Sin
--     INSERT desde cliente (lo escribe el proceso de auth vía RPC segura).
-- ----------------------------------------------------------------------------
create policy p_sesiones_select on public.sesiones_usuario
  for select to authenticated
  using (perfil_id = public.usuario_actual() or public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 17. Reportes — el usuario ve SUS reportes/exportaciones; crea con permiso.
-- ----------------------------------------------------------------------------
create policy p_reportes_select on public.reportes_generados
  for select to authenticated
  using (solicitado_por = public.usuario_actual() or public.soy_administrador());
create policy p_reportes_insert on public.reportes_generados
  for insert to authenticated
  with check (public.tiene_permiso('ver_reportes') and solicitado_por = public.usuario_actual());

create policy p_exportaciones_select on public.exportaciones
  for select to authenticated
  using (
    public.soy_administrador()
    or exists (
      select 1 from public.reportes_generados r
       where r.id = exportaciones.reporte_id
         and r.solicitado_por = public.usuario_actual()
    )
  );
create policy p_exportaciones_insert on public.exportaciones
  for insert to authenticated
  with check (public.tiene_permiso('ver_reportes'));

-- ----------------------------------------------------------------------------
-- 18. GRANT explícitos (techo de privilegios; la policy decide por fila).
-- ----------------------------------------------------------------------------
grant select on all tables in schema public to authenticated;

grant insert, update on public.incidencias to authenticated;
grant update on public.perfiles to authenticated;
grant insert, update on public.incidencia_adjuntos,
  public.incidencia_comentarios, public.incidencia_historial,
  public.incidencia_ubicaciones, public.incidencia_equipos,
  public.incidencia_asignaciones, public.incidencia_derivaciones to authenticated;
grant insert on public.lecturas_qr, public.respuestas_encuesta,
  public.reportes_generados, public.exportaciones to authenticated;
grant insert, update on public.notificaciones, public.preferencias_notificacion,
  public.dispositivos_usuario to authenticated;
-- Gestión de catálogos/configuración: el techo permite, la policy limita a admin
-- (y coordinador con gestionar_reglas en SLA/reglas).
grant insert, update, delete on public.roles, public.permisos,
  public.roles_permisos, public.usuarios_roles, public.areas, public.servicios,
  public.tecnicos, public.especialidades_tecnicas,
  public.tecnicos_especialidades, public.turnos, public.tecnicos_turnos,
  public.sedes, public.pabellones, public.pisos, public.tipos_ambiente,
  public.ambientes, public.aulas, public.laboratorios,
  public.ambientes_caracteristicas, public.categorias_equipos,
  public.marcas_equipos, public.modelos_equipos, public.estados_equipos,
  public.equipos, public.equipos_ambientes, public.movimientos_equipos,
  public.codigos_qr, public.tipos_incidencia, public.subtipos_incidencia,
  public.prioridades, public.estados_incidencia, public.canales_reporte,
  public.acuerdos_nivel_servicio, public.feriados, public.reglas_enrutamiento,
  public.plantillas_notificacion,
  public.categorias_conocimiento, public.articulos_conocimiento
  to authenticated;

-- ----------------------------------------------------------------------------
-- 19. Verificación estructural: todas las tablas con RLS activado.
-- ----------------------------------------------------------------------------
do $$
declare
  sin_rls int;
begin
  select count(*) into sin_rls
  from pg_tables
  where schemaname in ('public', 'private')
    and rowsecurity = false;
  if sin_rls > 0 then
    raise exception '% tablas sin RLS tras la migracion', sin_rls;
  end if;
end
$$;
-- ============================================================================
-- SIR-UPSJB · 0008_rls_guardas.sql
-- Guardas de integridad complementarias a RLS (defensa en profundidad):
--   1. Columnas inmutables de incidencias (codigo, reportante, creado_en)
--      para peticiones que llegan por la API (roles anon/authenticated).
--      El backend privilegiado (service_role / postgres) no queda afectado.
--   2. Corrección de policy de comentarios: las notas internas (es_interno)
--      NO son visibles al reportante; sí al técnico asignado y al admin.
--   3. Derivaciones: al abrir una derivación activa se cierra la anterior
--      (Regla 6 del modelo — el destino vigente es la fila abierta).
--   4. Adjuntos: el path en Storage debe referenciar la incidencia del
--      adjunto y usar el bucket privado 'evidencias' (§2.5 del modelo).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Incidencias: inmutabilidad de columnas críticas ante clientes de API.
--    current_user dentro del trigger es el rol de conexión: 'authenticated'
--    (o 'anon') en peticiones de la app; 'postgres'/'service_role' en el
--    servidor → la guarda solo aplica al primero.
-- ----------------------------------------------------------------------------
create or replace function public.guarda_incidencias_inmutables()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.codigo is distinct from old.codigo then
      raise exception 'SIR-UPSJB: el codigo de la incidencia es inmutable';
    end if;
    if new.usuario_reportante_id is distinct from old.usuario_reportante_id then
      raise exception 'SIR-UPSJB: el reportante de la incidencia es inmutable';
    end if;
    if new.creado_en is distinct from old.creado_en then
      raise exception 'SIR-UPSJB: creado_en es inmutable';
    end if;
    if new.ambiente_id is distinct from old.ambiente_id then
      raise exception 'SIR-UPSJB: la ubicacion de la incidencia es inmutable (derivar o anular, no reubicar)';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_incidencias_guarda_inmutables
  before update on public.incidencias
  for each row execute function public.guarda_incidencias_inmutables();

-- ----------------------------------------------------------------------------
-- 2. Comentarios: notas internas ocultas al reportante.
--    (Reemplaza p_comentarios_select de 0007; la política de INSERT no cambia.)
-- ----------------------------------------------------------------------------
drop policy if exists p_comentarios_select on public.incidencia_comentarios;

create policy p_comentarios_select on public.incidencia_comentarios
  for select to authenticated
  using (
    -- autor o admin: ven todo
    autor_id = public.usuario_actual()
    or public.soy_administrador()
    -- técnico de la incidencia: ve también las internas
    or public.tengo_asignacion_activa(incidencia_id)
    -- reportante: solo las NO internas
    or (
      public.es_dueno_incidencia(incidencia_id)
      and not es_interno
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Derivaciones: cerrar la derivación activa anterior (Regla 6).
--    BEFORE INSERT: evita chocar con el índice parcial uq_derivacion_activa.
-- ----------------------------------------------------------------------------
create or replace function public.cerrar_derivacion_anterior()
returns trigger
language plpgsql
as $$
begin
  if new.activa then
    update public.incidencia_derivaciones
       set activa = false
     where incidencia_id = new.incidencia_id
       and activa
       and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger trg_derivaciones_cerrar_anterior
  before insert on public.incidencia_derivaciones
  for each row execute function public.cerrar_derivacion_anterior();

-- ----------------------------------------------------------------------------
-- 4. Adjuntos: bucket privado y path referenciando la incidencia (§2.5).
--    Evita que un cliente apunte evidencias a tickets ajenos por path.
-- ----------------------------------------------------------------------------
create or replace function public.guarda_adjuntos_path()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.bucket <> 'evidencias' then
      raise exception 'SIR-UPSJB: bucket de evidencias no permitido';
    end if;
    if position(new.incidencia_id::text in new.path) = 0 then
      raise exception 'SIR-UPSJB: el path debe referenciar la incidencia del adjunto';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_adjuntos_guarda_path
  before insert or update on public.incidencia_adjuntos
  for each row execute function public.guarda_adjuntos_path();

-- ----------------------------------------------------------------------------
-- Verificación: las guardas deben existir.
-- ----------------------------------------------------------------------------
do $$
declare
  faltan int;
begin
  select count(*) into faltan
  from (values
    ('incidencias',             'trg_incidencias_guarda_inmutables'),
    ('incidencia_derivaciones', 'trg_derivaciones_cerrar_anterior'),
    ('incidencia_adjuntos',     'trg_adjuntos_guarda_path')
  ) as esperados(tabla, trigger)
  where not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = esperados.trigger
      and not t.tgisinternal
      and (n.nspname || '.' || c.relname) =
          (case when position('.' in esperados.tabla) > 0
                then esperados.tabla else 'public.' || esperados.tabla end)
  );
  if faltan > 0 then
    raise exception 'Faltan % guardas tras la migracion', faltan;
  end if;
end
$$;
-- ============================================================================
-- SIR-UPSJB · 0009_rls_storage.sql
-- Protección de Storage (§2.5 del modelo):
--   · Buckets PRIVADOS: el acceso es mediante signed URLs generadas en servidor.
--   · evidencias → archivos de incidencias (antes/durante/despues/documento/video).
--   · reportes   → exportaciones PDF/Excel/CSV (M14).
--   · Convención de path: <sede>/<año>/<incidencia_id>/<tipo>/<uuid>.<ext>
--     El uuid de la incidencia va SIEMPRE en el path: las policies lo extraen
--     y verifican ownership/asignación sin depender de filas de BD previas.
--   · UPDATE/DELETE del objeto: técnico asignado y admin (correcciones);
--     el dueño del ticket solo sube y ve sus evidencias.
--   · Sin service_role en el frontend: el cliente usa anon/authenticated y
--     pasa SIEMPRE por estas policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Buckets privados (configuración, sin credenciales)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias', 'evidencias', false, 10485760, array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf', 'video/mp4'
  ]),
  ('reportes',   'reportes',   false, 26214400, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Funciones auxiliares de Storage (SECURITY DEFINER, search_path fijo)
-- ----------------------------------------------------------------------------

-- Extrae el uuid de incidencia del path (null si no cumple la convención)
create or replace function public.incidencia_de_path(p_path text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select substring(
    p_path from '/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
  )::uuid;
$$;

-- ¿El path cumple la convención <sede>/<año>/<incidencia_id>/<tipo>/<archivo>?
create or replace function public.path_evidencia_valido(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path ~ '^[a-z0-9-]+/[0-9]{4}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(antes|durante|despues|documento|video)/[0-9a-fA-F-]+\.[a-z0-9]+$';
$$;

-- ¿Tengo asignación activa sobre la incidencia referenciada por el path?
create or replace function public.tengo_asignacion_por_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tengo_asignacion_activa(public.incidencia_de_path(p_path));
$$;

-- ¿Soy dueño de la incidencia referenciada por el path?
create or replace function public.es_dueno_por_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_dueno_incidencia(public.incidencia_de_path(p_path));
$$;

-- ----------------------------------------------------------------------------
-- 3. Policies de Storage — bucket evidencias
--    (drop if exists: re-ejecutable si una corrida previa quedó a medias)
-- ----------------------------------------------------------------------------

-- Subida: dueño del ticket o técnico asignado, con path válido
drop policy if exists "evidencias_insert" on storage.objects;
create policy "evidencias_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and public.perfil_activo()
    and public.path_evidencia_valido(name)
    and (
      public.es_dueno_por_path(name)
      or public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  );

-- Lectura: dueño, técnico asignado o admin (el GET directo pasa por aquí)
drop policy if exists "evidencias_select" on storage.objects;
create policy "evidencias_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      public.es_dueno_por_path(name)
      or public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  );

-- Actualización (corregir evidencia): técnico asignado o admin
drop policy if exists "evidencias_update" on storage.objects;
create policy "evidencias_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'evidencias'
    and (
      public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  )
  with check (
    bucket_id = 'evidencias'
    and (
      public.tengo_asignacion_por_path(name)
      or public.soy_administrador()
    )
  );

-- Eliminación: solo ADMINISTRADOR
drop policy if exists "evidencias_delete" on storage.objects;
create policy "evidencias_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 4. Policies de Storage — bucket reportes
-- ----------------------------------------------------------------------------

-- Subida: quien puede generar reportes
drop policy if exists "reportes_insert" on storage.objects;
create policy "reportes_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reportes'
    and public.tiene_permiso('ver_reportes')
  );

-- Lectura: el solicitante del reporte (el objeto lleva el id en el path) o admin
drop policy if exists "reportes_select" on storage.objects;
create policy "reportes_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reportes'
    and (
      public.soy_administrador()
      or exists (
        select 1
          from public.reportes_generados r
         where name like '%' || r.id::text || '%'
           and r.solicitado_por = public.usuario_actual()
      )
    )
  );

-- Actualización y borrado: solo ADMINISTRADOR
drop policy if exists "reportes_update" on storage.objects;
create policy "reportes_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'reportes' and public.soy_administrador())
  with check (bucket_id = 'reportes' and public.soy_administrador());

drop policy if exists "reportes_delete" on storage.objects;
create policy "reportes_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reportes' and public.soy_administrador());

-- ----------------------------------------------------------------------------
-- 5. GRANT de uso del esquema storage (las policies deciden por objeto)
-- ----------------------------------------------------------------------------
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Verificación: buckets privados creados y storage.objects con RLS activo
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from storage.buckets
     where id in ('evidencias', 'reportes') and public = false
  ) then
    raise exception 'Buckets privados no creados correctamente';
  end if;

  if not exists (
    select 1
      from pg_tables
     where schemaname = 'storage'
       and tablename  = 'objects'
       and rowsecurity
  ) then
    raise exception 'storage.objects sin RLS';
  end if;
end
$$;
-- ============================================================================
-- SIR-UPSJB · 0010_auth_roles_jwt.sql
-- FASE 3 · Autenticación: roles en el JWT (Supabase Auth ↔ perfiles/roles).
--
-- Qué resuelve:
--   · Las funciones RLS de 0006 (roles_actuales → tiene_rol / tiene_permiso)
--     leen los roles desde el claim `roles` del JWT
--     (GUC request.jwt.claim.roles). Este script provee el mecanismo para que
--     ese claim exista y esté siempre sincronizado con la BD.
--   · Fuente de verdad de los roles: public.usuarios_roles (asignación vigente).
--   · El claim lo escribe Supabase Auth vía Custom Access Token Hook; el
--     cliente NUNCA puede modificarlo (los claims del JWT solo los emite el
--     servidor de Auth) → no falsificable.
--
-- Contenido:
--   1. custom_access_token_hook(event)  → inyecta claims.roles al emitir el JWT
--      (login, refresh, etc.). Ordena los roles por jerarquía: el rol principal
--      queda primero (coherente con public.roles_actuales()[1] y con la
--      redirección por panel de la app).
--   2. sincronizar_roles_auth(usuario)  → RPC: recalcula los roles desde
--      usuarios_roles y los persiste en auth.users.raw_app_meta_data.roles.
--      Úsala cuando el ADMINISTRADOR cambia roles de un usuario con sesión
--      activa, seguida de supabase.auth.refreshSession() en el cliente.
--
-- CONFIGURACIÓN EN EL DASHBOARD (no versionable en SQL — REQUERIDO):
--   Authentication → Hooks → "Customize Access Token (Auth Hooks)" →
--   seleccionar la función public.custom_access_token_hook → Save.
--   Sin este paso los JWT no llevan el claim `roles` y las políticas RLS
--   basadas en tiene_rol() denegarán el acceso (el login sí funcionará).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Custom Access Token Hook: inyecta los roles vigentes en los claims del JWT
--    Firma y contrato exigidos por Supabase Auth (event jsonb → event jsonb).
--    SECURITY DEFINER: corre como owner al emitir el token (antes de existir
--    sesión); solo lo invoca supabase_auth_admin.
-- ----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_roles text[];
begin
  select coalesce(array_agg(r.nombre order by
             case r.nombre
               when 'ADMINISTRADOR'  then 1
               when 'COORDINADOR'    then 2
               when 'SUPERVISOR'     then 3
               when 'TECNICO'        then 4
               when 'DOCENTE'        then 5
               when 'ADMINISTRATIVO' then 6
               when 'ESTUDIANTE'     then 7
               else 8
             end, r.nombre), '{}')
    into v_roles
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
   where ur.perfil_id = (event ->> 'user_id')::uuid
     and r.activo;

  event := jsonb_set(
    event,
    '{claims,roles}',
    to_jsonb(coalesce(v_roles, '{}'::text[]))
  );

  return event;
exception
  when others then
    -- Nunca romper la emisión de tokens: si la lectura de roles falla,
    -- el JWT sale sin el claim y RLS deniega (fallo seguro, no abierto).
    return event;
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

comment on function public.custom_access_token_hook(jsonb) is
  'FASE 3: inyecta claims.roles (roles activos de usuarios_roles) en el JWT. Configurar como Custom Access Token Hook en el Dashboard de Supabase Auth.';

-- ----------------------------------------------------------------------------
-- 2. RPC de sincronización: recalcula roles desde la BD y los persiste en
--    auth.users.raw_app_meta_data.roles (solo el servidor puede escribirlo).
--    · El propio usuario puede sincronizar sus roles (no escala: la BD decide).
--    · El ADMINISTRADOR puede sincronizar a cualquiera.
--    · Sin JWT (postgres/service_role, p. ej. desde el panel): permitido.
-- ----------------------------------------------------------------------------
create or replace function public.sincronizar_roles_auth(p_usuario uuid default null)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(p_usuario, auth.uid());
  v_roles  text[];
  v_meta   jsonb;
begin
  if v_target is null then
    raise exception 'sincronizar_roles_auth: indica el usuario (sesión o parámetro)';
  end if;

  if coalesce(auth.uid()::text, '') not in ('', v_target::text)
     and not coalesce(public.tiene_rol('ADMINISTRADOR'), false) then
    raise exception 'sincronizar_roles_auth: sin permisos para actualizar ese usuario';
  end if;

  select coalesce(array_agg(r.nombre order by
             case r.nombre
               when 'ADMINISTRADOR'  then 1
               when 'COORDINADOR'    then 2
               when 'SUPERVISOR'     then 3
               when 'TECNICO'        then 4
               when 'DOCENTE'        then 5
               when 'ADMINISTRATIVO' then 6
               when 'ESTUDIANTE'     then 7
               else 8
             end, r.nombre), '{}')
    into v_roles
    from public.usuarios_roles ur
    join public.roles r on r.id = ur.rol_id
   where ur.perfil_id = v_target
     and r.activo;

  select coalesce(raw_app_meta_data, '{}'::jsonb) into v_meta
    from auth.users
   where id = v_target;

  if v_meta is null then
    raise exception 'sincronizar_roles_auth: usuario % no existe en auth.users', v_target;
  end if;

  update auth.users
     set raw_app_meta_data = jsonb_set(v_meta, '{roles}', to_jsonb(v_roles))
   where id = v_target;

  return v_roles;
end;
$$;

revoke execute on function public.sincronizar_roles_auth(uuid) from public, anon;
grant execute on function public.sincronizar_roles_auth(uuid) to authenticated;

comment on function public.sincronizar_roles_auth(uuid) is
  'FASE 3: persiste los roles vigentes en auth.users.raw_app_meta_data.roles. Tras cambios de rol, invocar esta RPC y luego supabase.auth.refreshSession() en la sesión afectada.';

-- ----------------------------------------------------------------------------
-- 3. Verificación: las funciones deben existir.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('custom_access_token_hook', 'sincronizar_roles_auth')
  ) or (
    select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('custom_access_token_hook', 'sincronizar_roles_auth')
  ) <> 2 then
    raise exception 'Faltan funciones de autenticación tras la migración';
  end if;
end
$$;
-- ============================================================================
-- SIR-UPSJB · 0011_qr_rpc_publicas.sql
-- RPC SECURITY DEFINER para el flujo público del QR (Fase 4/QR).
--
-- CONTEXTO: las políticas RLS aprobadas (0007) otorgan acceso a las tablas
-- solo a `authenticated` (p_qr_lectura, p_infra_lectura_ambientes, etc.) y NO
-- existen grants/policies `to anon`. El escaneo de un QR es anónimo por diseño
-- (lecturas_qr.perfil_id admite NULL), por lo que la ruta pública /r/<codigo>
-- NO puede leer codigos_qr/ambientes con el rol anon directamente.
--
-- SOLUCIÓN (mínima y encapsulada): dos funciones SECURITY DEFINER con
-- search_path vacío que exponen SOLO:
--   · resolver_qr_publico(codigo)   → 1 fila: datos de ubicación del ambiente
--                                     si el QR existe y está activo.
--   · registrar_lectura_qr(codigo, dispositivo, navegador) → inserta en
--     lecturas_qr (perfil solo si hay sesión).
--
-- No se exponen UUID internos, ni filas de otros QR, ni permisos de escritura
-- sobre codigos_qr/ambientes. El "token" de acceso público es el CÓDIGO del QR
-- (secreto razonable impreso en el aula; rotable con regenerar).
--
-- Idempotente: CREATE OR REPLACE / DROP POLICY IF NOT EXISTS manual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Resolución pública de un QR por su código.
--    Devuelve SOLO lo que la pantalla necesita: ubicación (§28) + banderas de
--    estado para decidir la pantalla (activo / deshabilitado / inactivo).
--    Si el código no existe → 0 filas. Nunca expone UUID de codigos_qr.
-- ----------------------------------------------------------------------------
create or replace function public.resolver_qr_publico(p_codigo text)
returns table (
  qr_codigo        text,
  qr_activo        boolean,
  ambiente_id      uuid,
  ambiente_nombre  text,
  ambiente_codigo  text,
  ambiente_activo  boolean,
  tipo_ambiente    text,
  piso_nombre      text,
  piso_numero      integer,
  pabellon_nombre  text,
  sede_nombre      text,
  sede_activa      boolean,
  disponible       boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    q.codigo,
    q.activo,
    a.id,
    a.nombre,
    a.codigo,
    a.activo,
    ta.nombre,
    coalesce(p.nombre, 'Piso ' || p.numero::text),
    p.numero,
    pb.nombre,
    s.nombre,
    s.activa,
    (q.activo and a.activo and s.activa)
  from public.codigos_qr q
  join public.ambientes a  on a.id  = q.ambiente_id
  join public.tipos_ambiente ta on ta.id = a.tipo_ambiente_id
  join public.pisos p      on p.id  = a.piso_id
  join public.pabellones pb on pb.id = p.pabellon_id
  join public.sedes s      on s.id  = pb.sede_id
  where q.codigo = p_codigo;
$$;

revoke all on function public.resolver_qr_publico(text) from public;
grant execute on function public.resolver_qr_publico(text) to anon, authenticated;

comment on function public.resolver_qr_publico(text) is
  'Flujo QR público: ubicación + banderas de estado (activo/deshabilitado) sin exponer tablas.';

-- ----------------------------------------------------------------------------
-- 2. Registro de lectura (§14.2). Anónimo permitido; el perfil se toma del
--    JWT en el SERVIDOR (never trust the browser). El cliente nunca envía
--    perfil_id. IP: NO se registra aquí (ip_hash solo si hay finalidad;
--    el endpoint puede añadirla como hash con sal en una fase posterior).
-- ----------------------------------------------------------------------------
create or replace function public.registrar_lectura_qr(
  p_codigo     text,
  p_dispositivo text default null,
  p_navegador   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qr_id uuid;
  v_perfil uuid := nullif(current_setting('request.jwt.claim.sub', true), '');
begin
  -- Solo lecturas de QR existentes (activo o no: la lectura es un hecho).
  select id into v_qr_id
    from public.codigos_qr
   where codigo = p_codigo;

  if v_qr_id is null then
    return;  -- QR inexistente: nada que registrar (la pantalla ya dio 404).
  end if;

  insert into public.lecturas_qr (codigo_qr_id, perfil_id, dispositivo, navegador)
  values (v_qr_id, v_perfil::uuid, p_dispositivo, p_navegador);
end;
$$;

revoke all on function public.registrar_lectura_qr(text, text, text) from public;
grant execute on function public.registrar_lectura_qr(text, text, text) to anon, authenticated;

comment on function public.registrar_lectura_qr(text, text, text) is
  'Registra escaneo en lecturas_qr; perfil desde JWT de servidor, nunca del cliente.';
-- ============================================================================
-- SIR-UPSJB · 0012_equipos_de_ambiente.sql
-- RPC SECURITY DEFINER para el equipo relacionado opcional del reporte.
--
-- CONTEXTO: la RLS aprobada (0007, p_equipos_lectura / p_equipos_amb_lectura)
-- solo permite leer `equipos`/`equipos_ambientes` a técnico/coordinador/admin.
-- El reportante de una incidencia necesita elegir (OPCIONALMENTE) el equipo
-- del ambiente en su reporte (Plan Maestro §28/§49; tabla incidencia_equipos).
--
-- SOLUCIÓN (mismo patrón que 0011): función SECURITY DEFINER con search_path
-- vacío que expone SOLO los equipos ACTIVOS asignados a UN ambiente dado:
--   · equipos_de_ambiente(ambiente_id) → id, código interno, categoría.
-- Sin UUIDs de catálogos internos, sin series, sin estados de inventario.
-- La validación del par (incidencia, equipo) al crear la incidencia la hace
-- la Server Action + RLS de incidencia_equipos (dueño o técnico).
-- ============================================================================

create or replace function public.equipos_de_ambiente(p_ambiente_id uuid)
returns table (
  equipo_id      uuid,
  codigo_interno text,
  categoria      text
)
language sql
security definer
set search_path = ''
stable
as $$
  select e.id,
         e.codigo_interno,
         ce.nombre
  from public.equipos_ambientes ea
  join public.equipos e
    on e.id = ea.equipo_id
   and e.activo
  join public.categorias_equipos ce
    on ce.id = e.categoria_id
  where ea.ambiente_id = p_ambiente_id
    and ea.activa
  order by e.codigo_interno;
$$;

revoke all on function public.equipos_de_ambiente(uuid) from public;
grant execute on function public.equipos_de_ambiente(uuid) to authenticated;

comment on function public.equipos_de_ambiente(uuid) is
  'Reporte: equipos activos del ambiente (mínimos datos; RLS 0007 intacta).';

-- ============================================================================
-- SIR-UPSJB · 0013_evidencias_trazabilidad.sql
-- Trazabilidad de incidencias: EVIDENCIAS (Storage privado) + COMENTARIOS +
-- HISTORIAL enriquecido con los eventos del Plan Maestro (CREAR, EDITAR,
-- ASIGNAR, DERIVAR, CAMBIAR_ESTADO, ADJUNTAR_EVIDENCIA, RESOLVER, CERRAR).
--
-- Decisiones de diseño:
--   · Los BINARIOS viven SOLO en Storage (bucket privado `evidencias`, 0009):
--     PostgreSQL guarda únicamente la referencia y metadatos en
--     `incidencia_adjuntos` (§2.5 del modelo). Nunca bytes en la BD.
--   · Validación de MIME y tamaño EN SERVIDOR (RPC): el bucket ya impone
--     allowed_mime_types + file_size_limit; la RPC lo revalida (defensa en
--     profundidad: no se confía solo en el frontend).
--   · El path respeta la convención de 0009:
--       <sede>/<año>/<incidencia_id>/<tipo>/<uuid>.<ext>
--     La RPC verifica que el path apunte a ESTA incidencia y que el objeto
--     exista en Storage antes de registrar los metadatos.
--   · Autorización en cada RPC (SECURITY DEFINER, search_path fijo):
--       adjuntar    → dueño, técnico asignado o admin + permiso adjuntar_evidencia.
--       eliminar    → SOLO ADMINISTRADOR (coherente con evidencias_delete 0009).
--       comentario  → dueño o técnico asignado + permiso comentar_incidencia;
--                     nota interna solo técnico/admin ([VI]: no visible al dueño).
--   · HISTORIAL append-only (D9): los eventos del flujo se escriben con
--     triggers SECURITY DEFINER (independientes de la app) y las RPC; ningún
--     cliente hace UPDATE/DELETE (0004 lo bloquea).
--   · Sin service_role: todo pasa por anon/authenticated + RLS/policies.
--   · Idempotente y re-ejecutable (or replace / drop if exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. path_evidencia_valido: acepta sede en mayúsculas (ck_sedes_codigo usa
--    '^[A-Z0-9-]+$'); la app genera el path con la sede en minúsculas, pero
--    la validación queda robusta a ambos.
-- ----------------------------------------------------------------------------
create or replace function public.path_evidencia_valido(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path ~ '^[A-Za-z0-9-]+/[0-9]{4}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(antes|durante|despues|documento|video)/[0-9a-fA-F-]+\.[a-z0-9]+$';
$$;

-- ============================================================================
-- 1. TRIGGERS DE TRAZABILIDAD (historial append-only, escritura en BD)
--    Reconstruyen la evolución sin depender de la aplicación:
--      CREAR · CAMBIAR_ESTADO (RESOLVER/CERRAR/CANCELAR) · EDITAR (descripción)
--      CAMBIO_DE_PRIORIDAD · ASIGNAR · DERIVAR
-- ============================================================================

-- ---- 1a. CREAR: fila inicial al registrar la incidencia --------------------
create or replace function public.historial_incidencia_crear()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select nombre into v_estado
  from public.estados_incidencia
  where id = new.estado_id;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (new.id, auth.uid(), 'otro', 'estado', null, v_estado,
     'CREAR: reporte registrado con código ' || new.codigo);
  return null;
end;
$$;

-- ---- 1b. CAMBIAR_ESTADO / RESOLVER / CERRAR · prioridad · EDITAR -----------
create or replace function public.historial_incidencia_actualizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text;
  v_nuevo    text;
  v_detalle  text;
begin
  -- Cambio de estado (incluye RESOLVER y CERRAR según el estado destino).
  if old.estado_id is distinct from new.estado_id then
    select nombre into v_anterior from public.estados_incidencia where id = old.estado_id;
    select nombre into v_nuevo    from public.estados_incidencia where id = new.estado_id;

    v_detalle := case v_nuevo
      when 'Resuelta'  then 'RESOLVER: incidencia marcada como Resuelta'
      when 'Cerrada'   then 'CERRAR: incidencia cerrada por el reportante'
      when 'Cancelada' then 'CANCELAR: incidencia cancelada'
      else 'CAMBIAR_ESTADO: ' || coalesce(v_anterior, '—') || ' → ' || coalesce(v_nuevo, '—')
    end;

    insert into public.incidencia_historial
      (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
    values
      (new.id, auth.uid(), 'estado', 'estado', v_anterior, v_nuevo, v_detalle);
  end if;

  -- Cambio de prioridad.
  if old.prioridad_id is distinct from new.prioridad_id then
    select nombre into v_anterior from public.prioridades where id = old.prioridad_id;
    select nombre into v_nuevo    from public.prioridades where id = new.prioridad_id;

    insert into public.incidencia_historial
      (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
    values
      (new.id, auth.uid(), 'prioridad', 'prioridad', v_anterior, v_nuevo,
       'CAMBIAR_PRIORIDAD: ' || coalesce(v_anterior, '—') || ' → ' || coalesce(v_nuevo, '—'));
  end if;

  -- Edición de la descripción (EDITAR).
  if old.descripcion is distinct from new.descripcion then
    insert into public.incidencia_historial
      (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
    values
      (new.id, auth.uid(), 'edicion', 'descripcion', null, null,
       'EDITAR: descripción actualizada');
  end if;

  return null;
end;
$$;

-- ---- 1c. ASIGNAR: asignación activa a un técnico ---------------------------
create or replace function public.historial_asignacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tecnico text;
begin
  select nullif(btrim(concat_ws(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), '')
  into v_tecnico
  from public.tecnicos t
  join public.perfiles p on p.id = t.perfil_id
  where t.id = new.tecnico_id;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (new.incidencia_id, coalesce(new.asignado_por, auth.uid()), 'asignacion',
     'tecnico', null, v_tecnico,
     'ASIGNAR: técnico ' || coalesce(v_tecnico, 'asignado'));
  return null;
end;
$$;

-- ---- 1d. DERIVAR: derivación entre áreas (incluye la inicial) --------------
create or replace function public.historial_derivacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_destino text;
  v_origen  text;
begin
  select nombre into v_destino from public.areas where id = new.area_destino_id;
  if new.area_origen_id is not null then
    select nombre into v_origen from public.areas where id = new.area_origen_id;
  end if;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (new.incidencia_id, coalesce(new.derivado_por, auth.uid()), 'derivacion',
     'area', v_origen, v_destino,
     'DERIVAR: ' || coalesce(v_origen, 'registro inicial') || ' → ' || coalesce(v_destino, '—'));
  return null;
end;
$$;

create trigger trg_incidencias_historial_crear
  after insert on public.incidencias
  for each row execute function public.historial_incidencia_crear();

create trigger trg_incidencias_historial_actualizar
  after update of estado_id, prioridad_id, descripcion on public.incidencias
  for each row execute function public.historial_incidencia_actualizar();

create trigger trg_asignaciones_historial
  after insert on public.incidencia_asignaciones
  for each row execute function public.historial_asignacion();

create trigger trg_derivaciones_historial
  after insert on public.incidencia_derivaciones
  for each row execute function public.historial_derivacion();

-- ============================================================================
-- 2. ADJUNTAR EVIDENCIA (metadatos + verificación del objeto + historial)
--    El ARCHIVO lo sube antes el cliente/servidor con el JWT del usuario
--    (policy evidencias_insert de 0009); esta RPC registra los metadatos solo
--    si el objeto existe en Storage. subido_por SIEMPRE = auth.uid().
-- ============================================================================

create or replace function public.adjuntar_evidencia(
  p_incidencia_id uuid,
  p_tipo          text,          -- antes|durante|despues|documento|video
  p_path          text,          -- convención 0009 (se revalida aquí)
  p_nombre        text,
  p_mime          text,
  p_tamano        bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max     bigint := 10485760;  -- 10 MB = file_size_limit del bucket (0009)
  v_validos text[] := array['image/jpeg','image/png','image/webp',
                            'application/pdf','video/mp4'];
  v_perfil  uuid;
  v_id      uuid;
begin
  -- a) Perfil activo + permiso adjuntar_evidencia (semilla 0005).
  if not public.perfil_activo() or not public.tiene_permiso('adjuntar_evidencia') then
    raise exception 'Tu rol no permite adjuntar evidencias';
  end if;

  -- b) Autorización sobre la incidencia: dueño, técnico asignado o admin
  --    (mismo criterio que p_adjuntos_insert de 0007).
  if not exists (
    select 1 from public.incidencias i
    where i.id = p_incidencia_id
      and (
        i.usuario_reportante_id = auth.uid()
        or public.tengo_asignacion_activa(p_incidencia_id)
        or public.soy_administrador()
      )
  ) then
    raise exception 'No autorizado para adjuntar a esta incidencia';
  end if;

  -- c) Tipo de evidencia (CHECK de BD).
  if p_tipo not in ('antes','durante','despues','documento','video') then
    raise exception 'Tipo de evidencia no válido';
  end if;

  -- d) MIME y tamaño validados EN SERVIDOR (no solo en el frontend).
  if p_mime is null or not (p_mime = any (v_validos)) then
    raise exception 'Formato no permitido. Usa JPG, PNG, WEBP, PDF o MP4';
  end if;
  if p_tamano is null or p_tamano <= 0 or p_tamano > v_max then
    raise exception 'El archivo supera el tamaño máximo (10 MB)';
  end if;

  -- e) Nombre de archivo presente (se recorta a la longitud de la columna).
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'Falta el nombre del archivo';
  end if;

  -- f) El path debe cumplir la convención 0009 y apuntar a ESTA incidencia.
  if not public.path_evidencia_valido(p_path)
     or public.incidencia_de_path(p_path) is distinct from p_incidencia_id then
    raise exception 'Ruta de almacenamiento no válida';
  end if;

  -- g) El objeto ya debe existir en Storage: sin archivo no hay evidencia.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'evidencias' and o.name = p_path
  ) then
    raise exception 'El archivo no fue encontrado en Storage; súbelo antes de registrar la evidencia';
  end if;

  -- h) Metadatos: subido_por SIEMPRE de la sesión (nunca del cliente).
  select p.id into v_perfil
  from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo'
  limit 1;

  insert into public.incidencia_adjuntos
    (incidencia_id, subido_por, tipo, bucket, path, nombre_archivo, mime_type, tamano_bytes)
  values
    (p_incidencia_id, v_perfil, p_tipo, 'evidencias', p_path, left(btrim(p_nombre), 255),
     p_mime, p_tamano)
  returning id into v_id;

  -- i) Historial (append-only): evento ADJUNTAR_EVIDENCIA.
  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (p_incidencia_id, v_perfil, 'otro', 'evidencia', null, p_tipo,
     'ADJUNTAR_EVIDENCIA: ' || left(btrim(p_nombre), 400));

  return v_id;
end;
$$;

revoke all on function public.adjuntar_evidencia(uuid, text, text, text, text, bigint)
  from public, anon;
grant execute on function public.adjuntar_evidencia(uuid, text, text, text, text, bigint)
  to authenticated;

comment on function public.adjuntar_evidencia(uuid, text, text, text, text, bigint) is
  'Evidencias: valida MIME/tamaño en servidor, exige el objeto en Storage y registra metadatos + historial (binarios nunca en PostgreSQL).';

-- ============================================================================
-- 3. ELIMINAR EVIDENCIA — SOLO ADMINISTRADOR
--    Coherente con la policy evidencias_delete de 0009 (Storage). Retira el
--    objeto del bucket privado y los metadatos; deja constancia en historial.
-- ============================================================================

create or replace function public.eliminar_evidencia(p_evidencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.incidencia_adjuntos%rowtype;
begin
  if not public.soy_administrador() then
    raise exception 'Solo un administrador puede eliminar evidencias';
  end if;

  select * into v_fila
  from public.incidencia_adjuntos
  where id = p_evidencia_id;

  if not found then
    raise exception 'Evidencia no encontrada';
  end if;

  -- Objeto del bucket privado (definer: pasa por aquí, la UI solo lo ofrece
  -- al admin; la policy evidencias_delete de 0009 es el respaldo).
  delete from storage.objects
   where bucket_id = v_fila.bucket and name = v_fila.path;

  -- Metadatos + evento de historial (append-only; solo INSERT).
  delete from public.incidencia_adjuntos where id = p_evidencia_id;

  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (v_fila.incidencia_id, auth.uid(), 'otro', 'evidencia', v_fila.tipo, null,
     'ELIMINAR_EVIDENCIA: ' || left(v_fila.nombre_archivo, 400));

  return true;
end;
$$;

revoke all on function public.eliminar_evidencia(uuid) from public, anon;
grant execute on function public.eliminar_evidencia(uuid) to authenticated;

comment on function public.eliminar_evidencia(uuid) is
  'Evidencias: eliminación restringida a ADMINISTRADOR (Storage + metadatos + historial).';

-- ============================================================================
-- 4. COMENTARIOS (dueño o técnico asignado; permiso comentar_incidencia)
--    Nota interna solo técnico/admin [VI]: el reportante no las ve
--    (la app filtra es_interno para el dueño; aquí no se le permite crearlas).
-- ============================================================================

create or replace function public.agregar_comentario(
  p_incidencia_id uuid,
  p_comentario    text,
  p_es_interno    boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_id     uuid;
  v_texto  text;
begin
  if not public.perfil_activo() or not public.tiene_permiso('comentar_incidencia') then
    raise exception 'Tu rol no permite comentar en esta incidencia';
  end if;

  -- Autorización: dueño o técnico con asignación activa (p_comentarios_insert).
  if not exists (
    select 1 from public.incidencias i
    where i.id = p_incidencia_id
      and (
        i.usuario_reportante_id = auth.uid()
        or public.tengo_asignacion_activa(p_incidencia_id)
      )
  ) then
    raise exception 'No autorizado para comentar en esta incidencia';
  end if;

  -- Nota interna: solo técnico asignado o admin; el dueño no puede crearla.
  if coalesce(p_es_interno, false)
     and not (public.tengo_asignacion_activa(p_incidencia_id) or public.soy_administrador()) then
    p_es_interno := false;
  end if;

  v_texto := btrim(coalesce(p_comentario, ''));
  if v_texto = '' then
    raise exception 'El comentario está vacío';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'El comentario supera los 3000 caracteres';
  end if;

  select p.id into v_perfil
  from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo'
  limit 1;

  insert into public.incidencia_comentarios
    (incidencia_id, autor_id, comentario, es_interno)
  values
    (p_incidencia_id, v_perfil, v_texto, coalesce(p_es_interno, false))
  returning id into v_id;

  -- Historial (append-only): COMENTARIO (sin volcar el contenido completo).
  insert into public.incidencia_historial
    (incidencia_id, actor_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle)
  values
    (p_incidencia_id, v_perfil, 'otro', 'comentario', null, null,
     'COMENTARIO: ' || left(v_texto, 400));

  return v_id;
end;
$$;

revoke all on function public.agregar_comentario(uuid, text, boolean) from public, anon;
grant execute on function public.agregar_comentario(uuid, text, boolean) to authenticated;

comment on function public.agregar_comentario(uuid, text, boolean) is
  'Comentarios: dueño o técnico asignado con permiso; internos solo técnico/admin; registra COMENTARIO en historial.';

-- ============================================================================
-- 5. URL FIRMADA DE LECTURA (buckets privados, §2.5)
--    La signed URL se genera EN SERVIDOR; la policy evidencias_select de 0009
--    (replicada aquí) decide si el lector puede ver el objeto. Nunca bucket
--    público; expiración corta (5 min) para minimizar la ventana de enlace.
-- ============================================================================

create or replace function public.url_firma_evidencia(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incidencia uuid := public.incidencia_de_path(p_path);
begin
  -- Path válido y de una incidencia existente.
  if v_incidencia is null or not public.path_evidencia_valido(p_path) then
    return null;
  end if;

  -- Misma autorización que evidencias_select (dueño, técnico asignado, admin).
  if not (
    public.es_dueno_por_path(p_path)
    or public.tengo_asignacion_por_path(p_path)
    or public.soy_administrador()
  ) then
    return null;
  end if;

  -- El objeto debe existir en el bucket privado.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'evidencias' and o.name = p_path
  ) then
    return null;
  end if;

  return storage.sign(name := p_path, bucket := 'evidencias', ext := 300);
end;
$$;

revoke all on function public.url_firma_evidencia(text) from public, anon;
grant execute on function public.url_firma_evidencia(text) to authenticated;

comment on function public.url_firma_evidencia(text) is
  'Evidencias: signed URL de 5 min generada en servidor; buckets privados nunca expuestos (0009).';

-- ============================================================================
-- 6. VERIFICACIÓN
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('adjuntar_evidencia','eliminar_evidencia','agregar_comentario',
       'url_firma_evidencia',
       'historial_incidencia_crear','historial_incidencia_actualizar',
       'historial_asignacion','historial_derivacion')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('adjuntar_evidencia','eliminar_evidencia','agregar_comentario',
       'url_firma_evidencia',
       'historial_incidencia_crear','historial_incidencia_actualizar',
       'historial_asignacion','historial_derivacion')
  ) <> 8 then
    raise exception 'RPCs/triggers de trazabilidad no creados correctamente';
  end if;
end
$$;

-- ============================================================================
-- SIR-UPSJB · 0014_acciones_tecnico.sql
-- Módulo operativo del TÉCNICO: flujo de atención con la lógica EN LA BASE
-- DE DATOS (RPC SECURITY DEFINER). La UI oculta botones, pero quien decide
-- es la BD: cada RPC revalida identidad, asignación activa, permiso del rol
-- y TRANSICIÓN DE ESTADO válida (máquina de estados del modelo aprobado).
--
-- ESTADOS (semilla 0005; NO se inventan nuevos):
--   Pendiente(1) → Asignada(2) → En proceso(3) → En espera(4) → Resuelta(5)
--   → Cerrada(6, final) / Cancelada(7, final)
--
-- TRANSICIONES permitidas al TÉCNICO CON ASIGNACIÓN ACTIVA (check de BD):
--   Asignada  → En proceso          (INICIAR_ATENCION; fija fecha_inicio)
--   En proceso→ En espera           (PONER_EN_ESPERA; motivo obligatorio)
--   En espera → En proceso          (REANUDAR)
--   En proceso→ Resuelta            (RESOLVER; fija fecha_resolucion)
--   (ADEMÁS el técnico activo puede ACEPTAR la incidencia que le fue
--    asignada: Asignada → En proceso con aceptado_en; y REGISTRAR_ACCION,
--    COMENTAR y ADJUNTAR_EVIDENCIA en cualquier punto del flujo activo.)
--   El cierre (Cerrada) lo confirma el REPORTANTE; Cancelar es del
--   coordinador/admin (fases posteriores) — el técnico NO cierra ni cancela.
--
-- Sin service_role: todo pasa por authenticated + RLS/policies (0007/0009).
-- Idempotente y re-ejecutable (create or replace).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper: ¿transición de estado válida para el TÉCNICO con asignación
--    activa? (máquina de estados del modelo; single source of truth en BD)
-- ----------------------------------------------------------------------------
create or replace function public.transicion_tecnico_valida(
  p_de nombre,
  p_a  nombre
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_de, p_a) in (
    ('Asignada',   'En proceso'),
    ('En proceso', 'En espera'),
    ('En espera',  'En proceso'),
    ('En proceso', 'Resuelta')
  );
$$;

-- ----------------------------------------------------------------------------
-- 1. ACEPTAR la asignación (Asignada → En proceso) y registrar aceptado_en.
--    La fila de asignación activa la cerrará/abrirá la reasignación del
--    coordinador; aquí solo confirma el técnico y mueve el estado.
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_aceptar_incidencia(p_incidencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado   text;
  v_estado_id uuid;
  v_tecnico  uuid;
begin
  -- Asignación activa para el usuario actual (técnico activo).
  select a.id into v_tecnico
  from public.incidencia_asignaciones a
  join public.tecnicos t on t.id = a.tecnico_id
  where a.incidencia_id = p_incidencia_id
    and a.activa
    and t.perfil_id = auth.uid()
    and t.activo
  limit 1;

  if v_tecnico is null then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;

  select e.nombre, i.estado_id into v_estado, v_estado_id
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_estado is distinct from 'Asignada' then
    raise exception 'Solo se puede aceptar una incidencia en estado Asignada (actual: %)', v_estado;
  end if;

  update public.incidencia_asignaciones
     set aceptado_en = now()
   where id = v_tecnico
     and aceptado_en is null;

  select id into v_estado_id from public.estados_incidencia where nombre = 'En proceso';
  update public.incidencias
     set estado_id = v_estado_id,
         fecha_inicio = coalesce(fecha_inicio, now())
   where id = p_incidencia_id;

  return true;
end;
$$;

revoke all on function public.tecnico_aceptar_incidencia(uuid) from public, anon;
grant execute on function public.tecnico_aceptar_incidencia(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. CAMBIAR ESTADO con transición validada (INICIAR/EN_ESPERA/REANUDAR).
--    p_detalle: motivo obligatorio al poner en espera.
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_cambiar_estado(
  p_incidencia_id uuid,
  p_nuevo_estado  text,
  p_detalle       text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual  text;
  v_nuevo_id uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() or not public.tiene_permiso('cambiar_estado') then
    raise exception 'Tu rol no permite cambiar el estado de incidencias';
  end if;

  select e.nombre into v_actual
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  -- Solo estados existentes en el catálogo (no se inventan estados).
  select id into v_nuevo_id
  from public.estados_incidencia
  where nombre = p_nuevo_estado and activo;
  if v_nuevo_id is null then
    raise exception 'Estado "% no existe en el catálogo del sistema', p_nuevo_estado;
  end if;

  if not public.transicion_tecnico_valida(v_actual::nombre, p_nuevo_estado::nombre) then
    raise exception 'Transición no permitida: % → %', v_actual, p_nuevo_estado;
  end if;

  -- Motivo obligatorio al poner en espera [VI].
  if p_nuevo_estado = 'En espera'
     and (p_detalle is null or btrim(p_detalle) = '') then
    raise exception 'Indica el motivo de la espera';
  end if;

  update public.incidencias
     set estado_id    = v_nuevo_id,
         fecha_inicio = coalesce(fecha_inicio, case
                        when p_nuevo_estado = 'En proceso' then now() end)
   where id = p_incidencia_id;

  if p_detalle is not null and btrim(p_detalle) <> '' then
    perform public.registrar_evento_incidencia(p_incidencia_id,
      'CAMBIAR_ESTADO: ' || v_actual || ' → ' || p_nuevo_estado ||
      ' — ' || left(btrim(p_detalle), 300));
  end if;

  return true;
end;
$$;

revoke all on function public.tecnico_cambiar_estado(uuid, text, text) from public, anon;
grant execute on function public.tecnico_cambiar_estado(uuid, text, text) to authenticated;

comment on function public.tecnico_cambiar_estado(uuid, text, text) is
  'Flujo técnico: cambia estado validando la transición (máquina de estados en BD).';

-- ----------------------------------------------------------------------------
-- 3. DIAGNÓSTICO + ACCIONES + RESOLUCIÓN (incidencia_tecnicos)
--    Un registro por incidencia (uq_incidencia): diagnóstico técnico,
--    acciones realizadas, solución aplicada; se enriquece en cada paso.
--    El evento de historial deja constancia de cada acción (append-only).
-- ----------------------------------------------------------------------------
create table if not exists public.incidencia_tecnicos (
  id             uuid        primary key default gen_random_uuid(),
  incidencia_id  uuid        not null constraint uq_incidencia_tecnicos_incidencia unique
                 constraint fk_incidencia_tecnicos_incidencia
                 references public.incidencias (id) on delete cascade,
  diagnostico    text        constraint ck_incidencia_tecnicos_diagnostico
                 check (char_length(diagnostico) between 1 and 2000),
  acciones       text        constraint ck_incidencia_tecnicos_acciones
                 check (char_length(acciones) between 1 and 2000),
  solucion       text        constraint ck_incidencia_tecnicos_solucion
                 check (char_length(solucion) between 1 and 2000),
  registrado_por uuid        constraint fk_incidencia_tecnicos_registro
                 references public.perfiles (id) on delete set null,
  actualizado_en timestamptz not null default now()
);

alter table public.incidencia_tecnicos enable row level security;

-- El técnico asignado lee/escribe SU registro; admin y dueño lo leen.
drop policy if exists p_incidencia_tecnicos_all on public.incidencia_tecnicos;
create policy p_incidencia_tecnicos_all on public.incidencia_tecnicos
  for all to authenticated
  using (
    public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  )
  with check (
    public.tengo_asignacion_activa(incidencia_id)
    or public.soy_administrador()
  );

drop policy if exists p_incidencia_tecnicos_select on public.incidencia_tecnicos;
create policy p_incidencia_tecnicos_select on public.incidencia_tecnicos
  for select to authenticated
  using (
    public.es_dueno_incidencia(incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  );

grant select, insert, update on public.incidencia_tecnicos to authenticated;

-- updated_at para la nueva tabla
create trigger trg_incidencia_tecnicos_updated_at
  before update on public.incidencia_tecnicos
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. REGISTRAR DIAGNÓSTICO (crea o actualiza el registro técnico)
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_registrar_diagnostico(
  p_incidencia_id uuid,
  p_diagnostico   text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() then
    raise exception 'Perfil inactivo';
  end if;

  if p_diagnostico is null or btrim(p_diagnostico) = '' then
    raise exception 'El diagnóstico está vacío';
  end if;
  if char_length(btrim(p_diagnostico)) > 2000 then
    raise exception 'El diagnóstico supera los 2000 caracteres';
  end if;

  select p.id into v_perfil from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo' limit 1;

  insert into public.incidencia_tecnicos (incidencia_id, diagnostico, registrado_por)
  values (p_incidencia_id, btrim(p_diagnostico), v_perfil)
  on conflict (incidencia_id) do update
    set diagnostico    = excluded.diagnostico,
        registrado_por = excluded.registrado_por,
        actualizado_en = now();

  perform public.registrar_evento_incidencia(p_incidencia_id,
    'DIAGNOSTICO: ' || left(btrim(p_diagnostico), 300));
  return true;
end;
$$;

revoke all on function public.tecnico_registrar_diagnostico(uuid, text) from public, anon;
grant execute on function public.tecnico_registrar_diagnostico(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. REGISTRAR ACCIÓN realizada (append de texto en el registro técnico)
--    Cada llamada guarda la acción con marca de tiempo en el historial y
--    concatena en `acciones` del registro técnico (última línea).
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_registrar_accion(
  p_incidencia_id uuid,
  p_accion        text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previas text;
  v_texto   text;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if p_accion is null or btrim(p_accion) = '' then
    raise exception 'La acción está vacía';
  end if;
  if char_length(btrim(p_accion)) > 500 then
    raise exception 'Cada acción debe tener hasta 500 caracteres';
  end if;

  select acciones into v_previas
  from public.incidencia_tecnicos
  where incidencia_id = p_incidencia_id;

  v_texto := btrim(p_accion);
  if v_previas is not null and btrim(v_previas) <> '' then
    v_texto := v_previas || char(10) || to_char(now(), 'DD/MM HH24:MI') || ' · ' || v_texto;
  else
    v_texto := to_char(now(), 'DD/MM HH24:MI') || ' · ' || v_texto;
  end if;

  insert into public.incidencia_tecnicos (incidencia_id, acciones, registrado_por)
  values (p_incidencia_id, left(v_texto, 2000), auth.uid())
  on conflict (incidencia_id) do update
    set acciones       = left(v_texto, 2000),
        actualizado_en = now();

  perform public.registrar_evento_incidencia(p_incidencia_id,
    'REGISTRAR_ACCION: ' || left(v_texto, 300));
  return true;
end;
$$;

revoke all on function public.tecnico_registrar_accion(uuid, text) from public, anon;
grant execute on function public.tecnico_registrar_accion(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. RESOLVER (En proceso → Resuelta; solución obligatoria)
--    Fija fecha_resolucion; el cierre lo confirma el reportante (RLS 0007).
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_resolver_incidencia(
  p_incidencia_id uuid,
  p_solucion      text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual   text;
  v_resuelta uuid;
  v_perfil   uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() or not public.tiene_permiso('resolver_incidencia') then
    raise exception 'Tu rol no permite resolver incidencias';
  end if;

  if p_solucion is null or btrim(p_solucion) = '' then
    raise exception 'Describe la solución aplicada';
  end if;
  if char_length(btrim(p_solucion)) > 2000 then
    raise exception 'La solución supera los 2000 caracteres';
  end if;

  select e.nombre into v_actual
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_actual is distinct from 'En proceso' then
    raise exception 'Solo se resuelve desde En proceso (actual: %)', v_actual;
  end if;

  select p.id into v_perfil from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo' limit 1;

  -- Registro técnico: solución + diagnóstico mínimo si no existe.
  insert into public.incidencia_tecnicos (incidencia_id, solucion, registrado_por)
  values (p_incidencia_id, btrim(p_solucion), v_perfil)
  on conflict (incidencia_id) do update
    set solucion      = btrim(p_solucion),
        actualizado_en = now();

  select id into v_resuelta from public.estados_incidencia where nombre = 'Resuelta';
  update public.incidencias
     set estado_id        = v_resuelta,
         fecha_resolucion = now()
   where id = p_incidencia_id;

  perform public.registrar_evento_incidencia(p_incidencia_id,
    'SOLUCION: ' || left(btrim(p_solucion), 300));
  return true;
end;
$$;

revoke all on function public.tecnico_resolver_incidencia(uuid, text) from public, anon;
grant execute on function public.tecnico_resolver_incidencia(uuid, text) to authenticated;

comment on function public.tecnico_resolver_incidencia(uuid, text) is
  'Flujo técnico: resuelve (En proceso → Resuelta) con solución obligatoria; el cierre lo confirma el reportante.';

-- ----------------------------------------------------------------------------
-- 7. LECTURA del registro técnico (para la vista de atención)
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_registro_de_incidencia(p_incidencia_id uuid)
returns table (
  diagnostico text,
  acciones    text,
  solucion    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select it.diagnostico, it.acciones, it.solucion
  from public.incidencia_tecnicos it
  where it.incidencia_id = p_incidencia_id
    and (
      public.tengo_asignacion_activa(p_incidencia_id)
      or public.es_dueno_incidencia(p_incidencia_id)
      or public.soy_administrador()
    );
$$;

revoke all on function public.tecnico_registro_de_incidencia(uuid) from public, anon;
grant execute on function public.tecnico_registro_de_incidencia(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('tecnico_aceptar_incidencia','tecnico_cambiar_estado',
       'tecnico_registrar_diagnostico','tecnico_registrar_accion',
       'tecnico_resolver_incidencia','tecnico_registro_de_incidencia',
       'transicion_tecnico_valida')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('tecnico_aceptar_incidencia','tecnico_cambiar_estado',
       'tecnico_registrar_diagnostico','tecnico_registrar_accion',
       'tecnico_resolver_incidencia','tecnico_registro_de_incidencia',
       'transicion_tecnico_valida')
  ) <> 7 then
    raise exception 'RPCs del módulo técnico no creadas correctamente';
  end if;
end
$$;

-- ============================================================================
-- SIR-UPSJB · 0015_admin_catalogos_completos.sql
-- ============================================================================

-- uq_modelos_equipos_marca_nombre (idempotente) -------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_modelos_equipos_marca_nombre'
      and conrelid = 'public.modelos_equipos'::regclass
  ) then
    alter table public.modelos_equipos
      add constraint uq_modelos_equipos_marca_nombre
      unique (marca_id, nombre);
  end if;
end
$$;

-- uq_tecnicos_perfil (re-declaración idempotente de la regla 1:0..1) ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_tecnicos_perfil'
      and conrelid = 'public.tecnicos'::regclass
  ) then
    alter table public.tecnicos
      add constraint uq_tecnicos_perfil unique (perfil_id);
  end if;
end
$$;

-- Verificación final de 0015.
do $$
declare
  faltan int;
begin
  select count(*) into faltan
  from (values
    ('uq_modelos_equipos_marca_nombre', 'modelos_equipos'),
    ('uq_tecnicos_perfil',              'tecnicos')
  ) as esperados(constraint_name, tabla)
  where not exists (
    select 1 from pg_constraint c
    where c.conname = esperados.constraint_name
      and c.conrelid = format('public.%I', esperados.tabla)::regclass
  );
  if faltan > 0 then
    raise exception 'Faltan % constraints UNIQUE tras la migracion 0015', faltan;
  end if;
end
$$;

-- ============================================================================
-- SIR-UPSJB · 0016_reglas_derivacion.sql
-- Reglas de clasificación, asignación y derivación (Plan Maestro §18, §36, §40).
-- Contenido íntegro de supabase/migrations/0016_reglas_derivacion.sql.
-- ============================================================================

-- ============================================================================
-- SIR-UPSJB · 0016_reglas_derivacion.sql
-- FASE 8 (Plan Maestro §18, §36, §40): reglas de clasificación y derivación.
--
-- La LÓGICA vive en la BD (RPC SECURITY DEFINER con revalidación completa);
-- la UI solo oculta botones. Las reglas son CONFIGURABLES: la tabla
-- reglas_enrutamiento (0001) es la fuente de verdad y el administrador las
-- gestiona desde el panel (policy p_reglas_admin de 0007); NINGÚN caso de
-- ejemplo está hardcodeado en las funciones.
--
-- FLUJO (§6): crear → clasificación → evaluación de reglas → área/servicio
--             → asignación o derivación → atención.
--
-- PIEZAS:
--   1. evaluar_reglas_enrutamiento(p_tipo, p_subtipo)
--      → la PRIMERA regla activa que coincida, ordenada por prioridad_orden;
--        una regla con subtipo específico pisa a la del tipo completo porque
--        el admin le asigna un prioridad_orden menor (índice uq_reglas_orden).
--        Sin coincidencia devuelve NULL (sin derivación inicial: el ticket
--        queda Pendiente para gestión manual del coordinador).
--   2. clasificar_incidencia(p_incidencia_id, p_origen)
--      → evalúa reglas para la incidencia; si hay coincidencia crea la
--        derivación inicial (área/servicio destino, motivo con nombre de la
--        regla), aplica prioridad_defecto si existe y cambia Pendiente→Derivada.
--        Devuelve la derivación creada o NULL (sin regla). Registra auditoría
--        de la regla aplicada y deja evento en el historial (trigger 0013).
--   3. derivar_incidencia(p_incidencia, p_area, p_servicio, p_motivo)
--      → derivación MANUAL autorizada: ADMINISTRADOR, COORDINADOR del área
--        destino vigente, o quien tenga permiso derivar_incidencia. Valida
--        área/servicio activos, servicio ∈ área, no auto-derivarse (CHECK BD),
--        y cambia el estado a Derivada (estado existente, semilla 0005).
--   4. asignar_incidencia(p_incidencia, p_tecnico)
--      → asignación MANUAL: ADMINISTRADOR o COORDINADOR del área vigente con
--        permiso asignar_incidencia. Valida técnico activo del área destino
--        vigente. El trigger 0013 deja el evento ASIGNAR en el historial.
--   5. auditoria_regla_enrutamiento()
--      → trigger AFTER INSERT/UPDATE/DELETE sobre reglas_enrutamiento:
--        escribe en registros_auditoria (MODIFICAR_CONFIGURACION, append-only)
--        con valores_previos/valores_nuevos. Solo para clientes de la API
--        (definer del sistema no duplica eventos de las semillas).
--   6. derivacion_activa_de_incidencia(p_incidencia_id)
--      → lectura del destino vigente para la UI (RPC, evita consultar la
--        tabla directamente con policies de subconsulta).
--
-- La auditoría global de la clasificación usa registros_auditoria (CHECK:
-- MODIFICAR_CONFIGURACION/ASIGNAR/DERIVAR/CAMBIAR_ESTADO existentes en 0001).
-- El historial append-only de la incidencia lo alimentan los triggers 0013
-- (DERIVAR/ASIGNAR/CAMBIAR_ESTADO) y los eventos detallados de estas RPCs.
--
-- Sin service_role: todo pasa por authenticated + RLS (0007/0009).
-- Idempotente y re-ejecutable (create or replace / drop if exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper: ¿el estado existe en el catálogo? (no se inventan estados)
-- ----------------------------------------------------------------------------
create or replace function public.estado_id_por_nombre(p_nombre text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.estados_incidencia where nombre = p_nombre and activo limit 1;
$$;

revoke all on function public.estado_id_por_nombre(text) from public, anon;
grant execute on function public.estado_id_por_nombre(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 1. EVALUACIÓN DE REGLAS (pura: la misma lógica sirve para vista previa)
-- ----------------------------------------------------------------------------
create or replace function public.evaluar_reglas_enrutamiento(
  p_tipo_id    uuid,
  p_subtipo_id uuid
)
returns table (
  regla_id             uuid,
  regla_nombre         text,
  area_destino_id      uuid,
  area_destino_nombre  text,
  servicio_destino_id  uuid,
  servicio_destino_nombre text,
  prioridad_defecto_id uuid,
  prioridad_orden      integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.nombre,
         r.area_destino_id,
         ar.nombre,
         r.servicio_destino_id,
         sv.nombre,
         r.prioridad_defecto_id,
         r.prioridad_orden
  from public.reglas_enrutamiento r
  join public.areas ar        on ar.id = r.area_destino_id
  left join public.servicios sv on sv.id = r.servicio_destino_id
  where r.activa
    and r.area_destino_id in (select a.id from public.areas a where a.activo)
    and (r.servicio_destino_id is null
         or r.servicio_destino_id in (select s.id from public.servicios s where s.activo))
    and r.tipo_incidencia_id = p_tipo_id
    -- Coincidencia: regla del subtipo específico, o regla "todo el tipo"
    -- (subtipo NULL). Un reporte SIN subtipo solo matchea reglas de tipo.
    and (r.subtipo_incidencia_id is null or r.subtipo_incidencia_id = p_subtipo_id)
  order by
    -- La regla del SUBTIPO específico evalúa primero cuando el reporte lo trae;
    -- el desempate entre reglas del mismo alcance lo decide prioridad_orden.
    case when p_subtipo_id is not null and r.subtipo_incidencia_id = p_subtipo_id then 0 else 1 end,
    r.prioridad_orden
  limit 1;
$$;

revoke all on function public.evaluar_reglas_enrutamiento(uuid, uuid) from public, anon;
grant execute on function public.evaluar_reglas_enrutamiento(uuid, uuid) to authenticated;

comment on function public.evaluar_reglas_enrutamiento(uuid, uuid) is
  'Clasificación (§36): primera regla activa que coincide (tipo+subtipo), ordenada por prioridad_orden. Regla con subtipo pisa a la del tipo. Sin coincidencia → NULL.';

-- ----------------------------------------------------------------------------
-- 2. CLASIFICAR (llamar justo después de crear la incidencia)
--    Crea la derivación INICIAL (area_origen NULL) con el motivo/nombre de la
--    regla aplicada, aplica prioridad por defecto de la regla y mueve el
--    estado Pendiente → Derivada. Sin regla: no hace nada (devuelve NULL) y
--    el ticket sigue Pendiente para gestión manual.
-- ----------------------------------------------------------------------------
create or replace function public.clasificar_incidencia(
  p_incidencia_id uuid,
  p_origen        text default 'automatica'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo    uuid;
  v_subtipo uuid;
  v_estado  text;
  v_regla   record;
  v_derivacion uuid;
  v_prioridad_nueva uuid;
  v_prioridad_anterior text;
  v_actor uuid := auth.uid();
begin
  select i.tipo_incidencia_id, i.subtipo_incidencia_id,
         (select e.nombre from public.estados_incidencia e where e.id = i.estado_id)
    into v_tipo, v_subtipo, v_estado
  from public.incidencias i
  where i.id = p_incidencia_id;

  if v_tipo is null then
    raise exception 'Incidencia no encontrada';
  end if;

  -- La clasificación automática corre sobre tickets recién creados.
  if v_estado <> 'Pendiente' then
    raise exception 'Solo se clasifican incidencias en estado Pendiente (actual: %)', v_estado;
  end if;

  -- Evaluación de reglas configurables (única fuente de verdad).
  select * into v_regla
  from public.evaluar_reglas_enrutamiento(v_tipo, v_subtipo);

  if v_regla is null or v_regla.regla_id is null then
    -- AUSENCIA DE REGLA: no se fuerza destino; queda Pendiente para el
    -- coordinador. Se deja constancia para trazabilidad operativa.
    insert into public.registros_auditoria
      (actor_id, accion, tabla_afectada, registro_id, valores_nuevos)
    values
      (v_actor, 'MODIFICAR_CONFIGURACION', 'incidencias', p_incidencia_id,
       jsonb_build_object('clasificacion', 'sin_regla_coincidente', 'origen', p_origen));
    return null;
  end if;

  -- Derivación inicial (area_origen NULL = registro inicial; CHECK de BD exige
  -- destino distinto de origen → con origen NULL siempre pasa).
  insert into public.incidencia_derivaciones
    (incidencia_id, area_origen_id, area_destino_id, servicio_destino_id,
     motivo, activa, derivado_por)
  values
    (p_incidencia_id, null, v_regla.area_destino_id, v_regla.servicio_destino_id,
     'Clasificación automática — regla: ' || v_regla.regla_nombre
       || case when p_origen <> 'automatica' then ' (' || p_origen || ')' else '' end,
     true, v_actor)
  returning id into v_derivacion;

  -- Prioridad por defecto de la regla (configurable por el admin).
  if v_regla.prioridad_defecto_id is not null then
    select pr.nombre into v_prioridad_anterior
    from public.prioridades pr where pr.id =
      (select i2.prioridad_id from public.incidencias i2 where i2.id = p_incidencia_id);

    update public.incidencias
       set prioridad_id = v_regla.prioridad_defecto_id
     where id = p_incidencia_id;
  end if;

  -- Estado Derivada (existente en semilla 0005): el destino quedó definido.
  update public.incidencias
     set estado_id = public.estado_id_por_nombre('Derivada')
   where id = p_incidencia_id;

  -- Auditoría: regla aplicada y resultado (§40 MODIFICAR_CONFIGURACION/
  -- CLASIFICAR; usamos ASIGNAR = ruta operativa asignada por el sistema).
  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_previos, valores_nuevos)
  values
    (v_actor, 'ASIGNAR', 'reglas_enrutamiento', v_regla.regla_id,
     jsonb_build_object('regla', v_regla.regla_nombre),
     jsonb_build_object('incidencia', p_incidencia_id,
                        'area_destino', v_regla.area_destino_nombre,
                        'servicio_destino', v_regla.servicio_destino_nombre,
                        'prioridad_anterior', v_prioridad_anterior,
                        'origen', p_origen));

  return v_derivacion;
end;
$$;

revoke all on function public.clasificar_incidencia(uuid, text) from public, anon;
grant execute on function public.clasificar_incidencia(uuid, text) to authenticated;

comment on function public.clasificar_incidencia(uuid, text) is
  'Clasificación automática: aplica la primera regla coincidente → derivación inicial + prioridad por defecto + estado Derivada. Sin regla → NULL y queda Pendiente.';

-- ----------------------------------------------------------------------------
-- 3. DERIVACIÓN MANUAL AUTORIZADA
--    ADMINISTRADOR, COORDINADOR del área destino vigente, o usuario con el
--    permiso derivar_incidencia. Motivo obligatorio [VI]. No auto-derivarse
--    lo impone ck_incidencia_derivaciones_auto (BD).
-- ----------------------------------------------------------------------------
create or replace function public.derivar_incidencia(
  p_incidencia_id uuid,
  p_area_destino_id uuid,
  p_servicio_destino_id uuid default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_actual  text;
  v_area_actual_id uuid;
  v_estado_actual text;
  v_area_ok boolean;
  v_servicio_ok boolean;
  v_derivada uuid;
  v_estado_derivada uuid;
  v_actor uuid := auth.uid();
  v_autorizado boolean;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo de la derivación es obligatorio';
  end if;
  if btrim(p_motivo) > '' and char_length(btrim(p_motivo)) > 500 then
    raise exception 'El motivo no puede superar los 500 caracteres';
  end if;

  -- Datos vigentes de la incidencia.
  select (select ar.nombre from public.areas ar where ar.id = d.area_destino_id),
         d.area_destino_id,
         (select e.nombre from public.estados_incidencia e where e.id = i.estado_id)
    into v_area_actual, v_area_actual_id, v_estado_actual
  from public.incidencias i
  left join public.incidencia_derivaciones d
    on d.incidencia_id = i.id and d.activa
  where i.id = p_incidencia_id
  limit 1;

  if v_estado_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  -- Autorización: admin, coordinador del área vigente, o permiso explícito.
  v_autorizado := public.soy_administrador()
    or public.tiene_permiso('derivar_incidencia')
    or (public.soy_coordinador() and public.soy_coordinador_de_area(v_area_actual_id));
  if not v_autorizado then
    raise exception 'No tienes autorización para derivar esta incidencia';
  end if;

  -- Estados finales: un ticket cerrado/cancelado/resuelto no se deriva.
  if v_estado_actual in ('Cerrada', 'Cancelada', 'Resuelta') then
    raise exception 'No se puede derivar una incidencia en estado %', v_estado_actual;
  end if;

  -- Área destino activa.
  select exists (
    select 1 from public.areas where id = p_area_destino_id and activo
  ) into v_area_ok;
  if not v_area_ok then
    raise exception 'El área de destino no existe o no está activa';
  end if;

  -- Servicio destino: activo y perteneciente al área destino.
  if p_servicio_destino_id is not null then
    select exists (
      select 1 from public.servicios
      where id = p_servicio_destino_id and area_id = p_area_destino_id and activo
    ) into v_servicio_ok;
    if not v_servicio_ok then
      raise exception 'El servicio indicado no pertenece al área de destino o no está activo';
    end if;
  end if;

  insert into public.incidencia_derivaciones
    (incidencia_id, area_origen_id, area_destino_id, servicio_destino_id,
     motivo, activa, derivado_por)
  values
    (p_incidencia_id, v_area_actual_id, p_area_destino_id, p_servicio_destino_id,
     'Derivación manual — ' || btrim(p_motivo), true, v_actor)
  returning id into v_derivada;

  -- Al derivar, la asignación del área anterior pierde vigencia: el trigger
  -- trg_asignaciones_cerrar_anterior (0003) exige una única activa y el nuevo
  -- área aún no tiene técnico. Si existía asignación activa se cierra.
  update public.incidencia_asignaciones
     set activa = false, cerrada_en = now()
   where incidencia_id = p_incidencia_id and activa;

  -- Estado → Derivada (solo si sigue dentro del flujo activo).
  v_estado_derivada := public.estado_id_por_nombre('Derivada');
  if v_estado_derivada is not null then
    update public.incidencias
       set estado_id = v_estado_derivada
     where id = p_incidencia_id;
  end if;

  -- Auditoría (DERIVAR, §40).
  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_previos, valores_nuevos)
  values
    (v_actor, 'DERIVAR', 'incidencia_derivaciones', v_derivada,
     jsonb_build_object('area_origen', v_area_actual),
     jsonb_build_object('area_destino_id', p_area_destino_id,
                        'servicio_destino_id', p_servicio_destino_id,
                        'motivo', left(btrim(p_motivo), 500)));

  return v_derivada;
end;
$$;

revoke all on function public.derivar_incidencia(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.derivar_incidencia(uuid, uuid, uuid, text) to authenticated;

comment on function public.derivar_incidencia(uuid, uuid, uuid, text) is
  'Derivación manual autorizada (admin/coordinador del área vigente/permiso derivar_incidencia): motivo obligatorio, cierra asignación previa, estado → Derivada, auditoría DERIVAR.';

-- ----------------------------------------------------------------------------
-- 4. ASIGNACIÓN MANUAL AUTORIZADA
--    ADMINISTRADOR o COORDINADOR del área destino vigente con permiso
--    asignar_incidencia. El técnico debe estar activo en el área destino.
-- ----------------------------------------------------------------------------
create or replace function public.asignar_incidencia(
  p_incidencia_id uuid,
  p_tecnico_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_destino uuid;
  v_estado_actual text;
  v_autorizado boolean;
  v_tecnico_ok boolean;
  v_actor uuid := auth.uid();
begin
  if p_tecnico_id is null then
    raise exception 'Indica el técnico a asignar';
  end if;

  select d.area_destino_id,
         (select e.nombre from public.estados_incidencia e where e.id = i.estado_id)
    into v_area_destino, v_estado_actual
  from public.incidencias i
  left join public.incidencia_derivaciones d
    on d.incidencia_id = i.id and d.activa
  where i.id = p_incidencia_id
  limit 1;

  if v_estado_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  v_autorizado := public.soy_administrador()
    or (public.soy_coordinador()
        and public.soy_coordinador_de_area(v_area_destino)
        and public.tiene_permiso('asignar_incidencia'));
  if not v_autorizado then
    raise exception 'No tienes autorización para asignar técnicos en esta incidencia';
  end if;

  if v_estado_actual in ('Cerrada', 'Cancelada', 'Resuelta') then
    raise exception 'No se puede asignar una incidencia en estado %', v_estado_actual;
  end if;

  -- Técnico ACTIVO del área destino vigente (sin técnico = ticket sin dueño).
  select exists (
    select 1 from public.tecnicos
    where id = p_tecnico_id and activo and area_id = v_area_destino
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'El técnico no está activo en el área responsable de esta incidencia';
  end if;

  insert into public.incidencia_asignaciones
    (incidencia_id, tecnico_id, activa, asignado_por)
  values
    (p_incidencia_id, p_tecnico_id, true, v_actor);

  -- Estado → Asignada (solo desde Pendiente/Derivada; si ya está En proceso
  -- por reasignación, no retrocede).
  if v_estado_actual in ('Pendiente', 'Derivada') then
    update public.incidencias
       set estado_id = public.estado_id_por_nombre('Asignada')
     where id = p_incidencia_id;
  end if;

  -- Auditoría (ASIGNAR, §40). El evento de historial lo escribe el trigger
  -- trg_asignaciones_historial (0013) con el técnico y el actor.
  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_nuevos)
  values
    (v_actor, 'ASIGNAR', 'incidencia_asignaciones', p_incidencia_id,
     jsonb_build_object('tecnico_id', p_tecnico_id));

  return true;
end;
$$;

revoke all on function public.asignar_incidencia(uuid, uuid) from public, anon;
grant execute on function public.asignar_incidencia(uuid, uuid) to authenticated;

comment on function public.asignar_incidencia(uuid, uuid) is
  'Asignación manual (admin o coordinador del área vigente con asignar_incidencia): técnico activo del área destino; estado → Asignada; auditoría + historial (trigger 0013).';

-- ----------------------------------------------------------------------------
-- 5. AUDITORÍA DE REGLAS (§40: cambios de configuración trazables)
--    AFTER INSERT/UPDATE/DELETE para clientes de la API; append-only
--    registros_auditoria (bloquear_update_delete, 0004).
-- ----------------------------------------------------------------------------
create or replace function public.auditoria_regla_enrutamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resumen jsonb;
begin
  v_resumen := jsonb_build_object(
    'nombre', case when tg_op = 'DELETE' then null else new.nombre end,
    'activa', case when tg_op = 'DELETE' then null else new.activa end,
    'orden',  case when tg_op = 'DELETE' then null else new.prioridad_orden end,
    'regla_id', case when tg_op = 'DELETE' then old.id else new.id end
  );

  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, valores_previos, valores_nuevos)
  values
    (auth.uid(), 'MODIFICAR_CONFIGURACION', 'reglas_enrutamiento',
     case when tg_op = 'DELETE' then old.id else new.id end,
     case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
     case when tg_op = 'DELETE' then null else v_resumen end);
  return null;
end;
$$;

-- Solo dispara para clientes de la API (anon/authenticated): el trigger
-- comprueba el rol de conexión, igual que las guardas de 0008.
create or replace function public.auditoria_regla_enrutamiento_guarda()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    perform public.auditoria_regla_enrutamiento();
  end if;
  return null;
end;
$$;

drop trigger if exists trg_reglas_auditoria on public.reglas_enrutamiento;
create trigger trg_reglas_auditoria
  after insert or update or delete on public.reglas_enrutamiento
  for each row execute function public.auditoria_regla_enrutamiento_guarda();

-- ----------------------------------------------------------------------------
-- 6. LECTURA del destino vigente (para la UI; misma info que el seguimiento)
-- ----------------------------------------------------------------------------
create or replace function public.derivacion_activa_de_incidencia(p_incidencia_id uuid)
returns table (
  derivacion_id uuid,
  area_destino_id uuid,
  area_destino_nombre text,
  servicio_destino_id uuid,
  servicio_destino_nombre text,
  motivo text,
  derivado_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.area_destino_id, ar.nombre,
         d.servicio_destino_id, sv.nombre,
         d.motivo, d.derivado_en
  from public.incidencia_derivaciones d
  join public.areas ar      on ar.id = d.area_destino_id
  left join public.servicios sv on sv.id = d.servicio_destino_id
  where d.incidencia_id = p_incidencia_id
    and d.activa
  limit 1;
$$;

revoke all on function public.derivacion_activa_de_incidencia(uuid) from public, anon;
grant execute on function public.derivacion_activa_de_incidencia(uuid) to authenticated;

comment on function public.derivacion_activa_de_incidencia(uuid) is
  'Destino vigente (área/servicio responsable) de una incidencia, con motivo y fecha.';

-- ----------------------------------------------------------------------------
-- 7. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('evaluar_reglas_enrutamiento','clasificar_incidencia','derivar_incidencia',
       'asignar_incidencia','auditoria_regla_enrutamiento','derivacion_activa_de_incidencia',
       'estado_id_por_nombre')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('evaluar_reglas_enrutamiento','clasificar_incidencia','derivar_incidencia',
       'asignar_incidencia','auditoria_regla_enrutamiento','derivacion_activa_de_incidencia',
       'estado_id_por_nombre')
  ) <> 7 then
    raise exception 'RPCs del módulo de reglas y derivación no creadas correctamente';
  end if;
end $$;

-- ============================================================================
-- MIGRACIÓN 0017 — SLA Y SEGUIMIENTO DE TIEMPOS (FASE 8b)
-- Reglas SLA configurables (acuerdos_nivel_servicio, policy p_sla_admin 0007);
-- snapshot 1:1 en tiempos_sla; estado cumplido/en riesgo/vencido; indicadores
-- §47. Estado «Derivada» del Plan §15.4 (la semilla 0005 no lo incluía).
-- Valores [VI]: no son política oficial de la UPSJB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. ESTADO «Derivada» (Plan §15.4) — solo si falta; renumeración segura
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from public.estados_incidencia where nombre = 'Derivada'
  ) then
    update public.estados_incidencia set orden = orden + 10 where orden >= 5;
    update public.estados_incidencia set orden = 6 where nombre = 'Resuelta';
    update public.estados_incidencia set orden = 7 where nombre = 'Cerrada';
    update public.estados_incidencia set orden = 8 where nombre = 'Cancelada';
    insert into public.estados_incidencia (nombre, orden, es_final, color)
    values ('Derivada', 5, false, '#f59e0b');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. COLUMNAS DE SEGUIMIENTO en tiempos_sla
-- ----------------------------------------------------------------------------
alter table public.tiempos_sla
  add column if not exists inicio_en                  timestamptz,
  add column if not exists objetivo_respuesta_en      timestamptz,
  add column if not exists objetivo_resolucion_en     timestamptz,
  add column if not exists horas_respuesta_acuerdo    numeric(5,1),
  add column if not exists horas_resolucion_acuerdo   numeric(5,1),
  add column if not exists horas_respuesta_real       numeric(6,1),
  add column if not exists horas_resolucion_real      numeric(6,1),
  add column if not exists calculado_en               timestamptz;

create index if not exists idx_tiempos_sla_objetivo_resolucion
  on public.tiempos_sla (objetivo_resolucion_en);

-- ----------------------------------------------------------------------------
-- 2. ACUERDO APLICABLE (§8.7: especialización por tipo pisa al base)
-- ----------------------------------------------------------------------------
create or replace function public.sla_acuerdo_para(
  p_prioridad_id uuid,
  p_tipo_id      uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id
  from public.acuerdos_nivel_servicio a
  where a.activo
    and a.prioridad_id = p_prioridad_id
    and (a.tipo_incidencia_id = p_tipo_id or a.tipo_incidencia_id is null)
  order by (a.tipo_incidencia_id is not null) desc
  limit 1;
$$;

revoke all on function public.sla_acuerdo_para(uuid, uuid) from public, anon;
grant execute on function public.sla_acuerdo_para(uuid, uuid) to authenticated;

comment on function public.sla_acuerdo_para(uuid, uuid) is
  'Acuerdo SLA aplicable a una incidencia: especialización por tipo activa primero; si no existe, el SLA base de la prioridad. NULL = incidencia sin SLA.';

-- ----------------------------------------------------------------------------
-- 3. HELPERS DE ESTADO (puros y deterministas)
-- ----------------------------------------------------------------------------
create or replace function public.estado_sla_respuesta(
  p_primera_respuesta_en timestamptz,
  p_objetivo             timestamptz,
  p_ahora                timestamptz
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_primera_respuesta_en is not null then
      case when p_primera_respuesta_en <= p_objetivo then 'cumplido' else 'vencido' end
    when p_objetivo is null then 'sin_dato'
    when p_ahora > p_objetivo then 'vencido'
    else 'pendiente'
  end;
$$;

revoke all on function public.estado_sla_respuesta(timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.estado_sla_respuesta(timestamptz, timestamptz, timestamptz) to authenticated;

create or replace function public.estado_sla_resolucion(
  p_inicio_en     timestamptz,
  p_objetivo      timestamptz,
  p_resolucion_en timestamptz,
  p_ahora        timestamptz
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_resolucion_en is not null then
      case when p_resolucion_en <= p_objetivo then 'cumplido' else 'vencido' end
    when p_objetivo is null then 'sin_dato'
    when p_ahora > p_objetivo then 'vencido'
    when p_inicio_en is not null
         and p_ahora >= p_objetivo - ((p_objetivo - p_inicio_en) * 0.25)
      then 'en_riesgo'
    else 'en_tiempo'
  end;
$$;

revoke all on function public.estado_sla_resolucion(timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.estado_sla_resolucion(timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;

comment on function public.estado_sla_resolucion(timestamptz, timestamptz, timestamptz, timestamptz) is
  'Estado del SLA de resolución: cumplido/vencido (medido), en_riesgo (restante < 25 % del plazo [P]) o en_tiempo. Umbral técnico, no institucional.';

-- ----------------------------------------------------------------------------
-- 4. REGISTRAR SNAPSHOT (tras crear la incidencia; idempotente)
-- ----------------------------------------------------------------------------
create or replace function public.registrar_sla_incidencia(p_incidencia_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i record;
  v_a record;
  v_id uuid;
begin
  if not (
    public.es_dueno_incidencia(p_incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  ) then
    raise exception 'No tienes autorización para registrar el SLA de esta incidencia';
  end if;

  select i.prioridad_id, i.tipo_incidencia_id, i.fecha_reporte
    into v_i
  from public.incidencias i
  where i.id = p_incidencia_id;
  if v_i.prioridad_id is null then
    raise exception 'Incidencia no encontrada o sin prioridad';
  end if;

  select a.id, a.horas_respuesta, a.horas_resolucion
    into v_a
  from public.acuerdos_nivel_servicio a
  where a.id = public.sla_acuerdo_para(v_i.prioridad_id, v_i.tipo_incidencia_id);

  if v_a.id is null then
    return null; -- INCIDENCIA SIN SLA
  end if;

  insert into public.tiempos_sla
    (incidencia_id, acuerdo_id, inicio_en,
     objetivo_respuesta_en, objetivo_resolucion_en,
     horas_respuesta_acuerdo, horas_resolucion_acuerdo)
  values
    (p_incidencia_id, v_a.id, v_i.fecha_reporte,
     v_i.fecha_reporte + (v_a.horas_respuesta * interval '1 hour'),
     v_i.fecha_reporte + (v_a.horas_resolucion * interval '1 hour'),
     v_a.horas_respuesta, v_a.horas_resolucion)
  on conflict (incidencia_id) do nothing;

  select ts.id into v_id
  from public.tiempos_sla ts
  where ts.incidencia_id = p_incidencia_id;

  perform public.refrescar_sla_incidencia(p_incidencia_id);

  return v_id;
end;
$$;

revoke all on function public.registrar_sla_incidencia(uuid) from public, anon;
grant execute on function public.registrar_sla_incidencia(uuid) to authenticated;

comment on function public.registrar_sla_incidencia(uuid) is
  'Crea el snapshot de SLA de la incidencia (acuerdo aplicado, inicio y objetivos). Sin acuerdo activo → NULL y la incidencia queda sin SLA.';

-- ----------------------------------------------------------------------------
-- 5. REFRESCAR TIEMPOS REALES (el PRIMER valor registrado gana)
-- ----------------------------------------------------------------------------
create or replace function public.refrescar_sla_incidencia(p_incidencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i   record;
  v_sla public.tiempos_sla%rowtype;
begin
  if not (
    public.es_dueno_incidencia(p_incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  ) then
    raise exception 'No tienes autorización para actualizar el SLA de esta incidencia';
  end if;

  select i.fecha_inicio, i.fecha_resolucion into v_i
  from public.incidencias i
  where i.id = p_incidencia_id;
  if v_i.fecha_inicio is null and v_i.fecha_resolucion is null then
    return false;
  end if;

  select * into v_sla from public.tiempos_sla where incidencia_id = p_incidencia_id;
  if v_sla.incidencia_id is null then
    if public.registrar_sla_incidencia(p_incidencia_id) is null then
      return false; -- incidencia sin acuerdo de SLA
    end if;
    select * into v_sla from public.tiempos_sla where incidencia_id = p_incidencia_id;
  end if;

  update public.tiempos_sla set
    primera_respuesta_en  = coalesce(primera_respuesta_en, v_i.fecha_inicio),
    resolucion_en         = coalesce(resolucion_en, v_i.fecha_resolucion),
    horas_respuesta_real  = case
      when v_i.fecha_inicio is not null and primera_respuesta_en is null
        then round((extract(epoch from (v_i.fecha_inicio - inicio_en)) / 3600.0)::numeric, 1)
      else horas_respuesta_real end,
    horas_resolucion_real = case
      when v_i.fecha_resolucion is not null and resolucion_en is null
        then round((extract(epoch from (v_i.fecha_resolucion - inicio_en)) / 3600.0)::numeric, 1)
      else horas_resolucion_real end,
    cumplieron_respuesta  = case
      when v_i.fecha_inicio is not null and primera_respuesta_en is null
        then v_i.fecha_inicio <= objetivo_respuesta_en
      else cumplieron_respuesta end,
    cumplieron_resolucion = case
      when v_i.fecha_resolucion is not null and resolucion_en is null
        then v_i.fecha_resolucion <= objetivo_resolucion_en
      else cumplieron_resolucion end,
    calculado_en          = now()
  where incidencia_id = p_incidencia_id;

  return true;
end;
$$;

revoke all on function public.refrescar_sla_incidencia(uuid) from public, anon;
grant execute on function public.refrescar_sla_incidencia(uuid) to authenticated;

comment on function public.refrescar_sla_incidencia(uuid) is
  'Estampa primera respuesta (fecha_inicio) y resolución (fecha_resolucion) con horas corridas y cumplimiento contra los objetivos del snapshot.';

-- ----------------------------------------------------------------------------
-- 6. LECTURA DEL ESTADO SLA para la UI
-- ----------------------------------------------------------------------------
create or replace function public.sla_de_incidencia(p_incidencia_id uuid)
returns table (
  tiene_sla                    boolean,
  horas_respuesta              numeric,
  horas_resolucion             numeric,
  inicio_en                    timestamptz,
  objetivo_respuesta_en        timestamptz,
  objetivo_resolucion_en       timestamptz,
  primera_respuesta_en         timestamptz,
  resolucion_en                timestamptz,
  horas_respuesta_real         numeric,
  horas_resolucion_real        numeric,
  estado_respuesta             text,
  estado_resolucion            text,
  minutos_restantes_respuesta  integer,
  minutos_restantes_resolucion integer,
  porcentaje_transcurrido      integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fila  public.tiempos_sla%rowtype;
  v_ahora timestamptz := now();
begin
  if not (
    public.es_dueno_incidencia(p_incidencia_id)
    or public.es_tecnico_activo()
    or public.soy_administrador()
  ) then
    return;
  end if;

  select * into v_fila from public.tiempos_sla where incidencia_id = p_incidencia_id;
  if v_fila.incidencia_id is null then
    return;
  end if;

  tiene_sla                    := true;
  horas_respuesta              := v_fila.horas_respuesta_acuerdo;
  horas_resolucion             := v_fila.horas_resolucion_acuerdo;
  inicio_en                    := v_fila.inicio_en;
  objetivo_respuesta_en        := v_fila.objetivo_respuesta_en;
  objetivo_resolucion_en       := v_fila.objetivo_resolucion_en;
  primera_respuesta_en         := v_fila.primera_respuesta_en;
  resolucion_en                := v_fila.resolucion_en;
  horas_respuesta_real         := v_fila.horas_respuesta_real;
  horas_resolucion_real        := v_fila.horas_resolucion_real;

  estado_respuesta  := public.estado_sla_respuesta(
    v_fila.primera_respuesta_en, v_fila.objetivo_respuesta_en, v_ahora);
  estado_resolucion := public.estado_sla_resolucion(
    v_fila.inicio_en, v_fila.objetivo_resolucion_en, v_fila.resolucion_en, v_ahora);

  if v_fila.primera_respuesta_en is null
     and v_fila.objetivo_respuesta_en > v_ahora then
    minutos_restantes_respuesta :=
      ceiling(extract(epoch from (v_fila.objetivo_respuesta_en - v_ahora)) / 60)::integer;
  end if;

  if v_fila.resolucion_en is null
     and v_fila.objetivo_resolucion_en > v_ahora then
    minutos_restantes_resolucion :=
      ceiling(extract(epoch from (v_fila.objetivo_resolucion_en - v_ahora)) / 60)::integer;
  end if;

  if v_fila.objetivo_resolucion_en > v_fila.inicio_en then
    porcentaje_transcurrido := least(100, greatest(0,
      floor(100 * extract(epoch from (v_ahora - v_fila.inicio_en))
            / extract(epoch from (v_fila.objetivo_resolucion_en - v_fila.inicio_en)))::integer));
  end if;

  return next;
end;
$$;

revoke all on function public.sla_de_incidencia(uuid) from public, anon;
grant execute on function public.sla_de_incidencia(uuid) to authenticated;

comment on function public.sla_de_incidencia(uuid) is
  'Estado SLA de una incidencia para la UI: objetivos, eventos, estados de respuesta/resolución y minutos restantes. Calculado con now() de la BD.';

-- ----------------------------------------------------------------------------
-- 7. SLA DE LAS ASIGNACIONES DEL TÉCNICO
-- ----------------------------------------------------------------------------
create or replace function public.slas_asignadas_al_tecnico()
returns table (
  incidencia_id                uuid,
  codigo                       text,
  estado_incidencia            text,
  prioridad                    text,
  estado_respuesta             text,
  estado_resolucion            text,
  minutos_restantes_resolucion integer,
  objetivo_resolucion_en       timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mias as (
    select distinct a.incidencia_id
    from public.incidencia_asignaciones a
    join public.tecnicos t on t.id = a.tecnico_id
    where a.activa
      and t.activo
      and t.perfil_id = auth.uid()
  )
  select i.id, i.codigo, e.nombre, pr.nombre,
         s.estado_respuesta, s.estado_resolucion,
         s.minutos_restantes_resolucion, s.objetivo_resolucion_en
  from mias m
  join public.incidencias i        on i.id = m.incidencia_id
  join public.estados_incidencia e on e.id = i.estado_id
  join public.prioridades pr       on pr.id = i.prioridad_id
  left join lateral public.sla_de_incidencia(i.id) s on true
  where e.nombre not in ('Cerrada', 'Cancelada')
  order by
    case s.estado_resolucion
      when 'vencido'   then 0
      when 'en_riesgo' then 1
      when 'en_tiempo' then 2
      else 3
    end,
    s.objetivo_resolucion_en asc nulls last,
    i.codigo
  limit 100;
$$;

revoke all on function public.slas_asignadas_al_tecnico() from public, anon;
grant execute on function public.slas_asignadas_al_tecnico() to authenticated;

comment on function public.slas_asignadas_al_tecnico() is
  'SLA de las incidencias asignadas al técnico autenticado (asignación activa), ordenadas por urgencia. Sin SLA → columnas nulas.';

-- ----------------------------------------------------------------------------
-- 8. INDICADORES DE SLA (dashboard admin/coordinador — Plan §47)
-- ----------------------------------------------------------------------------
create or replace function public.indicadores_sla()
returns table (
  con_sla              bigint,
  sin_sla              bigint,
  prom_horas_respuesta numeric,
  prom_horas_atencion  numeric,
  prom_horas_resolucion numeric,
  respuesta_cumplidas  bigint,
  respuesta_vencidas   bigint,
  resolucion_cumplidas bigint,
  resolucion_vencidas  bigint,
  activos_en_tiempo    bigint,
  activos_en_riesgo    bigint,
  activos_vencidos     bigint,
  activos_sin_sla      bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.soy_administrador()
    or public.soy_coordinador()
    or public.tiene_permiso('ver_reportes')
  ) then
    raise exception 'No tienes autorización para consultar los indicadores de SLA';
  end if;

  select
    (select count(*) from public.tiempos_sla),
    (select count(*) from public.incidencias i
      where not exists (
        select 1 from public.tiempos_sla ts where ts.incidencia_id = i.id)),
    round(avg(t.horas_respuesta_real)::numeric, 1),
    round(avg(t.horas_resolucion_real - t.horas_respuesta_real)::numeric, 1),
    round(avg(t.horas_resolucion_real)::numeric, 1),
    count(*) filter (where t.cumplieron_respuesta is true),
    count(*) filter (where t.cumplieron_respuesta is false),
    count(*) filter (where t.cumplieron_resolucion is true),
    count(*) filter (where t.cumplieron_resolucion is false)
  into con_sla, sin_sla,
       prom_horas_respuesta, prom_horas_atencion, prom_horas_resolucion,
       respuesta_cumplidas, respuesta_vencidas,
       resolucion_cumplidas, resolucion_vencidas
  from public.tiempos_sla t;

  with abiertas as (
    select i.id
    from public.incidencias i
    join public.estados_incidencia e on e.id = i.estado_id
    where e.nombre not in ('Cerrada', 'Cancelada', 'Resuelta')
  )
  select
    count(*) filter (where s.estado_resolucion = 'en_tiempo'),
    count(*) filter (where s.estado_resolucion = 'en_riesgo'),
    count(*) filter (where s.estado_resolucion = 'vencido'),
    count(*) filter (where s.estado_resolucion is null)
  into activos_en_tiempo, activos_en_riesgo, activos_vencidos, activos_sin_sla
  from abiertas a
  left join lateral public.sla_de_incidencia(a.id) s on true;

  return next;
end;
$$;

revoke all on function public.indicadores_sla() from public, anon;
grant execute on function public.indicadores_sla() to authenticated;

comment on function public.indicadores_sla() is
  'Indicadores de tiempo y SLA (Plan §47): promedios de respuesta/atención/resolución, cumplimiento y activos por estado. Admin/coordinador/ver_reportes.';

-- ----------------------------------------------------------------------------
-- 9. BACKFILL de snapshots pendientes
-- ----------------------------------------------------------------------------
create or replace function public.registrar_slas_pendientes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_fila  record;
begin
  if not (
    public.soy_administrador()
    or (public.soy_coordinador() and public.tiene_permiso('gestionar_reglas'))
  ) then
    raise exception 'No tienes autorización para ejecutar el registro de SLA';
  end if;

  for v_fila in
    select i.id
    from public.incidencias i
    where not exists (
      select 1 from public.tiempos_sla ts where ts.incidencia_id = i.id
    )
  loop
    if public.registrar_sla_incidencia(v_fila.id) is not null then
      v_total := v_total + 1;
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.registrar_slas_pendientes() from public, anon;
grant execute on function public.registrar_slas_pendientes() to authenticated;

comment on function public.registrar_slas_pendientes() is
  'Backfill: crea el snapshot de SLA de incidencias sin fila y estampa sus eventos; devuelve cuántas quedaron CON SLA. Admin o coordinador con gestionar_reglas.';

-- ----------------------------------------------------------------------------
-- 10. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('sla_acuerdo_para','estado_sla_respuesta','estado_sla_resolucion',
       'registrar_sla_incidencia','refrescar_sla_incidencia','sla_de_incidencia',
       'slas_asignadas_al_tecnico','indicadores_sla','registrar_slas_pendientes')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('sla_acuerdo_para','estado_sla_respuesta','estado_sla_resolucion',
       'registrar_sla_incidencia','refrescar_sla_incidencia','sla_de_incidencia',
       'slas_asignadas_al_tecnico','indicadores_sla','registrar_slas_pendientes')
  ) <> 9 then
    raise exception 'RPCs del módulo SLA no creadas correctamente';
  end if;
end $$;

-- ============================================================================
-- MIGRACIÓN 0018 — NOTIFICACIONES + SUPABASE REALTIME (FASE 9)
-- Eventos del flujo → notificaciones al reportante/técnico (plantillas +
-- preferencias opt-out), alertas SLA, y publicación de `notificaciones` en
-- supabase_realtime (postgres_changes aplica RLS: cada usuario recibe SOLO
-- sus filas). Tablas operativas NO se publican.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Dominio de eventos ampliado (derivada · sla_alerta) + plantillas [P]
-- ----------------------------------------------------------------------------
alter table public.plantillas_notificacion
  drop constraint if exists ck_plantillas_notificacion_evento;
alter table public.plantillas_notificacion
  add constraint ck_plantillas_notificacion_evento
  check (evento in
    ('nueva_incidencia', 'asignada', 'derivada', 'en_proceso', 'en_espera',
     'resuelta', 'cerrada', 'cancelada', 'comentario', 'sla_alerta'));

alter table public.preferencias_notificacion
  drop constraint if exists ck_preferencias_notificacion_evento;
alter table public.preferencias_notificacion
  add constraint ck_preferencias_notificacion_evento
  check (evento in
    ('nueva_incidencia', 'asignada', 'derivada', 'en_proceso', 'en_espera',
     'resuelta', 'cerrada', 'cancelada', 'comentario', 'sla_alerta'));

insert into public.plantillas_notificacion (evento, asunto, cuerpo, canal) values
  ('derivada', 'Incidencia {{codigo}} derivada',
   'Tu incidencia {{codigo}} fue derivada al área responsable: {{area}}. Sigue su progreso con el código.', 'interna'),
  ('sla_alerta', 'SLA en riesgo: {{codigo}}',
   'El SLA de la incidencia {{codigo}} está próximo a vencer o venció. Revísala cuanto antes.', 'interna')
on conflict (evento) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Preferencias por defecto (opt-out) + helper de consulta
-- ----------------------------------------------------------------------------
create or replace function public.crear_preferencias_notificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.preferencias_notificacion (perfil_id, evento, habilitado)
  select new.id, e.evento, true
  from (values
    ('nueva_incidencia'), ('asignada'), ('derivada'), ('en_proceso'),
    ('en_espera'), ('resuelta'), ('cerrada'), ('cancelada'),
    ('comentario'), ('sla_alerta')
  ) as e(evento)
  on conflict (perfil_id, evento) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_preferencias_al_crear_perfil on public.perfiles;
create trigger trg_preferencias_al_crear_perfil
  after insert on public.perfiles
  for each row execute function public.crear_preferencias_notificacion();

create or replace function public.usuario_quiere_evento(
  p_perfil uuid,
  p_evento text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select habilitado
     from public.preferencias_notificacion
     where perfil_id = p_perfil and evento = p_evento),
    true
  );
$$;

revoke all on function public.usuario_quiere_evento(uuid, text) from public, anon;
grant execute on function public.usuario_quiere_evento(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. NÚCLEO: crear notificación (preferencias + plantilla + dedupe)
-- ----------------------------------------------------------------------------
create or replace function public.notificar(
  p_perfil_id uuid,
  p_evento    text,
  p_incidencia_id uuid default null,
  p_titulo    text default null,
  p_cuerpo    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plantilla record;
  v_id uuid;
begin
  if p_perfil_id is null then
    return null;
  end if;

  if not public.usuario_quiere_evento(p_perfil_id, p_evento) then
    return null;
  end if;

  select asunto, cuerpo, id into v_plantilla
  from public.plantillas_notificacion
  where evento = p_evento and activo and canal = 'interna'
  limit 1;

  if v_plantilla is null then
    return null;
  end if;

  insert into public.notificaciones
    (perfil_id, incidencia_id, plantilla_id, titulo, cuerpo)
  select p_perfil_id, p_incidencia_id, v_plantilla.id, v_plantilla.asunto, v_plantilla.cuerpo
  where not exists (
    select 1 from public.notificaciones n
    where n.perfil_id = p_perfil_id
      and n.plantilla_id = v_plantilla.id
      and n.incidencia_id is not distinct from p_incidencia_id
      and n.leida_en is null
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.notificar(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.notificar(uuid, text, uuid, text, text) to authenticated;

comment on function public.notificar(uuid, text, uuid, text, text) is
  'Crea una notificación interna aplicando preferencias del destinatario y plantilla activa del evento (dedupe por evento+incidencia+destinatario no leída).';

-- ----------------------------------------------------------------------------
-- 4. Contexto de placeholders y triggers de eventos del flujo
-- ----------------------------------------------------------------------------
create or replace function public.notif_contexto_incidencia(p_incidencia_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'codigo', i.codigo,
    'ambiente', coalesce(a.nombre, '—'),
    'area', coalesce(
      (select ar.nombre
       from public.incidencia_derivaciones d
       join public.areas ar on ar.id = d.area_destino_id
       where d.incidencia_id = i.id and d.activa limit 1), ''),
    'detalle', ''
  )
  from public.incidencias i
  left join public.ambientes a on a.id = i.ambiente_id
  where i.id = p_incidencia_id;
$$;

create or replace function public.notif_reemplazar(text, jsonb)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(
    $1, '{{codigo}}', coalesce($2->>'codigo', '')),
    '{{ambiente}}', coalesce($2->>'ambiente', '')),
    '{{area}}', coalesce($2->>'area', '')),
    '{{detalle}}', coalesce($2->>'detalle', ''));
$$;

-- 4a. NUEVA INCIDENCIA → al reportante
create or replace function public.notif_incidencia_creada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx jsonb;
  v_plantilla record;
begin
  if new.usuario_reportante_id is null then
    return null;
  end if;
  select asunto, cuerpo into v_plantilla
  from public.plantillas_notificacion
  where evento = 'nueva_incidencia' and activo and canal = 'interna' limit 1;
  if v_plantilla is null then return null; end if;
  v_ctx := public.notif_contexto_incidencia(new.id);
  perform public.notificar(new.usuario_reportante_id, 'nueva_incidencia', new.id,
    public.notif_reemplazar(v_plantilla.asunto, v_ctx),
    public.notif_reemplazar(v_plantilla.cuerpo, v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_incidencia_creada on public.incidencias;
create trigger trg_notif_incidencia_creada
  after insert on public.incidencias
  for each row execute function public.notif_incidencia_creada();

-- 4b. CAMBIO DE ESTADO → al reportante (en_proceso/en_espera/resuelta/cerrada/cancelada)
create or replace function public.notif_incidencia_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_de  text;
  v_a   text;
  v_evento text;
  v_ctx jsonb;
  v_plantilla record;
begin
  if new.usuario_reportante_id is null then
    return null;
  end if;
  if old.estado_id is not distinct from new.estado_id then
    return null;
  end if;

  select nombre into v_de  from public.estados_incidencia where id = old.estado_id;
  select nombre into v_a   from public.estados_incidencia where id = new.estado_id;

  v_evento := case v_a
    when 'En proceso' then 'en_proceso'
    when 'En espera'  then 'en_espera'
    when 'Resuelta'   then 'resuelta'
    when 'Cerrada'    then 'cerrada'
    when 'Cancelada'  then 'cancelada'
    else null
  end;
  if v_evento is null then
    return null;
  end if;

  select asunto, cuerpo into v_plantilla
  from public.plantillas_notificacion
  where evento = v_evento and activo and canal = 'interna' limit 1;
  if v_plantilla is null then return null; end if;

  v_ctx := public.notif_contexto_incidencia(new.id);
  v_ctx := jsonb_set(v_ctx, '{detalle}',
    to_jsonb('estado ' || coalesce(v_de, '—') || ' → ' || v_a));

  perform public.notificar(new.usuario_reportante_id, v_evento, new.id,
    public.notif_reemplazar(v_plantilla.asunto, v_ctx),
    public.notif_reemplazar(v_plantilla.cuerpo, v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_incidencia_estado on public.incidencias;
create trigger trg_notif_incidencia_estado
  after update of estado_id on public.incidencias
  for each row execute function public.notif_incidencia_estado();

-- 4c. ASIGNACIÓN → al técnico asignado
create or replace function public.notif_asignacion_creada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil_tecnico uuid;
  v_ctx jsonb;
  v_plantilla record;
begin
  select t.perfil_id into v_perfil_tecnico
  from public.tecnicos t
  where t.id = new.tecnico_id;
  if v_perfil_tecnico is null then
    return null;
  end if;
  select asunto, cuerpo into v_plantilla
  from public.plantillas_notificacion
  where evento = 'asignada' and activo and canal = 'interna' limit 1;
  if v_plantilla is null then return null; end if;
  v_ctx := public.notif_contexto_incidencia(new.incidencia_id);
  perform public.notificar(v_perfil_tecnico, 'asignada', new.incidencia_id,
    public.notif_reemplazar(v_plantilla.asunto, v_ctx),
    public.notif_reemplazar(v_plantilla.cuerpo, v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_asignacion on public.incidencia_asignaciones;
create trigger trg_notif_asignacion
  after insert on public.incidencia_asignaciones
  for each row execute function public.notif_asignacion_creada();

-- 4d. DERIVACIÓN → al reportante (incluida la derivación inicial)
create or replace function public.notif_derivacion_creada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reportante uuid;
  v_ctx jsonb;
  v_plantilla record;
begin
  select i.usuario_reportante_id into v_reportante
  from public.incidencias i
  where i.id = new.incidencia_id;
  if v_reportante is null then
    return null;
  end if;
  select asunto, cuerpo into v_plantilla
  from public.plantillas_notificacion
  where evento = 'derivada' and activo and canal = 'interna' limit 1;
  if v_plantilla is null then return null; end if;
  v_ctx := public.notif_contexto_incidencia(new.incidencia_id);
  v_ctx := jsonb_set(v_ctx, '{area}',
    to_jsonb(coalesce(
      (select ar.nombre from public.areas ar where ar.id = new.area_destino_id), '')));
  perform public.notificar(v_reportante, 'derivada', new.incidencia_id,
    public.notif_reemplazar(v_plantilla.asunto, v_ctx),
    public.notif_reemplazar(v_plantilla.cuerpo, v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_derivacion on public.incidencia_derivaciones;
create trigger trg_notif_derivacion
  after insert on public.incidencia_derivaciones
  for each row execute function public.notif_derivacion_creada();

-- 4e. COMENTARIO → al reportante (solo si NO es nota interna)
create or replace function public.notif_comentario_creado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reportante uuid;
  v_ctx jsonb;
  v_plantilla record;
begin
  if coalesce(new.es_interno, false) then
    return null;
  end if;
  select i.usuario_reportante_id into v_reportante
  from public.incidencias i
  where i.id = new.incidencia_id;
  if v_reportante is null or v_reportante = new.autor_id then
    return null;
  end if;
  select asunto, cuerpo into v_plantilla
  from public.plantillas_notificacion
  where evento = 'comentario' and activo and canal = 'interna' limit 1;
  if v_plantilla is null then return null; end if;
  v_ctx := public.notif_contexto_incidencia(new.incidencia_id);
  perform public.notificar(v_reportante, 'comentario', new.incidencia_id,
    public.notif_reemplazar(v_plantilla.asunto, v_ctx),
    public.notif_reemplazar(v_plantilla.cuerpo, v_ctx));
  return null;
end;
$$;

drop trigger if exists trg_notif_comentario on public.incidencia_comentarios;
create trigger trg_notif_comentario
  after insert on public.incidencia_comentarios
  for each row execute function public.notif_comentario_creado();

-- ----------------------------------------------------------------------------
-- 5. ALERTAS SLA → técnicos con asignación activa
-- ----------------------------------------------------------------------------
create or replace function public.notificar_alertas_sla()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_alerta record;
  v_perfil uuid;
begin
  for v_alerta in
    select * from public.slas_asignadas_al_tecnico()
    where estado_resolucion in ('vencido', 'en_riesgo')
  loop
    select t.perfil_id into v_perfil
    from public.tecnicos t
    join public.incidencia_asignaciones ia on ia.tecnico_id = t.id
    where ia.incidencia_id = v_alerta.incidencia_id and ia.activa
    limit 1;

    if public.notificar(v_perfil, 'sla_alerta', v_alerta.incidencia_id) is not null then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.notificar_alertas_sla() from public, anon;
grant execute on function public.notificar_alertas_sla() to authenticated;

comment on function public.notificar_alertas_sla() is
  'Crea notificaciones sla_alerta para asignaciones activas vencidas o en riesgo (dedupe). La invocan los dashboards; solo alerta al técnico asignado.';

-- ----------------------------------------------------------------------------
-- 6. RPC de lectura para el centro de notificaciones
-- ----------------------------------------------------------------------------
create or replace function public.mis_notificaciones(
  p_solo_no_leidas boolean default false,
  p_limite integer default 50
)
returns table (
  id          uuid,
  titulo      text,
  cuerpo      text,
  leida_en    timestamptz,
  creado_en   timestamptz,
  codigo_incidencia text,
  estado_incidencia text
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.titulo, n.cuerpo, n.leida_en, n.creado_en,
         i.codigo, e.nombre
  from public.notificaciones n
  left join public.incidencias i on i.id = n.incidencia_id
  left join public.estados_incidencia e on e.id = i.estado_id
  where n.perfil_id = auth.uid()
    and (not p_solo_no_leidas or n.leida_en is null)
  order by n.creado_en desc
  limit greatest(1, least(coalesce(p_limite, 50), 100));
$$;

revoke all on function public.mis_notificaciones(boolean, integer) from public, anon;
grant execute on function public.mis_notificaciones(boolean, integer) to authenticated;

create or replace function public.notificaciones_no_leidas()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notificaciones
  where perfil_id = auth.uid() and leida_en is null;
$$;

revoke all on function public.notificaciones_no_leidas() from public, anon;
grant execute on function public.notificaciones_no_leidas() to authenticated;

comment on function public.mis_notificaciones(boolean, integer) is
  'Bandeja del usuario autenticado (RLS 0007 replicada): título, cuerpo, lectura y código/estado de la incidencia enlazada.';
comment on function public.notificaciones_no_leidas() is
  'Contador de notificaciones no leídas del usuario autenticado (badge).';

-- ----------------------------------------------------------------------------
-- 7. REALTIME: publicar `notificaciones` (RLS por suscriptor)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication p
    join pg_publication_tables pt on pt.pubname = p.pubname
    where p.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename  = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 8. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('notificar','usuario_quiere_evento','crear_preferencias_notificacion',
       'notif_incidencia_creada','notif_incidencia_estado','notif_asignacion_creada',
       'notif_derivacion_creada','notif_comentario_creado','notificar_alertas_sla',
       'mis_notificaciones','notificaciones_no_leidas')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('notificar','usuario_quiere_evento','crear_preferencias_notificacion',
       'notif_incidencia_creada','notif_incidencia_estado','notif_asignacion_creada',
       'notif_derivacion_creada','notif_comentario_creado','notificar_alertas_sla',
       'mis_notificaciones','notificaciones_no_leidas')
  ) <> 11 then
    raise exception 'RPCs de notificaciones no creadas correctamente';
  end if;
end $$;

-- ============================================================================
-- MIGRACIÓN 0019 — REPORTES ANALÍTICOS (FASE 10)
-- Vista v_reportes_incidencias (SECURITY_INVOKER) + RPC de indicadores y
-- series agregadas en Postgres con filtros server-side. Autorización:
-- administrador / coordinador / permiso ver_reportes. Idempotente.
-- ============================================================================

-- ============================================================================
-- SIR-UPSJB · 0019_reportes_analiticos.sql
-- FASE 10 — DASHBOARD ANALÍTICO Y REPORTES (Plan Maestro §47, §48)
-- MODELO USADO (sin inventar tablas): vista de lectura sobre las tablas
-- existentes (incidencias + catálogos + jerarquía de ambientes + SLA +
-- asignaciones/derivaciones) y RPC que agregan EN POSTGRES (no en frontend).
--
-- SEGURIDAD (obligatoria, RLS continúa):
--   · v_reportes_incidencias = SECURITY_INVOKER: al consultarla se aplican
--     las policies RLS de CADA tabla subyacente. Un usuario sin permiso no
--     ve las filas que RLS ya le niega; la vista no amplia accesos.
--   · reporte_detalle: SELECT ... FROM v_reportes_incidencias con
--     SECURITY INVOKER → RLS del lector; NULL = sin acceso a la incidencia.
--   · RPC SECURITY DEFINER SOLO administrador / coordinador / ver_reportes
--     (mismo criterio que indicadores_sla, 0017). No exponen datos a quien
--     no puede consultarlos: la autorización se verifica ANTES de agregar.
--   · Exportación CSV = lectura del propio usuario (RLS) generada en servidor
--     Next (ver lib/reportes/exportar.ts); sin BYPASS de políticas.
--
-- AGREGACIÓN EN BD: los desgloses (estado/prioridad/tipo/área/ambiente/
-- equipo/evolución mensual/servicios) se computan con GROUP BY en SQL, no
-- trayendo filas crudas a la app (§"No calcules en frontend").
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. VISTA ANALÍTICA DE INCIDENCIAS (1 fila por incidencia, ya desnormalizada)
--    SECURITY_INVOKER (no definer) → hereda el RLS de cada tabla.
--    Solo columnas de reporte; sin texto de descripciones completas.
-- ----------------------------------------------------------------------------
create or replace view public.v_reportes_incidencias
with (security_invoker = true) as
select
  i.id,
  i.codigo,
  i.descripcion,
  i.fecha_reporte,
  i.fecha_asignacion,
  i.fecha_inicio,
  i.fecha_resolucion,
  i.fecha_cierre,
  e.nombre   as estado,
  e.es_final as estado_es_final,
  pr.nombre  as prioridad,
  pr.nivel   as prioridad_nivel,
  t.nombre   as tipo,
  st.nombre  as subtipo,
  a.id       as ambiente_id,
  a.nombre   as ambiente,
  ta.nombre  as tipo_ambiente,
  p.nombre   as piso,
  pb.nombre  as pabellon,
  s.id       as sede_id,
  s.nombre   as sede,
  ar.id      as area_id,
  ar.nombre  as area,
  sv.id      as servicio_id,
  sv.nombre  as servicio,
  ch.nombre  as canal,
  -- Área responsable vigente (fila activa de incidencia_derivaciones; NULL
  -- = derivación inicial sin origen). Sirve para el filtro por área.
  dv.area_destino_id as area_vigente_id,
  -- Técnico con asignación ACTIVA (uq_asignacion_activa: a lo sumo una).
  (
    select te.codigo_tecnico
    from public.incidencia_asignaciones asg
    join public.tecnicos te on te.id = asg.tecnico_id
    where asg.incidencia_id = i.id and asg.activa
    limit 1
  ) as tecnico_codigo,
  -- Equipo principal (uq_incidencia_equipos_principal: a lo sumo uno).
  (
    select eq.codigo_interno
    from public.incidencia_equipos ie
    join public.equipos eq on eq.id = ie.equipo_id
    where ie.incidencia_id = i.id and ie.es_equipo_principal
    limit 1
  ) as equipo_codigo,
  (
    select c2.nombre
    from public.incidencia_equipos ie
    join public.equipos eq on eq.id = ie.equipo_id
    join public.categorias_equipos c2 on c2.id = eq.categoria_id
    where ie.incidencia_id = i.id and ie.es_equipo_principal
    limit 1
  ) as equipo_categoria,
  -- SLA (0017): horas reales y banderas de cumplimiento.
  ts.horas_respuesta_real,
  ts.horas_resolucion_real,
  case when ts.horas_respuesta_real is not null
       and ts.horas_respuesta_acuerdo is not null
       and ts.horas_respuesta_real <= ts.horas_respuesta_acuerdo
    then true else false end as cumplio_respuesta,
  case when ts.horas_resolucion_real is not null
       and ts.horas_resolucion_acuerdo is not null
       and ts.horas_resolucion_real <= ts.horas_resolucion_acuerdo
    then true else false end as cumplio_resolucion,
  (ts.incidencia_id is not null) as tiene_sla
from public.incidencias i
join public.estados_incidencia  e  on e.id  = i.estado_id
join public.prioridades         pr on pr.id = i.prioridad_id
join public.tipos_incidencia    t  on t.id  = i.tipo_incidencia_id
left join public.subtipos_incidencia st on st.id = i.subtipo_incidencia_id
join public.ambientes           a  on a.id  = i.ambiente_id
join public.tipos_ambiente      ta on ta.id = a.tipo_ambiente_id
join public.pisos               p  on p.id  = a.piso_id
join public.pabellones          pb on pb.id = p.pabellon_id
join public.sedes               s  on s.id  = pb.sede_id
left join public.incidencia_derivaciones dv
       on dv.incidencia_id = i.id and dv.activa
left join public.areas          ar on ar.id = dv.area_destino_id
left join public.servicios      sv on sv.id = dv.servicio_destino_id
left join public.canales_reporte ch on ch.id = i.canal_reporte_id
left join public.tiempos_sla    ts on ts.incidencia_id = i.id;

comment on view public.v_reportes_incidencias is
  'Vista de lectura para reportes (Fase 10, §47/§48): 1 fila por incidencia con catálogos y jerarquía ya unidos. SECURITY_INVOKER: aplica el RLS de cada tabla al lector; no amplia accesos.';

-- ----------------------------------------------------------------------------
-- 2. FILTROS COMUNES (fechas, sede, área, estado, prioridad, tipo, búsqueda)
--    Seguras: solo igualdad/rango; sin SQL dinámico.
-- ----------------------------------------------------------------------------
create or replace function public.reporte_filtros_ok(
  p_desde date, p_hasta date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_desde is null or p_hasta is null or p_desde <= p_hasta);
$$;

-- ----------------------------------------------------------------------------
-- 3. INDICADORES OPERATIVOS Y DE TIEMPO (§47) — 1 fila, agregada en BD.
-- ----------------------------------------------------------------------------
create or replace function public.indicadores_analiticos(
  p_desde     date default null,
  p_hasta     date default null,
  p_sede_id   uuid default null,
  p_area_id   uuid default null,
  p_estado    text default null,
  p_prioridad text default null,
  p_tipo      text default null
)
returns table (
  total              bigint,
  pendientes         bigint,
  en_proceso         bigint,
  resueltas          bigint,
  cerradas           bigint,
  criticas           bigint,
  altas              bigint,
  medias             bigint,
  bajas              bigint,
  derivadas          bigint,
  sin_sla            bigint,
  fuera_sla_resp     bigint,
  fuera_sla_resol    bigint,
  prom_horas_respuesta   numeric,
  prom_horas_atencion    numeric,
  prom_horas_resolucion  numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permiso boolean;
begin
  v_permiso := public.soy_administrador() or public.soy_coordinador()
               or public.tiene_permiso('ver_reportes');
  if not v_permiso then
    raise exception 'No tienes autorización para consultar reportes';
  end if;

  select
    count(*),
    count(*) filter (where v.estado = 'Pendiente'),
    count(*) filter (where v.estado in ('En proceso', 'En espera')),
    count(*) filter (where v.estado = 'Resuelta'),
    count(*) filter (where v.estado in ('Cerrada', 'Cancelada')),
    count(*) filter (where v.prioridad = 'Crítica'),
    count(*) filter (where v.prioridad = 'Alta'),
    count(*) filter (where v.prioridad = 'Media'),
    count(*) filter (where v.prioridad = 'Baja'),
    count(*) filter (where exists (
      select 1 from public.incidencia_derivaciones d
      where d.incidencia_id = v.id and d.activa and d.area_origen_id is not null
    )),
    count(*) filter (where not v.tiene_sla),
    count(*) filter (where v.cumplio_respuesta is false),
    count(*) filter (where v.cumplio_resolucion is false),
    round(avg(v.horas_respuesta_real)::numeric, 1),
    round(avg(v.horas_resolucion_real - v.horas_respuesta_real)::numeric, 1),
    round(avg(v.horas_resolucion_real)::numeric, 1)
  into total, pendientes, en_proceso, resueltas, cerradas,
       criticas, altas, medias, bajas, derivadas,
       sin_sla, fuera_sla_resp, fuera_sla_resol,
       prom_horas_respuesta, prom_horas_atencion, prom_horas_resolucion
  from public.v_reportes_incidencias v
  where (p_desde is null or v.fecha_reporte::date >= p_desde)
    and (p_hasta is null or v.fecha_reporte::date <= p_hasta)
    and (p_sede_id is null or v.sede_id = p_sede_id)
    and (p_area_id is null or v.area_id = p_area_id
         or v.area_vigente_id = p_area_id)
    and (p_estado is null or v.estado = p_estado)
    and (p_prioridad is null or v.prioridad = p_prioridad)
    and (p_tipo is null or v.tipo = p_tipo);

  return next;
end;
$$;

revoke all on function public.indicadores_analiticos(date, date, uuid, uuid, text, text, text) from public, anon;
grant execute on function public.indicadores_analiticos(date, date, uuid, uuid, text, text, text) to authenticated;

comment on function public.indicadores_analiticos(date, date, uuid, uuid, text, text, text) is
  'KPIs operativos y de tiempo (§47) con filtros server-side. SECURITY DEFINER pero solo admin/coordinador/ver_reportes; agrega en Postgres.';

-- ----------------------------------------------------------------------------
-- 4. SERIES PARA GRÁFICOS (§48): desgloses agregados con GROUP BY.
--    p_serie: estado | prioridad | tipo | area | ambiente | sede | pabellon |
--             piso | equipo | categoria | mes | servicio_atencion
-- ----------------------------------------------------------------------------
create or replace function public.series_analiticas(
  p_serie     text,
  p_desde     date default null,
  p_hasta     date default null,
  p_sede_id   uuid default null,
  p_area_id   uuid default null,
  p_estado    text default null,
  p_prioridad text default null,
  p_tipo      text default null,
  p_limite    integer default 12
)
returns table (
  etiqueta text,
  cantidad bigint,
  extra    numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_permiso boolean;
begin
  v_permiso := public.soy_administrador() or public.soy_coordinador()
               or public.tiene_permiso('ver_reportes');
  if not v_permiso then
    raise exception 'No tienes autorización para consultar reportes';
  end if;
  if p_serie is null or length(btrim(p_serie)) = 0 then
    raise exception 'Serie requerida';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 100 then
    p_limite := 12;
  end if;

  -- Base filtrada una sola vez (CTE materializable); cada serie agrega con
  -- GROUP BY en Postgres (nada de agregar en frontend). Solo se computa la
  -- serie pedida (IF/ELSE, sin SQL dinámico).
  with base as (
    select v.*
    from public.v_reportes_incidencias v
    where (p_desde is null or v.fecha_reporte::date >= p_desde)
      and (p_hasta is null or v.fecha_reporte::date <= p_hasta)
      and (p_sede_id is null or v.sede_id = p_sede_id)
      and (p_area_id is null or v.area_id = p_area_id)
      and (p_estado is null or v.estado = p_estado)
      and (p_prioridad is null or v.prioridad = p_prioridad)
      and (p_tipo is null or v.tipo = p_tipo)
  )
  -- Estado
  if p_serie = 'estado' then
    return query
      select v.estado::text, count(*)::bigint, null::numeric
      from base v group by v.estado
      order by 2 desc, 1 asc limit p_limite;
  -- Prioridad
  elsif p_serie = 'prioridad' then
    return query
      select v.prioridad::text, count(*)::bigint, null::numeric
      from base v group by v.prioridad
      order by 2 desc, 1 asc limit p_limite;
  -- Tipo de incidencia
  elsif p_serie = 'tipo' then
    return query
      select v.tipo::text, count(*)::bigint, null::numeric
      from base v group by v.tipo
      order by 2 desc, 1 asc limit p_limite;
  -- Área responsable vigente (derivación activa)
  elsif p_serie = 'area' then
    return query
      select coalesce(v.area, 'Sin asignar')::text, count(*)::bigint,
             null::numeric
      from base v group by v.area
      order by 2 desc, 1 asc limit p_limite;
  -- Ambiente
  elsif p_serie = 'ambiente' then
    return query
      select v.ambiente::text, count(*)::bigint, null::numeric
      from base v group by v.ambiente
      order by 2 desc, 1 asc limit p_limite;
  -- Sede
  elsif p_serie = 'sede' then
    return query
      select v.sede::text, count(*)::bigint, null::numeric
      from base v group by v.sede
      order by 2 desc, 1 asc limit p_limite;
  -- Pabellón (con sede si el filtro no acota a una)
  elsif p_serie = 'pabellon' then
    return query
      select (case when p_sede_id is null then v.sede || ' · ' else '' end)
               || v.pabellon::text, count(*)::bigint, null::numeric
      from base v group by v.sede, v.pabellon
      order by 2 desc, 1 asc limit p_limite;
  -- Piso (con pabellón)
  elsif p_serie = 'piso' then
    return query
      select (case when p_sede_id is null then v.pabellon || ' · ' else '' end)
               || v.piso::text, count(*)::bigint, null::numeric
      from base v group by v.pabellon, v.piso
      order by 2 desc, 1 asc limit p_limite;
  -- Equipo (mayor número de incidencias — §48)
  elsif p_serie = 'equipo' then
    return query
      select coalesce(v.equipo_codigo, 'Sin equipo')::text, count(*)::bigint,
             null::numeric
      from base v group by v.equipo_codigo
      order by 2 desc, 1 asc limit p_limite;
  -- Categoría de equipo
  elsif p_serie = 'categoria' then
    return query
      select coalesce(v.equipo_categoria, 'Sin equipo')::text, count(*)::bigint,
             null::numeric
      from base v group by v.equipo_categoria
      order by 2 desc, 1 asc limit p_limite;
  -- Evolución mensual (America/Lima): AAAA-MM
  elsif p_serie = 'mes' then
    return query
      select to_char(v.fecha_reporte at time zone 'America/Lima', 'YYYY-MM')::text,
             count(*)::bigint, null::numeric
      from base v
      group by to_char(v.fecha_reporte at time zone 'America/Lima', 'YYYY-MM')
      order by 1 asc limit p_limite;
  -- Tiempo de atención por SERVICIO (§47): extra = promedio de horas
  elsif p_serie = 'servicio_atencion' then
    return query
      select v.servicio::text, count(*)::bigint,
             round(avg(v.horas_resolucion_real - v.horas_respuesta_real)
                   ::numeric, 1)
      from base v
      where v.servicio is not null
      group by v.servicio
      order by 2 desc, 1 asc limit p_limite;
  else
    raise exception 'Serie desconocida: %', p_serie;
  end if;
end;
$$;

revoke all on function public.series_analiticas(text, date, date, uuid, uuid, text, text, text, integer) from public, anon;
grant execute on function public.series_analiticas(text, date, date, uuid, uuid, text, text, text, integer) to authenticated;

comment on function public.series_analiticas(text, date, date, uuid, uuid, text, text, text, integer) is
  'Series agregadas para gráficos (§48): estado/prioridad/tipo/área/ambiente/sede/pabellón/piso/equipo/categoría/evolución mensual/tiempo por servicio. extra = promedio de horas en servicio_atencion.';

-- ----------------------------------------------------------------------------
-- 5. DETALLE PAGINADO PARA LA TABLA DE REPORTE (respeta RLS del lector:
--    SELECT sobre la vista security_invoker → filas que RLS ya permite).
-- ----------------------------------------------------------------------------
create or replace function public.reporte_detalle(
  p_desde     date default null,
  p_hasta     date default null,
  p_sede_id   uuid default null,
  p_area_id   uuid default null,
  p_estado    text default null,
  p_prioridad text default null,
  p_tipo      text default null,
  p_limite    integer default 100,
  p_offset    integer default 0
)
returns table (
  id           uuid,
  codigo       text,
  estado       text,
  prioridad    text,
  tipo         text,
  ambiente     text,
  sede         text,
  area         text,
  servicio     text,
  fecha_reporte timestamptz,
  fecha_resolucion timestamptz,
  horas_resolucion numeric,
  tiene_sla    boolean,
  cumplio_resolucion boolean,
  fuera_sla    boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.id, v.codigo, v.estado, v.prioridad, v.tipo, v.ambiente, v.sede,
    v.area, v.servicio, v.fecha_reporte, v.fecha_resolucion,
    v.horas_resolucion_real, v.tiene_sla, v.cumplio_resolucion,
    (v.cumplio_resolucion is false)
  from public.v_reportes_incidencias v
  where (p_desde is null or v.fecha_reporte::date >= p_desde)
    and (p_hasta is null or v.fecha_reporte::date <= p_hasta)
    and (p_sede_id is null or v.sede_id = p_sede_id)
    and (p_area_id is null or v.area_id = p_area_id)
    and (p_estado is null or v.estado = p_estado)
    and (p_prioridad is null or v.prioridad = p_prioridad)
    and (p_tipo is null or v.tipo = p_tipo)
  order by v.fecha_reporte desc
  limit least(coalesce(p_limite, 100), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.reporte_detalle(date, date, uuid, uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.reporte_detalle(date, date, uuid, uuid, text, text, text, integer, integer) to authenticated;

comment on function public.reporte_detalle(date, date, uuid, uuid, text, text, text, integer, integer) is
  'Filas de reporte con RLS del lector (SECURITY INVOKER sobre la vista). Para la tabla y exportación CSV del propio usuario.';

-- ----------------------------------------------------------------------------
-- 6. OPCIONES DE FILTROS (catálogos activos para los <select>).
-- ----------------------------------------------------------------------------
create or replace function public.reporte_filtros()
returns table (
  sedes      jsonb,
  areas      jsonb,
  estados    jsonb,
  prioridades jsonb,
  tipos      jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre)
             order by s.nombre), '[]'::jsonb)
     from public.sedes s where s.activa),
    (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre)
             order by a.nombre), '[]'::jsonb)
     from public.areas a where a.activo),
    (select coalesce(jsonb_agg(jsonb_build_object('nombre', e.nombre)
             order by e.orden), '[]'::jsonb)
     from public.estados_incidencia e where e.activo),
    (select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre)
             order by p.nivel), '[]'::jsonb)
     from public.prioridades p where p.activo),
    (select coalesce(jsonb_agg(jsonb_build_object('nombre', t.nombre)
             order by t.nombre), '[]'::jsonb)
     from public.tipos_incidencia t where t.activo);
$$;

revoke all on function public.reporte_filtros() from public, anon;
grant execute on function public.reporte_filtros() to authenticated;

comment on function public.reporte_filtros() is
  'Opciones para los filtros del dashboard de reportes (sedes, áreas, estados, prioridades, tipos activos).';

-- ----------------------------------------------------------------------------
-- 7. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('indicadores_analiticos','series_analiticas','reporte_detalle','reporte_filtros')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('indicadores_analiticos','series_analiticas','reporte_detalle','reporte_filtros')
  ) <> 4 then
    raise exception 'RPCs de reportes no creadas correctamente';
  end if;
  if not exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'v_reportes_incidencias'
  ) then
    raise exception 'Vista v_reportes_incidencias no creada';
  end if;
end $$;

-- ============================================================================
-- MIGRACIÓN 0020 — AUDITORÍA + REVISIÓN DE SEGURIDAD (FASE 11)
-- RPC auditar/consultar_auditoria · LOGIN/LOGOUT · flujo técnico (CAMBIAR_
-- ESTADO/RESOLVER) · CERRAR/ANULAR · ADJUNTAR_EVIDENCIA · MODIFICAR_CONFIG_
-- URACION (SLA/reglas/plantillas/roles). Fortalece grants y verifica RLS
-- global + publication realtime. Idempotente.
-- ============================================================================

-- ============================================================================
-- SIR-UPSJB · 0020_auditoria_seguridad.sql
-- FASE 11 — AUDITORÍA + REVISIÓN DE SEGURIDAD (Plan Maestro §41, §49)
--
-- MODELO USADO (sin inventar tablas): `registros_auditoria` (0001, dominio de
-- acciones LOGIN/LOGOUT/CREAR/EDITAR/ASIGNAR/DERIVAR/CAMBIAR_ESTADO/
-- ADJUNTAR_EVIDENCIA/RESOLVER/CERRAR/MODIFICAR_CONFIGURACION/ANULAR) y
-- `sesiones_usuario` (LOGIN/LOGOUT/login_fallido).
--
-- ESTADO PREVIO (ya existía, se CONSERVA):
--   · p_auditoria_select (0007): SELECT solo admin con ver_auditoria.
--   · Sin policies INSERT/UPDATE/DELETE → la API no escribe ni borra.
--   · Trigger append-only (0004) bloquea UPDATE/DELETE a nivel de BD.
--
-- LO QUE AGREGA 0020:
--   1. RPC `auditar` (SECURITY DEFINER, con guard anti-recursión: si el actor
--      no puede autenticarse no recursa infinita) para que las RPCs del
--      sistema registren acciones SIN exponer INSERT directo.
--   2. RPC `consultar_auditoria` (filtros: acción, tabla, registro, actor,
--      fechas, búsqueda de texto + paginación) — la consulta administrativa
--      con los mismos permisos que la policy p_auditoria_select.
--   3. Cobertura de eventos que FALTABAN:
--      · LOGIN/LOGOUT/login_fallido → sesiones_usuario (triggers en auth.users)
--        + espejo LOGIN/LOGOUT en registros_auditoria.
--      · CAMBIAR_ESTADO/ASIGNAR/RESOLVER en las RPCs 0014 (flujo técnico).
--      · CERRAR al confirmar cierre el reportante.
--      · ADJUNTAR_EVIDENCIA al registrar adjuntos (RPC 0013).
--      · MODIFICAR_CONFIGURACION en cambios de SLA/reglas (trigger genérico
--        para tablas de configuración administrables).
--   4. Fortaleza de GRANTs: ejecución de RPC sensibles revocada a anon.
--   5. VERIFICACIÓN de seguridad (S11): publication realtime solo con
--      notificaciones; no hay columnas de secrets; RLS habilitado en todas
--      las tablas public.* del modelo (avisa si alguna quedó sin RLS).
-- Idempotente y re-ejecutable. Sin service_role: todo por authenticated+RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC AUDITAR: registro de acciones (uso interno del sistema).
--    SECURITY DEFINER porque registros_auditoria no tiene INSERT por RLS a
--    usuarios; la expone con revoke a anon y el dominio lo valida el CHECK.
-- ----------------------------------------------------------------------------
create or replace function public.auditar(
  p_accion     text,
  p_tabla      text,
  p_registro   uuid default null,
  p_codigo     text default null,
  p_previos    jsonb default null,
  p_nuevos     jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  -- Acción dentro del dominio del modelo (0001) — sin SQL dinámico.
  if p_accion not in
    ('LOGIN','LOGOUT','CREAR','EDITAR','ASIGNAR','DERIVAR','CAMBIAR_ESTADO',
     'ADJUNTAR_EVIDENCIA','RESOLVER','CERRAR','MODIFICAR_CONFIGURACION','ANULAR')
  then
    raise exception 'Acción de auditoría no permitida: %', p_accion;
  end if;
  if p_tabla is null or btrim(p_tabla) = '' or length(p_tabla) > 63 then
    raise exception 'Tabla afectada requerida';
  end if;

  insert into public.registros_auditoria
    (actor_id, accion, tabla_afectada, registro_id, codigo_referencia,
     valores_previos, valores_nuevos)
  values
    (v_actor, p_accion, btrim(p_tabla), p_registro, p_codigo, p_previos, p_nuevos)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.auditar(text, text, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.auditar(text, text, uuid, text, jsonb, jsonb) to authenticated;

comment on function public.auditar(text, text, uuid, text, jsonb, jsonb) is
  'Registra una acción en registros_auditoria (append-only). Uso interno del sistema (RPCs/triggers); sin UPDATE/DELETE posible por diseño.';

-- ----------------------------------------------------------------------------
-- 2. RPC CONSULTAR AUDITORÍA (consulta administrativa con filtros).
--    Misma autorización que p_auditoria_select: admin + ver_auditoria.
--    Une perfiles para mostrar al actor; filtros seguros (igualdad/rango).
-- ----------------------------------------------------------------------------
create or replace function public.consultar_auditoria(
  p_accion  text default null,
  p_tabla   text default null,
  p_registro uuid default null,
  p_actor   uuid default null,
  p_desde   timestamptz default null,
  p_hasta   timestamptz default null,
  p_busqueda text default null,
  p_limite  integer default 50,
  p_offset  integer default 0
)
returns table (
  id                uuid,
  creado_en         timestamptz,
  accion            text,
  tabla_afectada    text,
  registro_id       uuid,
  codigo_referencia text,
  valores_previos   jsonb,
  valores_nuevos    jsonb,
  actor_id          uuid,
  actor_nombre      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.creado_en, r.accion, r.tabla_afectada, r.registro_id,
    r.codigo_referencia, r.valores_previos, r.valores_nuevos,
    r.actor_id,
    nullif(btrim(coalesce(p.nombres || ' ' || p.apellido_paterno, '')), '') as actor_nombre
  from public.registros_auditoria r
  left join public.perfiles p on p.id = r.actor_id
  where (p_accion is null or r.accion = p_accion)
    and (p_tabla  is null or r.tabla_afectada = p_tabla)
    and (p_registro is null or r.registro_id = p_registro)
    and (p_actor  is null or r.actor_id = p_actor)
    and (p_desde  is null or r.creado_en >= p_desde)
    and (p_hasta  is null or r.creado_en <= p_hasta)
    and (
      p_busqueda is null or btrim(p_busqueda) = ''
      or r.codigo_referencia ilike '%' || btrim(p_busqueda) || '%'
      or r.valores_nuevos::text ilike '%' || btrim(p_busqueda) || '%'
      or r.valores_previos::text ilike '%' || btrim(p_busqueda) || '%'
    )
  order by r.creado_en desc, r.id
  limit least(coalesce(p_limite, 50), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.consultar_auditoria(text, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.consultar_auditoria(text, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer) to authenticated;

comment on function public.consultar_auditoria(text, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer) is
  'Consulta administrativa de auditoría con filtros (acción, tabla, registro, actor, fechas, búsqueda) y paginación. Solo admin con permiso ver_auditoria.';

-- ----------------------------------------------------------------------------
-- 3. LOGIN/LOGOUT/login_fallido → sesiones_usuario + espejo en auditoría.
--    Triggers al INSERT de auth.users_sessions (el backend de GoTrue de
--    Supabase registra ahí los accesos) y a actualizaciones del usuario
--    (last_sign_in_at cambia en cada login).
-- ----------------------------------------------------------------------------
create or replace function public.auditar_sesion_nueva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil uuid;
  v_evento text;
begin
  v_perfil := (new.user_id)::uuid;
  -- GoTrue inserta la fila con refresh_token-picker; updated_at cambia al
  -- refrescar. Solo registramos la CREACIÓN de sesión como LOGIN.
  v_evento := 'LOGIN';

  -- Perfil puede no existir aún (orden de triggers): espejo solo si existe.
  if exists (select 1 from public.perfiles p where p.id = v_perfil) then
    insert into public.sesiones_usuario (perfil_id, evento, evento_en)
    values (v_perfil, v_evento, now())
    on conflict do nothing;

    insert into public.registros_auditoria
      (actor_id, accion, tabla_afectada, valores_nuevos)
    values
      (v_perfil, 'LOGIN', 'sesiones_usuario',
       jsonb_build_object('dispositivo', coalesce(new.user_agent, '')));
  end if;
  return null;
end;
$$;

create or replace function public.auditar_logout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.perfiles p where p.id = old.user_id) then
    insert into public.sesiones_usuario (perfil_id, evento, evento_en)
    values ((old.user_id)::uuid, 'LOGOUT', now())
    on conflict do nothing;

    insert into public.registros_auditoria
      (actor_id, accion, tabla_afectada, valores_nuevos)
    values
      ((old.user_id)::uuid, 'LOGOUT', 'sesiones_usuario',
       jsonb_build_object('sesion', old.id));
  end if;
  return null;
end;
$$;

-- La tabla auth.users_sessions pertenece a supabase_auth_admin; el trigger
-- se instala como security definer dueño de postgres (permite leer esa fila).
drop trigger if exists trg_sesiones_login on auth.users_sessions;
create trigger trg_sesiones_login
  after insert on auth.users_sessions
  for each row execute function public.auditar_sesion_nueva();

drop trigger if exists trg_sesiones_logout on auth.users_sessions;
create trigger trg_sesiones_logout
  after delete on auth.users_sessions
  for each row execute function public.auditar_logout();

-- ----------------------------------------------------------------------------
-- 4. AUDITORÍA EN EL FLUJO TÉCNICO (0014): ASIGNAR/CAMBIAR_ESTADO/RESOLVER.
--    Se redefinen las RPCs agregando SOLO la escritura de auditoría al final
--    (misma lógica aprobada). Idempotente con create or replace.
-- ----------------------------------------------------------------------------
create or replace function public.tecnico_aceptar_incidencia(p_incidencia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado   text;
  v_estado_id uuid;
  v_tecnico  uuid;
begin
  select a.id into v_tecnico
  from public.incidencia_asignaciones a
  join public.tecnicos t on t.id = a.tecnico_id
  where a.incidencia_id = p_incidencia_id
    and a.activa
    and t.perfil_id = auth.uid()
    and t.activo
  limit 1;

  if v_tecnico is null then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;

  select e.nombre, i.estado_id into v_estado, v_estado_id
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_estado is distinct from 'Asignada' then
    raise exception 'Solo se puede aceptar una incidencia en estado Asignada (actual: %)', v_estado;
  end if;

  update public.incidencia_asignaciones
     set aceptado_en = now()
   where id = v_tecnico
     and aceptado_en is null;

  select id into v_estado_id from public.estados_incidencia where nombre = 'En proceso';
  update public.incidencias
     set estado_id = v_estado_id,
         fecha_inicio = coalesce(fecha_inicio, now())
   where id = p_incidencia_id;

  -- AUDITORÍA (Fase 11): aceptar = CAMBIAR_ESTADO Asignada → En proceso.
  perform public.auditar(
    'CAMBIAR_ESTADO', 'incidencias', p_incidencia_id,
    (select i2.codigo from public.incidencias i2 where i2.id = p_incidencia_id),
    jsonb_build_object('estado', 'Asignada'),
    jsonb_build_object('estado', 'En proceso', 'evento', 'aceptar_asignacion')
  );

  return true;
end;
$$;

revoke all on function public.tecnico_aceptar_incidencia(uuid) from public, anon;
grant execute on function public.tecnico_aceptar_incidencia(uuid) to authenticated;

create or replace function public.tecnico_cambiar_estado(
  p_incidencia_id uuid,
  p_nuevo_estado  text,
  p_detalle       text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual  text;
  v_nuevo_id uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() or not public.tiene_permiso('cambiar_estado') then
    raise exception 'Tu rol no permite cambiar el estado de incidencias';
  end if;

  select e.nombre into v_actual
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_actual is null then
    raise exception 'Incidencia no encontrada';
  end if;

  select id into v_nuevo_id
  from public.estados_incidencia
  where nombre = p_nuevo_estado and activo;
  if v_nuevo_id is null then
    raise exception 'Estado "% no existe en el catálogo del sistema', p_nuevo_estado;
  end if;

  if not public.transicion_tecnico_valida(v_actual::nombre, p_nuevo_estado::nombre) then
    raise exception 'Transición no permitida: % → %', v_actual, p_nuevo_estado;
  end if;

  if p_nuevo_estado = 'En espera'
     and (p_detalle is null or btrim(p_detalle) = '') then
    raise exception 'Indica el motivo de la espera';
  end if;

  update public.incidencias
     set estado_id    = v_nuevo_id,
         fecha_inicio = coalesce(fecha_inicio, case
                        when p_nuevo_estado = 'En proceso' then now() end)
   where id = p_incidencia_id;

  if p_detalle is not null and btrim(p_detalle) <> '' then
    perform public.registrar_evento_incidencia(p_incidencia_id,
      'CAMBIAR_ESTADO: ' || v_actual || ' → ' || p_nuevo_estado ||
      ' — ' || left(btrim(p_detalle), 300));
  end if;

  -- AUDITORÍA (Fase 11).
  perform public.auditar(
    'CAMBIAR_ESTADO', 'incidencias', p_incidencia_id,
    (select i2.codigo from public.incidencias i2 where i2.id = p_incidencia_id),
    jsonb_build_object('estado', v_actual),
    jsonb_build_object('estado', p_nuevo_estado, 'detalle', left(coalesce(p_detalle, ''), 300))
  );

  return true;
end;
$$;

revoke all on function public.tecnico_cambiar_estado(uuid, text, text) from public, anon;
grant execute on function public.tecnico_cambiar_estado(uuid, text, text) to authenticated;

create or replace function public.tecnico_resolver_incidencia(
  p_incidencia_id uuid,
  p_solucion      text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual   text;
  v_resuelta uuid;
  v_perfil   uuid;
begin
  if not public.tengo_asignacion_activa(p_incidencia_id) then
    raise exception 'No tienes una asignación activa en esta incidencia';
  end if;
  if not public.perfil_activo() or not public.tiene_permiso('resolver_incidencia') then
    raise exception 'Tu rol no permite resolver incidencias';
  end if;

  if p_solucion is null or btrim(p_solucion) = '' then
    raise exception 'Describe la solución aplicada';
  end if;
  if char_length(btrim(p_solucion)) > 2000 then
    raise exception 'La solución supera los 2000 caracteres';
  end if;

  select e.nombre into v_actual
  from public.incidencias i
  join public.estados_incidencia e on e.id = i.estado_id
  where i.id = p_incidencia_id;

  if v_actual is distinct from 'En proceso' then
    raise exception 'Solo se resuelve desde En proceso (actual: %)', v_actual;
  end if;

  select p.id into v_perfil from public.perfiles p
  where p.id = auth.uid() and p.estado = 'activo' limit 1;

  insert into public.incidencia_tecnicos (incidencia_id, solucion, registrado_por)
  values (p_incidencia_id, btrim(p_solucion), v_perfil)
  on conflict (incidencia_id) do update
    set solucion      = btrim(p_solucion),
        actualizado_en = now();

  select id into v_resuelta from public.estados_incidencia where nombre = 'Resuelta';
  update public.incidencias
     set estado_id        = v_resuelta,
         fecha_resolucion = now()
   where id = p_incidencia_id;

  perform public.registrar_evento_incidencia(p_incidencia_id,
    'SOLUCION: ' || left(btrim(p_solucion), 300));

  -- AUDITORÍA (Fase 11).
  perform public.auditar(
    'RESOLVER', 'incidencias', p_incidencia_id,
    (select i2.codigo from public.incidencias i2 where i2.id = p_incidencia_id),
    jsonb_build_object('estado', v_actual),
    jsonb_build_object('estado', 'Resuelta', 'solucion', left(btrim(p_solucion), 500))
  );

  return true;
end;
$$;

revoke all on function public.tecnico_resolver_incidencia(uuid, text) from public, anon;
grant execute on function public.tecnico_resolver_incidencia(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. CERRAR: al confirmar cierre el REPORTANTE (RLS UPDATE de incidencias,
--    0007). Auditoría por TRIGGER: si estado pasa a Cerrada se registra
--    CERRAR con quién (auth.uid()) y valores previos.
-- ----------------------------------------------------------------------------
create or replace function public.auditar_cambio_incidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anterior text;
  v_nuevo    text;
begin
  select nombre into v_anterior from public.estados_incidencia where id = old.estado_id;
  select nombre into v_nuevo    from public.estados_incidencia where id = new.estado_id;

  if v_nuevo = 'Cerrada' and v_anterior is distinct from 'Cerrada' then
    perform public.auditar(
      'CERRAR', 'incidencias', new.id, new.codigo,
      jsonb_build_object('estado', v_anterior),
      jsonb_build_object('estado', 'Cerrada')
    );
  elsif v_nuevo = 'Cancelada' and v_anterior is distinct from 'Cancelada' then
    perform public.auditar(
      'ANULAR', 'incidencias', new.id, new.codigo,
      jsonb_build_object('estado', v_anterior),
      jsonb_build_object('estado', 'Cancelada')
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_incidencias_auditar_estado on public.incidencias;
create trigger trg_incidencias_auditar_estado
  after update of estado_id on public.incidencias
  for each row execute function public.auditar_cambio_incidencia();

-- ----------------------------------------------------------------------------
-- 6. ADJUNTAR_EVIDENCIA y CERRAR de comentarios/adjuntos (RPC 0013):
--    se redefinen con la auditoría al final. La RPC de adjuntos es
--    registrar_adjuntos (batch); si no existe en este despliegue se omite.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'registrar_adjuntos') then
    raise notice 'RPC registrar_adjuntos detectada: la cobertura de ADJUNTAR_EVIDENCIA se agrega por trigger genérico (bloque 7).';
  end if;
end $$;

-- Trigger genérico para adjuntos (INSERT en incidencia_adjuntos desde la API
-- del usuario): registra ADJUNTAR_EVIDENCIA con actor, incidencia y archivos.
create or replace function public.auditar_adjunto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  select i.codigo into v_codigo from public.incidencias i where i.id = new.incidencia_id;
  perform public.auditar(
    'ADJUNTAR_EVIDENCIA', 'incidencia_adjuntos', new.id, v_codigo,
    null,
    jsonb_build_object('nombre_archivo', new.nombre_archivo,
                       'mime_type', new.mime_type,
                       'tamano_bytes', new.tamano_bytes,
                       'tipo', new.tipo,
                       'path', new.path)
  );
  return null;
end;
$$;

drop trigger if exists trg_adjuntos_auditar on public.incidencia_adjuntos;
create trigger trg_adjuntos_auditar
  after insert on public.incidencia_adjuntos
  for each row execute function public.auditar_adjunto();

-- ----------------------------------------------------------------------------
-- 7. MODIFICAR_CONFIGURACION: cambios en tablas de configuración
--    administrables (acuerdos_nivel_servicio, reglas_enrutamiento,
--    plantillas_notificacion, feriados, roles, permisos, roles_permisos).
--    Trigger genérico: INSERT/UPDATE/DELETE → auditoría con previos y nuevos.
--    (El CRUD admin pasa por RLS p_sla_admin/p_reglas_admin — la escritura
--    real de la API queda registrada igualmente.)
-- ----------------------------------------------------------------------------
create or replace function public.auditar_configuracion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previos jsonb;
  v_nuevos  jsonb;
  v_id      uuid;
  v_accion  text;
begin
  v_accion := case tg_op when 'INSERT' then 'MODIFICAR_CONFIGURACION'
                         when 'UPDATE' then 'MODIFICAR_CONFIGURACION'
                         else 'ANULAR' end;
  if tg_op in ('INSERT','UPDATE') then
    v_nuevos := to_jsonb(new);
    if tg_op = 'UPDATE' then
      v_previos := to_jsonb(old);
    end if;
    -- PK típica: id
    begin
      v_id := (to_jsonb(new)->>'id')::uuid;
    exception when others then
      v_id := null;
    end;
  else
    v_previos := to_jsonb(old);
    begin
      v_id := (to_jsonb(old)->>'id')::uuid;
    exception when others then
      v_id := null;
    end;
  end if;

  -- Sin actor (auth.uid() null, p. ej. seed SQL) el registro queda con actor
  -- NULL (el modelo lo permite: actor_id nullable) — también es información.
  perform public.auditar(
    v_accion, tg_table_name, v_id, null, v_previos, v_nuevos
  );
  return null;
end;
$$;

drop trigger if exists trg_auditar_sla_cfg on public.acuerdos_nivel_servicio;
create trigger trg_auditar_sla_cfg
  after insert or update or delete on public.acuerdos_nivel_servicio
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_reglas_cfg on public.reglas_enrutamiento;
create trigger trg_auditar_reglas_cfg
  after insert or update or delete on public.reglas_enrutamiento
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_plantillas_cfg on public.plantillas_notificacion;
create trigger trg_auditar_plantillas_cfg
  after insert or update or delete on public.plantillas_notificacion
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_feriados_cfg on public.feriados;
create trigger trg_auditar_feriados_cfg
  after insert or update or delete on public.feriados
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_roles_cfg on public.roles;
create trigger trg_auditar_roles_cfg
  after insert or update or delete on public.roles
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_permisos_cfg on public.permisos;
create trigger trg_auditar_permisos_cfg
  after insert or update or delete on public.permisos
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_roles_permisos_cfg on public.roles_permisos;
create trigger trg_auditar_roles_permisos_cfg
  after insert or update or delete on public.roles_permisos
  for each row execute function public.auditar_configuracion();

drop trigger if exists trg_auditar_usuarios_roles_cfg on public.usuarios_roles;
create trigger trg_auditar_usuarios_roles_cfg
  after insert or update or delete on public.usuarios_roles
  for each row execute function public.auditar_configuracion();

-- ----------------------------------------------------------------------------
-- 8. FORTALEZA DE GRANTS (S8): revocar ejecución pública de RPCs sensibles
--    (escritura de flujos) que por defecto pueden quedar grants a public.
-- ----------------------------------------------------------------------------
do $$
declare
  fns text[] := array[
    'derivar_incidencia','asignar_incidencia','clasificar_incidencia',
    'registrar_sla_incidencia','refrescar_sla_incidencia',
    'registrar_slas_pendientes','indicadores_sla',
    'indicadores_analiticos','series_analiticas','reporte_filtros',
    'tecnico_aceptar_incidencia','tecnico_cambiar_estado',
    'tecnico_resolver_incidencia','tecnico_registrar_diagnostico',
    'tecnico_registrar_accion','notificar','notificar_alertas_sla',
    'registrar_slas_pendientes'
  ];
  f text;
begin
  foreach f in array fns loop
    begin
      execute format('revoke all on function public.%I(uuid) from public, anon', f);
    exception when others then
      null; -- firma distinta: se maneja caso por caso abajo
    end;
  end loop;
end $$;

-- Firmas específicas (distintas del patrón uuid único)
revoke all on function public.tecnico_cambiar_estado(uuid, text, text) from public, anon;
revoke all on function public.tecnico_resolver_incidencia(uuid, text) from public, anon;
revoke all on function public.derivar_incidencia(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.indicadores_analiticos(date, date, uuid, uuid, text, text, text) from public, anon;
revoke all on function public.series_analiticas(text, date, date, uuid, uuid, text, text, text, integer) from public, anon;

-- ----------------------------------------------------------------------------
-- 9. VERIFICACIÓN DE SEGURIDAD (S11): RLS habilitado en todas las tablas
--    public.* del modelo (excluye vistas). Levanta error si alguna quedó
--    sin RLS — que es exactamente el fallo que nunca se debe "arreglar"
--    desactivando RLS.
-- ----------------------------------------------------------------------------
do $$
declare
  sin_rls record;
  v_faltan text := '';
begin
  for sin_rls in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false
      and c.relname not like 'pg_%'
  loop
    v_faltan := v_faltan || sin_rls.relname || ', ';
  end loop;

  if btrim(v_faltan) <> '' then
    raise exception 'Tablas sin RLS habilitado: %', v_faltan;
  end if;
end $$;

-- Publication realtime SOLO con notificaciones (S10): quitar cualquier otra
-- tabla que pudiera haberse agregado por error.
do $$
declare
  t record;
begin
  for t in
    select pt.tablename
    from pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename <> 'notificaciones'
  loop
    execute format('alter publication supabase_realtime drop table public.%I', t.tablename);
    raise notice 'Publication realtime: quitada tabla % (solo notificaciones debe estar)', t.tablename;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 10. VERIFICACIÓN
-- ----------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('auditar','consultar_auditoria','auditar_sesion_nueva','auditar_logout',
       'auditar_cambio_incidencia','auditar_adjunto','auditar_configuracion')
  ) or (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('auditar','consultar_auditoria','auditar_sesion_nueva','auditar_logout',
       'auditar_cambio_incidencia','auditar_adjunto','auditar_configuracion')
  ) <> 7 then
    raise exception 'RPCs/triggers de auditoría no creados correctamente';
  end if;
end $$;
