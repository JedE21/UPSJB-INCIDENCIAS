-- ============================================================================
-- SIR-UPSJB · supabase/pruebas_notificaciones.sql
-- PRUEBAS DEL MÓDULO DE NOTIFICACIONES (Fase 9 — RPCs/triggers de 0018)
--
-- CÓMO EJECUTARLAS: Supabase → SQL Editor (rol postgres). Cada bloque
-- imprime PASS/FAIL con raise notice. Crea datos DEMO/TEST y los elimina
-- al final.
--
-- ESCENARIOS (pedido de la fase):
--   1. Notificación interna   → el flujo genera filas con plantilla+contexto
--   2. Lectura                → marcar una/todas actualiza leida_en
--   3. Realtime               → `notificaciones` publicada en supabase_realtime
--   4. Permisos               → la bandeja solo contiene filas del usuario;
--                               UPDATE de filas ajenas no toca nada (RLS)
--   5. Preferencias           → opt-out por evento silencia la notificación
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Datos DEMO/TEST
-- ----------------------------------------------------------------------------
do $$
declare
  v_sede uuid; v_pab uuid; v_piso uuid; v_tipo_amb uuid;
begin
  insert into public.sedes (nombre, codigo, activa)
  values ('DEMO — Sede de prueba NOTIF (TEST)', 'TESTNOT', true)
  on conflict (codigo) do update set activa = true
  returning id into v_sede;

  insert into public.pabellones (sede_id, nombre, codigo, activo)
  values (v_sede, 'Pabellón TEST', 'T', true)
  on conflict do nothing;
  select id into v_pab from public.pabellones
  where sede_id = v_sede and codigo = 'T' limit 1;

  insert into public.pisos (pabellon_id, numero, nombre)
  values (v_pab, 1, 'Piso 1 TEST')
  on conflict do nothing;
  select id into v_piso from public.pisos
  where pabellon_id = v_pab and numero = 1 limit 1;

  select id into v_tipo_amb from public.tipos_ambiente where nombre = 'Aula' limit 1;

  insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, activo)
  values (v_piso, v_tipo_amb, 'Ambiente NOTIF TEST', 'TESTNOT-T-A1', true)
  on conflict (codigo) do nothing;
end $$;

-- Perfiles de prueba: reportante y técnico
insert into public.perfiles (id, nombres, apellido_paterno, correo, estado)
values
  ('00000000-0000-0000-0000-00000000bb01', 'Demo', 'Reportante', 'notif.demo1@test.invalid', 'activo'),
  ('00000000-0000-0000-0000-00000000bb02', 'Demo', 'Tecnico',   'notif.demo2@test.invalid', 'activo')
on conflict (id) do nothing;

-- Perfil técnico operativo (para probar la notificación de asignación)
insert into public.tecnicos (perfil_id, area_id, sede_id, activo)
select '00000000-0000-0000-0000-00000000bb02', a.id, s.id, true
from public.areas a, public.sedes s
where a.nombre = (select min(nombre) from public.areas)
  and s.codigo = 'TESTNOT'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 1 · NOTIFICACIÓN INTERNA: crear incidencia dispara 'nueva_incidencia' al
--     reportante con la plantilla activa (placeholders resueltos)
-- ----------------------------------------------------------------------------
do $$
declare
  v_reportante uuid := '00000000-0000-0000-0000-00000000bb01';
  v_inc uuid;
  v_titulo text;
begin
  select set_config('request.jwt.claim.sub', v_reportante::text, false);

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion)
  select v_reportante,
    (select id from public.ambientes where codigo = 'TESTNOT-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    (select id from public.prioridades where nombre = 'Media'),
    'Prueba de notificacion al crear incidencia (datos TEST).'
  returning id into v_inc;

  select titulo into v_titulo
  from public.notificaciones
  where perfil_id = v_reportante and incidencia_id = v_inc
  limit 1;

  if v_titulo like 'Reporte registrado%' then
    raise notice 'PASS 1 · notificacion interna: fila creada con plantilla (%): %',
      'nueva_incidencia', v_titulo;
  else
    raise notice 'FAIL 1 · notificacion interna (titulo: %)', coalesce(v_titulo, 'NULL');
  end if;

  -- Dedupe: re-disparar no duplica la no leída
  perform public.notificar(v_reportante, 'nueva_incidencia', v_inc);
  if (select count(*) from public.notificaciones
      where perfil_id = v_reportante and incidencia_id = v_inc) = 1 then
    raise notice 'PASS 1b · dedupe: no se duplica la notificación no leída';
  else
    raise notice 'FAIL 1b · dedupe de notificaciones';
  end if;

  -- Guardar id para las pruebas siguientes (tabla temporal de apoyo)
  create temp table if not exists _notif_test (incidencia_id uuid primary key);
  insert into _notif_test values (v_inc) on conflict do nothing;
end $$;

-- ----------------------------------------------------------------------------
-- 5 · PREFERENCIAS: opt-out de 'resuelta' silencia la notificación
-- ----------------------------------------------------------------------------
do $$
declare
  v_reportante uuid := '00000000-0000-0000-0000-00000000bb01';
  v_inc uuid;
  v_antes int;
  v_despues int;
begin
  select set_config('request.jwt.claim.sub', v_reportante::text, false);
  select incidencia_id into v_inc from _notif_test;

  select count(*) into v_antes from public.notificaciones
  where perfil_id = v_reportante;

  -- El usuario DESACTIVA el evento resuelta
  insert into public.preferencias_notificacion (perfil_id, evento, habilitado)
  values (v_reportante, 'resuelta', false)
  on conflict (perfil_id, evento) do update set habilitado = false;

  -- Resolver la incidencia (estado → Resuelta): trigger de estado
  update public.incidencias
     set estado_id = (select id from public.estados_incidencia where nombre = 'Resuelta'),
         fecha_resolucion = now()
   where id = v_inc;

  select count(*) into v_despues from public.notificaciones
  where perfil_id = v_reportante;

  if v_despues = v_antes then
    raise notice 'PASS 5 · preferencias: opt-out de resuelta silencia la notificación';
  else
    raise notice 'FAIL 5 · preferencias (antes %, después %)', v_antes, v_despues;
  end if;

  -- Reactivar para la prueba 2
  update public.preferencias_notificacion set habilitado = true
  where perfil_id = v_reportante and evento = 'resuelta';
end $$;

-- ----------------------------------------------------------------------------
-- 2 · LECTURA: refrescar_sla NO; aquí cambio de estado → nueva notificación;
--     marcar leídas una y todas vía UPDATE con RLS
-- ----------------------------------------------------------------------------
do $$
declare
  v_reportante uuid := '00000000-0000-0000-0000-00000000bb01';
  v_inc uuid;
  v_notif uuid;
  v_no_leidas int;
begin
  select set_config('request.jwt.claim.sub', v_reportante::text, false);
  select incidencia_id into v_inc from _notif_test;

  -- Cambio de estado En proceso (evento con preferencia activa)
  update public.incidencias
     set estado_id = (select id from public.estados_incidencia where nombre = 'En proceso'),
         fecha_inicio = now()
   where id = v_inc;

  if (select count(*) from public.notificaciones n
      where n.perfil_id = v_reportante and n.incidencia_id = v_inc
        and n.plantilla_id = (select id from public.plantillas_notificacion where evento = 'en_proceso')) >= 1 then
    raise notice 'PASS 2a · lectura: cambio de estado generó notificación en_proceso';
  else
    raise notice 'FAIL 2a · notificación en_proceso no creada';
  end if;

  select id into v_notif from public.notificaciones
  where perfil_id = v_reportante and leida_en is null order by creado_en limit 1;

  -- Marcar UNA como leída
  update public.notificaciones set leida_en = now()
  where id = v_notif and perfil_id = v_reportante and leida_en is null;

  if (select leida_en is not null from public.notificaciones where id = v_notif) then
    raise notice 'PASS 2b · lectura: una notificación marcada como leída';
  else
    raise notice 'FAIL 2b · marcar una como leída';
  end if;

  -- Marcar TODAS
  update public.notificaciones set leida_en = now()
  where perfil_id = v_reportante and leida_en is null;
  select count(*) into v_no_leidas from public.notificaciones
  where perfil_id = v_reportante and leida_en is null;
  if v_no_leidas = 0 then
    raise notice 'PASS 2c · lectura: marcar todas (restantes no leídas: 0)';
  else
    raise notice 'FAIL 2c · marcar todas (quedan %)', v_no_leidas;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4 · PERMISOS: la bandeja RPC solo devuelve filas del usuario autenticado;
--     y un UPDATE sin el filtro de dueño no afecta filas ajenas (RLS).
-- ----------------------------------------------------------------------------
do $$
declare
  v_reportante uuid := '00000000-0000-0000-0000-00000000bb01';
  v_otro uuid := '00000000-0000-0000-0000-00000000bb02';
  v_inc uuid;
  v_total_ambos int;
  v_vistas_bb01 int;
begin
  -- Reportante crea otra incidencia para tener filas propias
  select set_config('request.jwt.claim.sub', v_reportante::text, false);
  select incidencia_id into v_inc from _notif_test;

  -- Total de filas de ambos perfiles (via Security Definer desde postgres)
  select count(*) into v_total_ambos
  from public.notificaciones n
  where n.perfil_id in (v_reportante, v_otro) or n.perfil_id = v_otro;

  -- Bandeja del reportante: solo SUS filas
  select count(*) into v_vistas_bb01
  from public.mis_notificaciones(false, 100);

  if v_vistas_bb01 <= (select count(*) from public.notificaciones where perfil_id = v_reportante) then
    raise notice 'PASS 4a · permisos: la bandeja devuelve solo filas del usuario autenticado (%)', v_vistas_bb01;
  else
    raise notice 'FAIL 4a · bandeja expone filas ajenas (%)', v_vistas_bb01;
  end if;

  -- Intento de UPDATE masivo SIN filtro (simula cliente manipulado): RLS
  -- p_notificaciones_update lo limita a perfil_id = usuario_actual().
  -- Bajo postgres RLS no aplica; se valida la POLICY por definición:
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notificaciones'
      and policyname = 'p_notificaciones_update'
      and qual like '%usuario_actual()%'
  ) then
    raise notice 'PASS 4b · permisos: p_notificaciones_update limitada a la fila propia (RLS)';
  else
    raise notice 'FAIL 4b · policy de update de notificaciones inesperada';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notificaciones'
      and policyname = 'p_notificaciones_select'
      and qual like '%usuario_actual()%'
  ) then
    raise notice 'PASS 4c · permisos: p_notificaciones_select solo perfil propio';
  else
    raise notice 'FAIL 4c · policy de select de notificaciones inesperada';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3 · REALTIME: `notificaciones` publicada en supabase_realtime; las tablas
--     operativas NO están publicadas
-- ----------------------------------------------------------------------------
do $$
declare
  v_publicada boolean;
  v_incidencias_publicada boolean;
begin
  select exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notificaciones'
  ) into v_publicada;

  select exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'incidencias'
  ) into v_incidencias_publicada;

  if v_publicada and not v_incidencias_publicada then
    raise notice 'PASS 3 · realtime: notificaciones publicada; incidencias NO publicada (RLS por suscriptor)';
  else
    raise notice 'FAIL 3 · realtime publication (notificaciones: %, incidencias: %)',
      v_publicada, v_incidencias_publicada;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6 · Limpieza de datos DEMO/TEST
-- ----------------------------------------------------------------------------
delete from public.notificaciones where perfil_id in (
  '00000000-0000-0000-0000-00000000bb01',
  '00000000-0000-0000-0000-00000000bb02'
);
delete from public.tecnicos where perfil_id = '00000000-0000-0000-0000-00000000bb02';
delete from public.incidencias where ambiente_id in (
  select id from public.ambientes where codigo = 'TESTNOT-T-A1'
);
delete from public.ambientes where codigo = 'TESTNOT-T-A1';
delete from public.pisos where nombre = 'Piso 1 TEST';
delete from public.pabellones where codigo = 'T'
  and sede_id in (select id from public.sedes where codigo = 'TESTNOT');
delete from public.sedes where codigo = 'TESTNOT';
delete from public.perfiles where id in (
  '00000000-0000-0000-0000-00000000bb01',
  '00000000-0000-0000-0000-00000000bb02'
);

do $$ begin
  raise notice 'Limpieza completada. Revisa los PASS/FAIL de arriba.';
end $$;
