-- ============================================================================
-- SIR-UPSJB · pruebas_reportes.sql
-- PRUEBAS DEL MÓDULO DE REPORTES (Fase 10 — RPCs 0019)
--
-- CÓMO EJECUTARLAS: Supabase → SQL Editor (como postgres, NO como anon).
-- Cada bloque imprime PASS/FAIL con raise notice. Limpia sus datos de
-- prueba al final (prefijo TEST/9999, sin tocar datos institucionales).
--
-- REQUISITO: haber aplicado la migración 0019 (y 0001..0018 antes).
--
-- ESCENARIOS:
--   1. Agregados correctos con semilla controlada (totales por estado/
--      prioridad/tipo/área/ambiente/equipo/mes).
--   2. Filtros server-side (fechas, sede, área, estado, prioridad, tipo).
--   3. Tiempos promedio y fuera de SLA (cumplido vs vencido).
--   4. Permisos: admin SÍ consulta; usuario sin rol/permiso NO (excepción).
--   5. reporte_detalle respeta RLS: el dueño ve su fila; otro usuario no.
--   6. Sin datos: filtros imposibles devuelven 0 filas / ceros, no error.
--   7. Serie desconocida → excepción controlada (no SQL dinámico).
--
-- NOTA SOBRE auth.uid(): para simular usuarios se usa set_config
-- ('request.jwt.claims') como hace el resto de pruebas del proyecto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DATOS DE PRUEBA: 1 sede/pabellón/piso/ambiente TEST + 3 incidencias
-- (1 resuelta cumplida, 1 resuelta fuera de SLA, 1 pendiente) + acuerdo SLA.
-- ----------------------------------------------------------------------------
do $$
declare
  v_admin   uuid;
  v_otros   uuid;
  v_sede    uuid;
  v_pab     uuid;
  v_piso    uuid;
  v_amb     uuid;
  v_estado_p uuid;
  v_estado_r uuid;
  v_estado_c uuid;
  v_prio    uuid;
  v_tipo    uuid;
  v_area    uuid;
  v_tec     uuid;
  v_i1 uuid; v_i2 uuid; v_i3 uuid;
begin
  -- Perfiles TEST (id explícito = auth.users; en producción van por Auth).
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  values (
    gen_random_uuid(), 'test-admin-reportes@example.com', 'x',
    now(), jsonb_build_object('provider','email','providers',jsonb_build_array('email'))
  )
  on conflict (email) do nothing
  returning id into v_admin;

  if v_admin is null then
    select id into v_admin from auth.users
    where email = 'test-admin-reportes@example.com';
  end if;

  insert into public.perfiles (id, nombres, apellido_paterno, correo)
  values (v_admin, 'TEST Admin', 'Reportes', 'test-admin-reportes@example.com')
  on conflict (id) do nothing;

  -- Rol ADMINISTRADOR para ese perfil
  insert into public.usuarios_roles (perfil_id, rol_id)
  select v_admin, r.id from public.roles r where r.nombre = 'ADMINISTRADOR'
  on conflict do nothing;

  -- Otro usuario SIN roles (para la prueba de permisos y RLS)
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  values (
    gen_random_uuid(), 'test-sin-rol-reportes@example.com', 'x',
    now(), jsonb_build_object('provider','email','providers',jsonb_build_array('email'))
  )
  on conflict (email) do nothing
  returning id into v_otros;

  if v_otros is null then
    select id into v_otros from auth.users
    where email = 'test-sin-rol-reportes@example.com';
  end if;

  insert into public.perfiles (id, nombres, apellido_paterno, correo)
  values (v_otros, 'TEST SinRol', 'Reportes', 'test-sin-rol-reportes@example.com')
  on conflict (id) do nothing;

  -- Infraestructura TEST
  insert into public.sedes (nombre, codigo, activa)
  values ('TEST Sede Reportes', 'TESTREP', true)
  on conflict (codigo) do nothing
  returning id into v_sede;

  insert into public.pabellones (sede_id, nombre, codigo)
  values (v_sede, 'TEST Pabellón', 'TP')
  returning id into v_pab;

  insert into public.pisos (pabellon_id, numero)
  values (v_pab, 1)
  returning id into v_piso;

  insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo)
  select v_piso, t.id, 'TEST Ambiente Reportes', 'TESTREP-TP-0001'
  from public.tipos_ambiente t
  where t.activo
  limit 1
  returning id into v_amb;

  -- Catálogos
  select id into v_estado_p from public.estados_incidencia where nombre = 'Pendiente';
  select id into v_estado_r from public.estados_incidencia where nombre = 'Resuelta';
  select id into v_estado_c from public.estados_incidencia where nombre = 'Cerrada';
  select id into v_prio from public.prioridades where nombre = 'Media';
  select id into v_tipo  from public.tipos_incidencia limit 1;
  select id into v_area  from public.areas limit 1;

  -- Incidencias TEST (código lo genera el trigger; descripción >= 10 chars)
  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id,
     estado_id, canal_reporte_id, descripcion, fecha_reporte)
  select v_otros, v_amb, v_tipo, v_prio, v_estado_r, c.id,
         'TEST incidencia resuelta cumplida', now() - interval '10 days'
  from public.canales_reporte c limit 1
  returning id into v_i1;

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id,
     estado_id, canal_reporte_id, descripcion, fecha_reporte)
  select v_otros, v_amb, v_tipo, v_prio, v_estado_r, c.id,
         'TEST incidencia resuelta vencida', now() - interval '5 days'
  from public.canales_reporte c limit 1
  returning id into v_i2;

  insert into public.incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id, prioridad_id,
     estado_id, canal_reporte_id, descripcion, fecha_reporte)
  select v_otros, v_amb, v_tipo, v_prio, v_estado_p, c.id,
         'TEST incidencia pendiente', now()
  from public.canales_reporte c limit 1
  returning id into v_i3;

  -- Área responsable (derivación inicial activa) para las 3
  insert into public.incidencia_derivaciones (incidencia_id, area_destino_id, motivo)
  values
    (v_i1, v_area, 'TEST derivación inicial'),
    (v_i2, v_area, 'TEST derivación inicial'),
    (v_i3, v_area, 'TEST derivación inicial');

  -- Resoluciones: i1 cumplida (4 h), i2 vencida (100 h si el SLA es menor)
  update public.incidencias
    set fecha_inicio = fecha_reporte + interval '2 hours',
        fecha_resolucion = fecha_reporte + interval '4 hours'
  where id = v_i1;

  update public.incidencias
    set fecha_inicio = fecha_reporte + interval '10 hours',
        fecha_resolucion = fecha_reporte + interval '100 hours'
  where id = v_i2;

  -- Acuerdo SLA para Media (si no existe) y snapshot en tiempos_sla
  insert into public.acuerdos_nivel_servicio (prioridad_id, horas_respuesta, horas_resolucion)
  select v_prio, 4, 24
  on conflict do nothing
  returning id into v_tec;

  if v_tec is null then
    select a.id into v_tec
    from public.acuerdos_nivel_servicio a
    where a.prioridad_id = v_prio and a.tipo_incidencia_id is null
    limit 1;
  end if;

  perform public.registrar_sla_incidencia(v_i1);
  perform public.registrar_sla_incidencia(v_i2);
  perform public.registrar_sla_incidencia(v_i3);
  perform public.refrescar_sla_incidencia(v_i1);
  perform public.refrescar_sla_incidencia(v_i2);

  -- Guardar ids para los bloques siguientes (sesión vía set_config)
  perform set_config('app.test_admin_id', v_admin::text, false);
  perform set_config('app.test_i1', v_i1::text, false);
  perform set_config('app.test_i2', v_i2::text, false);
  perform set_config('app.test_i3', v_i3::text, false);
  perform set_config('app.test_sede', v_sede::text, false);
  perform set_config('app.test_amb', v_amb::text, false);
end $$;

-- ----------------------------------------------------------------------------
-- SIMULAR SESIÓN ADMIN (claims JWT como en las demás pruebas del proyecto)
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub',
    (select current_setting('app.test_admin_id')::uuid)::text,
    'role', 'authenticated')::text,
  false);

-- ----------------------------------------------------------------------------
-- PRUEBA 1 · AGREGADOS: total = 3, resueltas = 2, pendientes = 1
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  select * into v from public.indicadores_analiticos(
    null, null,
    (select current_setting('app.test_sede')::uuid),  -- solo sede TEST
    null, null, null, null
  );
  if v.total = 3 and v.resueltas = 2 and v.pendientes = 1 then
    raise notice 'PASS 1a: agregados operativos (total=%, resueltas=%, pendientes=%)', v.total, v.resueltas, v.pendientes;
  else
    raise notice 'FAIL 1a: agregados operativos (total=%, resueltas=%, pendientes=%)', v.total, v.resueltas, v.pendientes;
  end if;

  -- Serie por estado con la sede TEST
  if (select count(*) from public.series_analiticas('estado', null, null,
        (select current_setting('app.test_sede')::uuid), null, null, null, null))
     = 2 then
    raise notice 'PASS 1b: serie por estado devuelve 2 grupos (Resuelta + Pendiente)';
  else
    raise notice 'FAIL 1b: serie por estado no agrupa como se espera';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PRUEBA 2 · FILTROS: por estado y por fechas
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  -- Filtro estado=Resuelta sobre sede TEST
  select * into v from public.indicadores_analiticos(
    null, null,
    (select current_setting('app.test_sede')::uuid),
    null, 'Resuelta', null, null
  );
  if v.total = 2 then
    raise notice 'PASS 2a: filtro por estado (total=%)', v.total;
  else
    raise notice 'FAIL 2a: filtro por estado (total=%)', v.total;
  end if;

  -- Filtro fechas: solo la incidencia de hoy (v_i3)
  select * into v from public.indicadores_analiticos(
    current_date, current_date,
    (select current_setting('app.test_sede')::uuid),
    null, null, null, null
  );
  if v.total = 1 then
    raise notice 'PASS 2b: filtro por fechas (total=%)', v.total;
  else
    raise notice 'FAIL 2b: filtro por fechas (total=%)', v.total;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PRUEBA 3 · TIEMPOS Y SLA: promedios con las 2 resueltas
--   i1: respuesta 2 h (cumple si acuerdo=4), atención 2 h, resolución 4 h
--   i2: respuesta 10 h (vence), atención 90 h, resolución 100 h (vence)
-- ----------------------------------------------------------------------------
do $$
declare
  v record;
begin
  select * into v from public.indicadores_analiticos(
    null, null,
    (select current_setting('app.test_sede')::uuid),
    null, null, null, null
  );

  -- fuera de SLA de resolución: i2 solamente (i1 cumplió)
  if v.fuera_sla_resol = 1 then
    raise notice 'PASS 3a: fuera de SLA resolución = 1 (v.fuera_sla_resol=%)', v.fuera_sla_resol;
  else
    raise notice 'FAIL 3a: fuera de SLA resolución = %', v.fuera_sla_resol;
  end if;

  -- promedio de resolución = (4 + 100) / 2 = 52.0
  if v.prom_horas_resolucion = 52.0 then
    raise notice 'PASS 3b: promedio de resolución = 52.0 h', v.prom_horas_resolucion;
  else
    raise notice 'FAIL 3b: promedio de resolución = % (esperado 52.0)', v.prom_horas_resolucion;
  end if;

  -- serie servicio_atencion no explota sin servicios
  if (select count(*) from public.series_analiticas('servicio_atencion', null, null,
      (select current_setting('app.test_sede')::uuid), null, null, null, null)) >= 0 then
    raise notice 'PASS 3c: serie servicio_atencion ejecuta sin error';
  else
    raise notice 'FAIL 3c: serie servicio_atencion';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PRUEBA 4 · PERMISOS: usuario SIN rol/permiso NO puede consultar
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub',
    (select p.id from public.perfiles p
     where p.correo = 'test-sin-rol-reportes@example.com')::text,
    'role', 'authenticated')::text,
  false);

do $$
declare
  v_ok boolean := false;
begin
  begin
    perform * from public.indicadores_analiticos(null, null, null, null, null, null, null);
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if not v_ok then
    raise notice 'PASS 4: usuario sin permisos recibe excepción (autorización en BD)';
  else
    raise notice 'FAIL 4: usuario sin permisos pudo consultar indicadores';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PRUEBA 5 · RLS EN REPORTE_DETALLE: el DUEÑO ve sus filas (security invoker)
-- ----------------------------------------------------------------------------
do $$
declare
  v_cuenta int;
begin
  begin
    select count(*) into v_cuenta
    from public.reporte_detalle(
      null, null,
      (select current_setting('app.test_sede')::uuid),
      null, null, null, null, 500, 0
    );
    -- El dueño (perfil sin rol) ve SOLO sus 3 incidencias TEST
    if v_cuenta = 3 then
      raise notice 'PASS 5: reporte_detalle respeta RLS del dueño (filas=%)', v_cuenta;
    else
      raise notice 'FAIL 5: reporte_detalle devolvió % filas (esperado 3)', v_cuenta;
    end if;
  exception when insufficient_privilege then
    raise notice 'FAIL 5: reporte_detalle bloqueado por RLS (el dueño debería ver las suyas)';
  end;
end $$;

-- ----------------------------------------------------------------------------
-- PRUEBA 6 · SIN DATOS: filtros imposibles devuelven ceros, no error
-- ----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub',
    (select current_setting('app.test_admin_id')::uuid)::text,
    'role', 'authenticated')::text,
  false);

do $$
declare
  v record;
begin
  select * into v from public.indicadores_analiticos(
    '2099-01-01', '2099-12-31', null, null, null, null, null
  );
  if v.total = 0 then
    raise notice 'PASS 6a: rango sin datos devuelve total=0 (estado vacío en UI)';
  else
    raise notice 'FAIL 6a: rango sin datos devolvió total=%', v.total;
  end if;

  if (select count(*) from public.series_analiticas('ambiente', '2099-01-01',
      '2099-12-31', null, null, null, null, null)) = 0 then
    raise notice 'PASS 6b: serie sin datos devuelve 0 filas (SinDatos en UI)';
  else
    raise notice 'FAIL 6b: serie sin datos debería devolver 0 filas';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PRUEBA 7 · SERIE DESCONOCIDA → excepción controlada
-- ----------------------------------------------------------------------------
do $$
declare
  v_ok boolean := false;
begin
  begin
    perform * from public.series_analiticas('no_existe', null, null, null, null, null, null, null);
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if not v_ok then
    raise notice 'PASS 7: serie desconocida lanza excepción (sin SQL dinámico)';
  else
    raise notice 'FAIL 7: serie desconocida no validada';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- LIMPIEZA (datos TEST de esta prueba)
-- ----------------------------------------------------------------------------
do $$
declare
  v_sede uuid := current_setting('app.test_sede')::uuid;
begin
  delete from public.sedes where id = v_sede;  -- cascada → pabellón/piso/ambiente
  delete from public.perfiles p using auth.users u
    where p.id = u.id
      and u.email in ('test-admin-reportes@example.com','test-sin-rol-reportes@example.com');
  delete from auth.users
    where email in ('test-admin-reportes@example.com','test-sin-rol-reportes@example.com');
  raise notice 'LIMPIEZA: datos TEST eliminados';
end $$;
