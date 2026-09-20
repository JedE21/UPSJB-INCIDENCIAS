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
