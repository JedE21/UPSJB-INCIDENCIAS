-- ============================================================================
-- SIR-UPSJB · supabase/pruebas_sla.sql
-- PRUEBAS DEL MÓDULO SLA (Fase 8b — RPCs de la migración 0017)
--
-- CÓMO EJECUTARLAS: Supabase → SQL Editor (rol postgres, NO anon/authenticated).
-- Cada bloque imprime PASS/FAIL con raise notice. Crea datos marcados
-- DEMO/TEST y los elimina al final (no toca datos institucionales).
--
-- ESCENARIOS (pedido de la fase):
--   1. SLA cumplido              → resuelta antes del objetivo
--   2. SLA próximo a vencer      → «en_riesgo» (restante < 25 % del plazo)
--   3. SLA vencido               → activa pasada la hora objetivo
--   4. Cambio de estado          → aceptar/resolver estampa eventos y horas
--   5. Cálculo de tiempos        → objetivos = reporte + horas del acuerdo
--   6. Incidencia sin SLA        → sin acuerdo activo ⇒ sin fila (NULL)
--
-- NOTA: las RPC llaman a es_dueno/es_tecnico/soy_administrador(), que leen
-- el JWT (auth.uid()). Bajo postgres auth.uid() es NULL; por eso cada prueba
-- SIMULA la sesión con set_config('request.jwt.claim.sub', <perfil>, true)
-- (local a la transacción) usando perfiles DEMO/TEST creados aquí.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Datos DEMO/TEST mínimos
-- ----------------------------------------------------------------------------
do $$
declare
  v_sede uuid; v_pab uuid; v_piso uuid; v_tipo_amb uuid;
begin
  -- Sede de prueba (código TEST reservado para datos de prueba)
  insert into public.sedes (nombre, codigo, activa)
  values ('DEMO — Sede de prueba SLA (TEST)', 'TESTSLA', true)
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
  values (v_piso, v_tipo_amb, 'Ambiente SLA TEST', 'TESTSLA-T-A1', true)
  on conflict (codigo) do nothing;
end $$;

-- Perfiles DEMO/TEST (uno dueño-reportante, uno admin para el backfill)
insert into public.perfiles (id, nombres, apellido_paterno, correo, estado)
values
  ('00000000-0000-0000-0000-00000000aa01', 'Demo', 'SLA', 'sla.demo@test.invalid', 'activo'),
  ('00000000-0000-0000-0000-00000000aa02', 'Admin', 'SLA', 'sla.admin@test.invalid', 'activo')
on conflict (id) do nothing;

-- Rol ADMINISTRADOR para el perfil admin de prueba
insert into public.usuarios_roles (perfil_id, rol_id)
select '00000000-0000-0000-0000-00000000aa02', r.id
from public.roles r where r.nombre = 'ADMINISTRADOR'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Helpers: simular sesión (solo dentro de la transacción/bloque actual)
-- ----------------------------------------------------------------------------
create or replace function public.__sla_simular_sesion(p_perfil uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', p_perfil::text, false);
$$;

-- ----------------------------------------------------------------------------
-- 5 (primero) · CÁLCULO DE TIEMPOS: objetivos = reporte + horas del acuerdo
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_sla record;
  v_obj_resp timestamptz;
  v_obj_resol timestamptz;
begin
  perform public.__sla_simular_sesion(v_perfil);

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    (select id from public.prioridades where nombre = 'Media'),
    'Prueba de calculo de objetivos del SLA (datos TEST).'
  returning id into v_inc;

  perform public.registrar_sla_incidencia(v_inc);

  select t.objetivo_respuesta_en, t.objetivo_resolucion_en,
         a.horas_respuesta, a.horas_resolucion, i.fecha_reporte
    into v_sla
  from public.tiempos_sla t
  join public.acuerdos_nivel_servicio a on a.id = t.acuerdo_id
  join public.incidencias i on i.id = t.incidencia_id
  where t.incidencia_id = v_inc;

  v_obj_resp := v_sla.fecha_reporte + (v_sla.horas_respuesta * interval '1 hour');
  v_obj_resol := v_sla.fecha_reporte + (v_sla.horas_resolucion * interval '1 hour');

  if v_sla.objetivo_respuesta_en = v_obj_resp
     and v_sla.objetivo_resolucion_en = v_obj_resol then
    raise notice 'PASS 5 · calculo de tiempos: objetivos = reporte + horas del acuerdo';
  else
    raise notice 'FAIL 5 · calculo de tiempos (objetivo resp %, esperado %)',
      v_sla.objetivo_respuesta_en, v_obj_resp;
  end if;

  delete from public.incidencias where id = v_inc;
end $$;

-- ----------------------------------------------------------------------------
-- 4 · CAMBIO DE ESTADO: aceptar estampa primera respuesta; resolver estampa
--     resolución, horas reales y cumplimiento
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_sla record;
begin
  perform public.__sla_simular_sesion(v_perfil);

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    (select id from public.prioridades where nombre = 'Media'),
    'Prueba de eventos por cambio de estado (datos TEST).'
  returning id into v_inc;

  perform public.registrar_sla_incidencia(v_inc);

  -- Sin eventos todavía: estados pendientes
  select * into v_sla from public.tiempos_sla where incidencia_id = v_inc;
  if v_sla.primera_respuesta_en is null and v_sla.resolucion_en is null then
    raise notice 'PASS 4a · cambio de estado: sin eventos, respuesta/resolución pendientes';
  else
    raise notice 'FAIL 4a · cambio de estado: eventos estampados sin cambio de estado';
  end if;

  -- ACEPTAR (fecha_inicio = primera respuesta)
  update public.incidencias
     set fecha_inicio = now()
   where id = v_inc;
  perform public.refrescar_sla_incidencia(v_inc);

  select * into v_sla from public.tiempos_sla where incidencia_id = v_inc;
  if v_sla.primera_respuesta_en is not null
     and v_sla.cumplieron_respuesta is not null
     and v_sla.horas_respuesta_real is not null then
    raise notice 'PASS 4b · cambio de estado: primera respuesta estampada (cumplio: %, horas: %)',
      v_sla.cumplieron_respuesta, v_sla.horas_respuesta_real;
  else
    raise notice 'FAIL 4b · cambio de estado: primera respuesta no estampada';
  end if;

  -- RESOLVER (fecha_resolucion = fin del SLA)
  update public.incidencias
     set fecha_resolucion = now()
   where id = v_inc;
  perform public.refrescar_sla_incidencia(v_inc);

  select * into v_sla from public.tiempos_sla where incidencia_id = v_inc;
  if v_sla.resolucion_en is not null
     and v_sla.cumplieron_resolucion is not null
     and v_sla.horas_resolucion_real is not null then
    raise notice 'PASS 4c · cambio de estado: resolución estampada (cumplio: %, horas: %)',
      v_sla.cumplieron_resolucion, v_sla.horas_resolucion_real;
  else
    raise notice 'FAIL 4c · cambio de estado: resolución no estampada';
  end if;

  -- Idempotencia: el primer valor gana (una re-lectura no re-escribe)
  update public.incidencias set fecha_resolucion = now() + interval '1 hour' where id = v_inc;
  perform public.refrescar_sla_incidencia(v_inc);
  select resolucion_en into v_sla from public.tiempos_sla where incidencia_id = v_inc;
  if v_sla.resolucion_en < now() + interval '30 minutes' then
    raise notice 'PASS 4d · cambio de estado: el primer valor registrado gana (idempotente)';
  else
    raise notice 'FAIL 4d · cambio de estado: re-registro re-escribió la resolución';
  end if;

  delete from public.incidencias where id = v_inc;
end $$;

-- ----------------------------------------------------------------------------
-- 1 · SLA CUMPLIDO: resuelta antes del objetivo ⇒ estado 'cumplido'
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_sla record;
begin
  perform public.__sla_simular_sesion(v_perfil);

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion,
     fecha_resolucion)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    (select id from public.prioridades where nombre = 'Alta'),
    'Prueba SLA cumplido: resuelta muy antes del objetivo (datos TEST).',
    now() + interval '10 minutes'
  returning id into v_inc;

  perform public.registrar_sla_incidencia(v_inc);

  select estado_resolucion into v_sla
  from public.sla_de_incidencia(v_inc);

  if v_sla = 'cumplido' then
    raise notice 'PASS 1 · SLA cumplido: estado_resolucion = cumplido';
  else
    raise notice 'FAIL 1 · SLA cumplido (estado: %)', v_sla;
  end if;

  delete from public.incidencias where id = v_inc;
end $$;

-- ----------------------------------------------------------------------------
-- 2 · SLA PRÓXIMO A VENCER: iniciada hace tiempo con objetivo cercano
--     ⇒ 'en_riesgo' (restante < 25 % del plazo, umbral técnico [P])
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_sla record;
begin
  perform public.__sla_simular_sesion(v_perfil);

  -- Media: resolución 48 h (semilla [VI]). Reportada hace 37 h ⇒ restante
  -- 11 h = 23 % del plazo < 25 % ⇒ en_riesgo. (fecha_reporte explícita para
  -- reproducibilidad; fecha_inicio fija la primera respuesta.)
  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion,
     fecha_reporte, fecha_inicio)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    (select id from public.prioridades where nombre = 'Media'),
    'Prueba SLA en riesgo: restante bajo el umbral (datos TEST).',
    now() - interval '37 hours',
    now() - interval '36 hours'
  returning id into v_inc;

  perform public.registrar_sla_incidencia(v_inc);

  select estado_resolucion, minutos_restantes_resolucion into v_sla
  from public.sla_de_incidencia(v_inc);

  if v_sla.estado_resolucion = 'en_riesgo' then
    raise notice 'PASS 2 · SLA en riesgo: restante % min (< 25 % del plazo)',
      v_sla.minutos_restantes_resolucion;
  else
    raise notice 'FAIL 2 · SLA en riesgo (estado: %)', v_sla.estado_resolucion;
  end if;

  delete from public.incidencias where id = v_inc;
end $$;

-- ----------------------------------------------------------------------------
-- 3 · SLA VENCIDO: activa pasada la hora objetivo ⇒ 'vencido'
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_sla record;
begin
  perform public.__sla_simular_sesion(v_perfil);

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion,
     fecha_reporte)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    (select id from public.prioridades where nombre = 'Alta'),
    'Prueba SLA vencido: activa pasada la hora objetivo (datos TEST).',
    now() - interval '12 hours'
  returning id into v_inc;

  perform public.registrar_sla_incidencia(v_inc);

  select estado_resolucion, estado_respuesta into v_sla
  from public.sla_de_incidencia(v_inc);

  if v_sla.estado_resolucion = 'vencido' and v_sla.estado_respuesta = 'vencido' then
    raise notice 'PASS 3 · SLA vencido: resolución y respuesta vencidas';
  else
    raise notice 'FAIL 3 · SLA vencido (resol: %, resp: %)',
      v_sla.estado_resolucion, v_sla.estado_respuesta;
  end if;

  delete from public.incidencias where id = v_inc;
end $$;

-- ----------------------------------------------------------------------------
-- 6 · INCIDENCIA SIN SLA: sin acuerdo activo para su prioridad/tipo
--     ⇒ sin fila en tiempos_sla y sla_de_incidencia vacío
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_prioridad uuid;
  v_acuerdo uuid;
  v_filas int;
  v_registrado uuid;
begin
  perform public.__sla_simular_sesion(v_perfil);

  -- Prioridad temporal de prueba SIN ningún acuerdo activo
  insert into public.prioridades (nombre, nivel, color)
  values ('SIN-SLA-TEST', 9, '#999999')
  on conflict (nombre) do nothing;
  select id into v_prioridad from public.prioridades where nombre = 'SIN-SLA-TEST';

  -- Por si una ejecución anterior dejó acuerdos: desactivarlos temporalmente
  update public.acuerdos_nivel_servicio
     set activo = false
   where prioridad_id = v_prioridad;

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    (select id from public.tipos_incidencia where nombre = 'Técnica'),
    v_prioridad,
    'Prueba incidencia sin SLA: sin acuerdo activo (datos TEST).'
  returning id into v_inc;

  v_registrado := public.registrar_sla_incidencia(v_inc);

  select count(*) into v_filas from public.tiempos_sla where incidencia_id = v_inc;
  select count(*) into v_acuerdo from public.sla_de_incidencia(v_inc);

  if v_registrado is null and v_filas = 0 and v_acuerdo = 0 then
    raise notice 'PASS 6 · incidencia sin SLA: sin acuerdo ⇒ sin fila ni estado';
  else
    raise notice 'FAIL 6 · incidencia sin SLA (rpc: %, filas: %, lectura: %)',
      v_registrado is null, v_filas, v_acuerdo;
  end if;

  delete from public.incidencias where id = v_inc;
  delete from public.prioridades where id = v_prioridad;
end $$;

-- ----------------------------------------------------------------------------
-- 7 · ESPECIALIZACIÓN POR TIPO pisa al SLA base (§8.7 del diseño aprobado)
-- ----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid := '00000000-0000-0000-0000-00000000aa01';
  v_inc uuid;
  v_tipo uuid;
  v_base uuid;
  v_esp uuid;
  v_aplicado uuid;
begin
  perform public.__sla_simular_sesion(v_perfil);

  select id into v_tipo from public.tipos_incidencia where nombre = 'Técnica' limit 1;
  select a.id into v_base from public.acuerdos_nivel_servicio a
    join public.prioridades p on p.id = a.prioridad_id
   where p.nombre = 'Media' and a.tipo_incidencia_id is null and a.activo limit 1;

  -- Acuerdo especializado TEMPORAL para Técnica+Media
  insert into public.acuerdos_nivel_servicio
    (prioridad_id, tipo_incidencia_id, horas_respuesta, horas_resolucion, activo)
  values
    ((select id from public.prioridades where nombre = 'Media'), v_tipo,
     0.5, 2.0, true)
  returning id into v_esp;

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id, descripcion)
  select v_perfil,
    (select id from public.ambientes where codigo = 'TESTSLA-T-A1'),
    v_tipo,
    (select id from public.prioridades where nombre = 'Media'),
    'Prueba especialización SLA por tipo (datos TEST).'
  returning id into v_inc;

  perform public.registrar_sla_incidencia(v_inc);

  select acuerdo_id into v_aplicado from public.tiempos_sla where incidencia_id = v_inc;

  if v_aplicado = v_esp and v_aplicado <> v_base then
    raise notice 'PASS 7 · especialización: el acuerdo por tipo pisa al base';
  else
    raise notice 'FAIL 7 · especialización (aplicado: %, esperado: %)', v_aplicado, v_esp;
  end if;

  delete from public.incidencias where id = v_inc;
  delete from public.acuerdos_nivel_servicio where id = v_esp;
end $$;

-- ----------------------------------------------------------------------------
-- 8 · Limpieza de datos DEMO/TEST (la app no borra datos operativos, pero
--     estos son datos de PRUEBA creados por este script)
-- ----------------------------------------------------------------------------
delete from public.incidencias where ambiente_id in (
  select id from public.ambientes where codigo = 'TESTSLA-T-A1'
);
delete from public.ambientes where codigo = 'TESTSLA-T-A1';
delete from public.pisos where nombre = 'Piso 1 TEST';
delete from public.pabellones where codigo = 'T'
  and sede_id in (select id from public.sedes where codigo = 'TESTSLA');
delete from public.sedes where codigo = 'TESTSLA';
delete from public.perfiles where id in (
  '00000000-0000-0000-0000-00000000aa01',
  '00000000-0000-0000-0000-00000000aa02'
);

do $$ begin
  raise notice 'Limpieza completada. Revisa los PASS/FAIL de arriba.';
end $$;
