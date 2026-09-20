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
