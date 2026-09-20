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
