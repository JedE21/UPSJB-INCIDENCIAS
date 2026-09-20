-- ============================================================================
-- SIR-UPSJB · 0017_sla_seguimiento.sql
-- FASE 8b — MÓDULO SLA Y SEGUIMIENTO DE TIEMPOS (Plan Maestro §19 y §47;
-- diseño de BD docs/01 §3.9 y §8.7 — modelo APROBADO, 58 tablas).
--
-- PIEZAS DEL MODELO USADAS (sin inventar tablas ni políticas):
--   · acuerdos_nivel_servicio (0001): horas_respuesta / horas_resolucion por
--     prioridad; la especialización por TIPO pisa al SLA base (§8.7). Los
--     valores son CONFIGURABLES por el administrador (policy p_sla_admin,
--     0007) y la semilla 0005 está marcada [VI]: NO son política oficial de
--     la UPSJB hasta validación institucional.
--   · tiempos_sla (0001): snapshot 1:1 por incidencia.
--   · feriados (0001): se deja SIN uso todavía — el modelo define horas
--     HÁBILES con feriados Y turnos [VI]; los turnos no tienen semilla ni
--     horario institucional aprobado, por lo que NO se inventa un régimen
--     hábil ni una política de pausas (p. ej. En espera). El cronómetro corre
--     en horas corridas hasta que la institución valide otra cosa.
--
-- DECISIONES TÉCNICAS (alineadas al diseño aprobado):
--   · D11: timestamptz SIEMPRE en BD (UTC interno); la presentación en
--     America/Lima es de la app (lib/fechas). Cero fechas del cliente.
--   · El reloj fuente es el de PostgreSQL (now()): nada depende del navegador.
--   · Objetivo = fecha_reporte + horas del acuerdo (calendario corrido).
--   · El snapshot del acuerdo se fija al registrar la incidencia; si no hay
--     acuerdo activo para su prioridad (y especialización por tipo), la
--     incidencia queda SIN SLA (sin fila en tiempos_sla) y todo el módulo la
--     trata como tal.
--   · Sin lógica de pausa por «En espera»: el modelo aprobado no la
--     contempla (docs/01 §6.9 no tiene columnas de pausa). La UI informa que
--     el cronómetro sigue corriendo; una política de pausas requeriría
--     validación institucional previa.
--   · Columnas horas_habiles_* (0001) quedan INTACTAS (NULL): se reservan
--     para el cálculo hábil [VI]. Los tiempos reales corridos se guardan en
--     columnas nuevas explícitas (horas_*_real) sin redefinir el modelo.
--   · Umbrales TÉCNICOS [P] (no institucionales): «en riesgo» cuando el
--     plazo restante cae por debajo del 25 % del plazo total.
--   · Definiciones de indicadores [P] (Plan §47): respuesta = reporte →
--     inicio de atención (fecha_inicio); atención = inicio → resolución;
--     resolución = reporte → resolución. El cierre (fecha_cierre) no afecta
--     el SLA.
--
-- ESTADO «Derivada»: el Plan §15.4 lo lista entre los estados del flujo y
-- las RPC 0016 (clasificar/derivar) lo usan vía estado_id_por_nombre(); la
-- semilla 0005 no lo incluía. Se crea idempotentemente SIN tocar los demás
-- (solo si falta): Resuelta→6, Cerrada→7, Cancelada→8, Derivada→5.
--
-- La LÓGICA vive en la BD (RPC SECURITY DEFINER con revalidación); la app
-- solo la invoca y muestra. Sin service_role.
-- Idempotente y re-ejecutable (create or replace / add column if not exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. ESTADO «Derivada» (Plan §15.4) — solo si falta; renumeración segura
--    (ordena en bloque para no chocar con el UNIQUE de orden).
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
-- 1. COLUMNAS DE SEGUIMIENTO en tiempos_sla (snapshot del acuerdo + eventos)
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

-- Las columnas horas_habiles_* (0001) NO se tocan: quedan reservadas para el
-- cálculo hábil [VI] (feriados + turnos) cuando exista política institucional.

create index if not exists idx_tiempos_sla_objetivo_resolucion
  on public.tiempos_sla (objetivo_resolucion_en);

-- ----------------------------------------------------------------------------
-- 2. ACUERDO APLICABLE (§8.7: la especialización por tipo pisa al base)
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
-- 3. HELPERS DE ESTADO (puros y deterministas; los usan las RPC y las pruebas)
--    Estados de RESPUESTA:  pendiente | cumplido | vencido | sin_dato
--    Estados de RESOLUCIÓN: en_tiempo | en_riesgo | vencido | cumplido | sin_dato
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
-- 4. REGISTRAR SNAPSHOT (se llama tras crear la incidencia — después de la
--    clasificación, para que una prioridad por defecto de regla ya esté
--    aplicada). Idempotente: si ya existe la fila NO la re-escribe (el
--    snapshot del acuerdo es inmutable una vez fijado).
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
  -- Autorización = mismo criterio que p_tiempos_sla_select (0007).
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
    return null; -- INCIDENCIA SIN SLA: no hay acuerdo activo para su prioridad
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

  -- Estampa eventos ya ocurridos (p. ej. re-registro tras un backfill).
  perform public.refrescar_sla_incidencia(p_incidencia_id);

  return v_id;
end;
$$;

revoke all on function public.registrar_sla_incidencia(uuid) from public, anon;
grant execute on function public.registrar_sla_incidencia(uuid) to authenticated;

comment on function public.registrar_sla_incidencia(uuid) is
  'Crea el snapshot de SLA de la incidencia (acuerdo aplicado, inicio y objetivos). Sin acuerdo activo → NULL y la incidencia queda sin SLA.';

-- ----------------------------------------------------------------------------
-- 5. REFRESCAR TIEMPOS REALES (estampa eventos al cambiar de estado:
--    fecha_inicio = primera respuesta; fecha_resolución = fin del SLA).
--    Idempotente: el PRIMER valor registrado gana (no se re-escribe).
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
    return false; -- aún no hay eventos de tiempo que estampar
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
-- 6. LECTURA DEL ESTADO SLA para la UI (detalle de incidencia)
--    Sin acceso o sin SLA → conjunto vacío (indistinguible, sin filtrar info).
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
    return; -- sin acceso (misma respuesta que «sin SLA»: no filtra nada)
  end if;

  select * into v_fila from public.tiempos_sla where incidencia_id = p_incidencia_id;
  if v_fila.incidencia_id is null then
    return; -- incidencia sin SLA
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

  -- RETURNS TABLE (SETOF): la fila se emite explícitamente con RETURN NEXT.
  return next;
end;
$$;

revoke all on function public.sla_de_incidencia(uuid) from public, anon;
grant execute on function public.sla_de_incidencia(uuid) to authenticated;

comment on function public.sla_de_incidencia(uuid) is
  'Estado SLA de una incidencia para la UI: objetivos, eventos, estados de respuesta/resolución y minutos restantes. Calculado con now() de la BD.';

-- ----------------------------------------------------------------------------
-- 7. SLA DE LAS ASIGNACIONES DEL TÉCNICO (dashboard técnico; orden de
--    urgencia: vencidos → en riesgo → resto, por objetivo más próximo).
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
--    Definiciones [P]: respuesta = reporte→inicio; atención = inicio→
--    resolución; resolución = reporte→resolución (horas corridas).
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

  -- Activos = aún sin resolver (Resuelta ya tiene su medición final;
  -- Cerrada/Cancelada salen del flujo).
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

  -- RETURNS TABLE (SETOF): la fila se emite explícitamente con RETURN NEXT.
  return next;
end;
$$;

revoke all on function public.indicadores_sla() from public, anon;
grant execute on function public.indicadores_sla() to authenticated;

comment on function public.indicadores_sla() is
  'Indicadores de tiempo y SLA (Plan §47): promedios de respuesta/atención/resolución, cumplimiento y activos por estado. Admin/coordinador/ver_reportes.';

-- ----------------------------------------------------------------------------
-- 9. BACKFILL: registra el snapshot de incidencias SIN fila (tickets creados
--    antes de esta migración) y estampa sus eventos ya ocurridos.
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
