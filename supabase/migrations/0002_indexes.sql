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
