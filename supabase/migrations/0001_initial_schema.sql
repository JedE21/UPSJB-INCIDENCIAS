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
