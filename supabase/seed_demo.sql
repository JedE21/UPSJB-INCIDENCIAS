-- ============================================================================
-- SIR-UPSJB · supabase/seed_demo.sql
-- DATOS DEMO —Suite completa— · ~6.500 registros en total
-- ============================================================================
-- REQUISITOS:
--   · Tener aplicadas las migraciones 0001–0020 (aplicar_migraciones_supabase.sql).
--   · Ejecutar en Supabase Dashboard → SQL Editor (rol postgres, bypass RLS).
--   · Idempotente: se puede re-ejecutar sin duplicar filas.
--
-- QUÉ CREA:
--   · 12 usuarios demo en Supabase Auth (contraseña: Demo1234!) con roles.
--   · Infraestructura: 1 sede, 3 pabellones, 9 pisos, ~32 ambientes + QR fijo.
--   · ~112 equipos con ubicación y movimientos.
--   · Organización: 5 áreas, 12 servicios, 3 turnos, 6 técnicos, 1 coordinador.
--   · 530 incidencias (2024–2026) en todos los estados + derivaciones,
--     asignaciones, historial, comentarios, SLA, encuestas y lecturas QR.
--   · Reglas de derivación automática (tipo → área).
--
-- LOS TRIGGERS DE PRODUCCIÓN SIGUEN VIVOS:
--   · El código INC-<AAAA>-<NNNNNN> se emite con la secuencia real (los
--     históricos 2024/2025 usan códigos fijos 100001–100420 para no alterar
--     la secuencia del año en curso; los activos 2026 usan 300001–300110).
--   · Notificaciones, historial CREAR/asignación/derivación y auditoría se
--     generan solos por triggers; SLA vía RPC oficial registrar_sla_incidencia.
--
-- USUARIOS DEMO (contraseña para TODOS: Demo1234!):
--   admin@demo.upsjb.edu.pe         ADMINISTRADOR
--   coordinador@demo.upsjb.edu.pe   COORDINADOR (Soporte + Redes, Ica)
--   tecnico1@demo.upsjb.edu.pe … 6  TECNICO
--   docente@demo.upsjb.edu.pe       DOCENTE
--   estudiante@demo.upsjb.edu.pe    ESTUDIANTE
--   administrativo@demo.upsjb.edu.pe ADMINISTRATIVO
-- ============================================================================

-- ############################################################################
-- 0. PRE-CHECK: catálogos base presentes (migraciones aplicadas)
-- ############################################################################
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_estados int; v_tipos int; v_canales int; v_prioridades int; v_roles int;
  v_cats int; v_marcas int;
begin
  select count(*) into v_estados     from public.estados_incidencia
   where nombre in ('Pendiente','Asignada','En proceso','En espera','Resuelta','Derivada');
  select count(*) into v_tipos       from public.tipos_incidencia;
  select count(*) into v_canales     from public.canales_reporte;
  select count(*) into v_prioridades from public.prioridades;
  select count(*) into v_roles       from public.roles
   where nombre in ('ADMINISTRADOR','COORDINADOR','TECNICO','DOCENTE','ESTUDIANTE','ADMINISTRATIVO');
  select count(*) into v_cats        from public.categorias_equipos
   where nombre in ('Computadora','Laptop','Monitor','Impresora','Proyector');
  select count(*) into v_marcas      from public.marcas_equipos
   where nombre in ('HP','Dell','Lenovo','Epson','Cisco','TP-Link');

  if v_estados < 6 or v_tipos < 9 or v_canales < 6 or v_prioridades < 4 or v_roles < 6
     or v_cats < 5 or v_marcas < 6 then
    raise exception
      'Faltan catálogos base (estados=% tipos=% canales=% prioridades=% roles=% cats=% marcas=%). Ejecuta primero las migraciones 0001–0020.',
      v_estados, v_tipos, v_canales, v_prioridades, v_roles, v_cats, v_marcas;
  end if;
end $$;

-- ############################################################################
-- 1. USUARIOS DEMO en Supabase Auth (12) — password Demo1234! (bcrypt)
--    El trigger on_auth_user_created → register_new_user crea el perfil 1:1
--    con rol base ESTUDIANTE + preferencias de notificación.
-- ############################################################################
-- Alta de los que falten (sin ON CONFLICT: el índice único de email puede
-- ser funcional según la versión del schema de Auth).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  v.id::uuid, 'authenticated', 'authenticated', v.correo,
  crypt('Demo1234!', gen_salt('bf', 10)),
  now(),
  jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
  jsonb_build_object('nombres', v.nombres, 'apellido_paterno', v.ap),
  now(), now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001', 'admin@demo.upsjb.edu.pe',          'Ana',      'Ramírez', 'ADMINISTRADOR'),
  ('d0000000-0000-4000-8000-000000000002', 'coordinador@demo.upsjb.edu.pe',    'Carlos',   'Vega',    'COORDINADOR'),
  ('d0000000-0000-4000-8000-000000000003', 'tecnico1@demo.upsjb.edu.pe',       'Luis',     'Quispe',  'TECNICO'),
  ('d0000000-0000-4000-8000-000000000004', 'tecnico2@demo.upsjb.edu.pe',       'María',    'Flores',  'TECNICO'),
  ('d0000000-0000-4000-8000-000000000005', 'tecnico3@demo.upsjb.edu.pe',       'Jorge',    'Salas',   'TECNICO'),
  ('d0000000-0000-4000-8000-000000000006', 'tecnico4@demo.upsjb.edu.pe',       'Rosa',     'Mendoza', 'TECNICO'),
  ('d0000000-0000-4000-8000-000000000007', 'tecnico5@demo.upsjb.edu.pe',       'Pedro',    'Castro',  'TECNICO'),
  ('d0000000-0000-4000-8000-000000000008', 'tecnico6@demo.upsjb.edu.pe',       'Elena',    'Rojas',   'TECNICO'),
  ('d0000000-0000-4000-8000-000000000009', 'docente@demo.upsjb.edu.pe',        'Gloria',   'Huanca',  'DOCENTE'),
  ('d0000000-0000-4000-8000-00000000000a', 'estudiante@demo.upsjb.edu.pe',     'Diego',    'Torres',  'ESTUDIANTE'),
  ('d0000000-0000-4000-8000-00000000000b', 'administrativo@demo.upsjb.edu.pe', 'Sonia',    'Paredes', 'ADMINISTRATIVO'),
  ('d0000000-0000-4000-8000-00000000000c', 'docente2@demo.upsjb.edu.pe',       'Miguel',   'Ccahuana','DOCENTE')
) as v(id, correo, nombres, ap, rol)
where not exists (
  select 1 from auth.users u where u.email = v.correo
);

-- Si ya existían: repone contraseña demo y nombres (idempotente).
update auth.users u
set encrypted_password = crypt('Demo1234!', gen_salt('bf', 10)),
    raw_user_meta_data = jsonb_build_object('nombres', v.nombres, 'apellido_paterno', v.ap),
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    updated_at         = now()
from (values
  ('admin@demo.upsjb.edu.pe',          'Ana',      'Ramírez'),
  ('coordinador@demo.upsjb.edu.pe',    'Carlos',   'Vega'),
  ('tecnico1@demo.upsjb.edu.pe',       'Luis',     'Quispe'),
  ('tecnico2@demo.upsjb.edu.pe',       'María',    'Flores'),
  ('tecnico3@demo.upsjb.edu.pe',       'Jorge',    'Salas'),
  ('tecnico4@demo.upsjb.edu.pe',       'Rosa',     'Mendoza'),
  ('tecnico5@demo.upsjb.edu.pe',       'Pedro',    'Castro'),
  ('tecnico6@demo.upsjb.edu.pe',       'Elena',    'Rojas'),
  ('docente@demo.upsjb.edu.pe',        'Gloria',   'Huanca'),
  ('estudiante@demo.upsjb.edu.pe',     'Diego',    'Torres'),
  ('administrativo@demo.upsjb.edu.pe', 'Sonia',    'Paredes'),
  ('docente2@demo.upsjb.edu.pe',       'Miguel',   'Ccahuana')
) as v(correo, nombres, ap)
where u.email = v.correo;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select v.id::text, v.id, jsonb_build_object('sub', v.id::text), 'email', now(), now(), now()
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid),
  ('d0000000-0000-4000-8000-000000000002'::uuid),
  ('d0000000-0000-4000-8000-000000000003'::uuid),
  ('d0000000-0000-4000-8000-000000000004'::uuid),
  ('d0000000-0000-4000-8000-000000000005'::uuid),
  ('d0000000-0000-4000-8000-000000000006'::uuid),
  ('d0000000-0000-4000-8000-000000000007'::uuid),
  ('d0000000-0000-4000-8000-000000000008'::uuid),
  ('d0000000-0000-4000-8000-000000000009'::uuid),
  ('d0000000-0000-4000-8000-00000000000a'::uuid),
  ('d0000000-0000-4000-8000-00000000000b'::uuid),
  ('d0000000-0000-4000-8000-00000000000c'::uuid)
) as v(id)
where not exists (
  select 1 from auth.identities i where i.provider = 'email' and i.user_id = v.id
);

-- Red de seguridad: si algún correo ya existía con OTRO id, crea su perfil.
insert into public.perfiles (id, correo, nombres, apellido_paterno)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'nombres', 'Demo'),
       coalesce(u.raw_user_meta_data ->> 'apellido_paterno', '')
from auth.users u
where u.email like '%@demo.upsjb.edu.pe'
  and not exists (select 1 from public.perfiles p where p.id = u.id);

-- Datos adicionales de perfiles demo
update public.perfiles p set
  apellido_materno = v.am,
  telefono         = v.tel,
  documento        = v.doc,
  codigo_usuario   = v.cod
from (values
  ('admin@demo.upsjb.edu.pe',          'Sánchez', '999000001', '80000001', 'U-ADM-001'),
  ('coordinador@demo.upsjb.edu.pe',    'Luna',    '999000002', '80000002', 'U-COR-001'),
  ('tecnico1@demo.upsjb.edu.pe',       'Mamani',  '999000003', '80000003', 'U-TEC-001'),
  ('tecnico2@demo.upsjb.edu.pe',       'Chávez',  '999000004', '80000004', 'U-TEC-002'),
  ('tecnico3@demo.upsjb.edu.pe',       'Ríos',    '999000005', '80000005', 'U-TEC-003'),
  ('tecnico4@demo.upsjb.edu.pe',       'Peralta', '999000006', '80000006', 'U-TEC-004'),
  ('tecnico5@demo.upsjb.edu.pe',       'Ñahui',   '999000007', '80000007', 'U-TEC-005'),
  ('tecnico6@demo.upsjb.edu.pe',       'Aguilar', '999000008', '80000008', 'U-TEC-006'),
  ('docente@demo.upsjb.edu.pe',        'Cárdenas','999000009', '80000009', 'U-DOC-001'),
  ('estudiante@demo.upsjb.edu.pe',     'Vilca',   '999000010', '80000010', 'U-EST-001'),
  ('administrativo@demo.upsjb.edu.pe', 'Ochoa',   '999000011', '80000011', 'U-ADM-002'),
  ('docente2@demo.upsjb.edu.pe',       'Barrera', '999000012', '80000012', 'U-DOC-002')
) as v(correo, am, tel, doc, cod)
where p.correo = v.correo;

-- ############################################################################
-- 2. ROLES de los usuarios demo + sincronización a auth (0010):
--    sincronizar_roles_auth persiste los roles desde usuarios_roles hacia
--    app_metadata. IMPORTANTE: para que el JWT lleve el claim `roles` (y RLS
--    funcione) debe estar configurado el Custom Access Token Hook (migración
--    0010, Dashboard → Authentication → Hooks). Sin el hook el login funciona
--    pero los paneles por rol quedan vacíos — igual que con usuarios reales.
-- ############################################################################
insert into public.usuarios_roles (perfil_id, rol_id)
select p.id, r.id
from public.perfiles p
join (values
  ('admin@demo.upsjb.edu.pe',          'ADMINISTRADOR'),
  ('coordinador@demo.upsjb.edu.pe',    'COORDINADOR'),
  ('tecnico1@demo.upsjb.edu.pe',       'TECNICO'),
  ('tecnico2@demo.upsjb.edu.pe',       'TECNICO'),
  ('tecnico3@demo.upsjb.edu.pe',       'TECNICO'),
  ('tecnico4@demo.upsjb.edu.pe',       'TECNICO'),
  ('tecnico5@demo.upsjb.edu.pe',       'TECNICO'),
  ('tecnico6@demo.upsjb.edu.pe',       'TECNICO'),
  ('docente@demo.upsjb.edu.pe',        'DOCENTE'),
  ('estudiante@demo.upsjb.edu.pe',     'ESTUDIANTE'),
  ('administrativo@demo.upsjb.edu.pe', 'ADMINISTRATIVO'),
  ('docente2@demo.upsjb.edu.pe',       'DOCENTE')
) as v(correo, rol) on v.correo = p.correo::text
join public.roles r on r.nombre = v.rol
on conflict do nothing;

do $$
declare
  u record;
begin
  for u in
    select p.id, p.correo::text as correo
    from public.perfiles p
    where p.correo::text like '%@demo.upsjb.edu.pe'
  loop
    perform public.sincronizar_roles_auth(u.id);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Helper de QR demo: código FIJO determinístico por ambiente (idempotente).
-- Respetan la Regla 9 vía deshabilitación previa (como datos_ambiente_b401.sql).
-- ----------------------------------------------------------------------------
create or replace function public.__demo_qr(p_ambiente uuid, p_codigo text)
returns void
language plpgsql
as $$
begin
  update public.codigos_qr
     set activo = false, deshabilitado_en = now()
   where ambiente_id = p_ambiente
     and activo
     and codigo <> p_codigo;

  insert into public.codigos_qr (ambiente_id, codigo, url_destino, activo)
  select p_ambiente, p_codigo, '/r/' || p_codigo, true
  on conflict (codigo) do nothing;

  update public.codigos_qr
     set activo = true, deshabilitado_en = null
   where codigo = p_codigo and activo = false;
end;
$$;

revoke all on function public.__demo_qr(uuid, text) from public, anon, authenticated;

-- ############################################################################
-- 3. INFRAESTRUCTURA: sede, pabellones, pisos, ambientes + QR fijo
-- ############################################################################
insert into public.sedes (nombre, codigo, direccion, activa)
select 'UPSJB — Filial Ica', 'ICA', 'Ica, Perú', true
where not exists (select 1 from public.sedes)
on conflict (codigo) do update set activa = true;

update public.sedes set activa = true
where id = (select id from public.sedes order by creado_en limit 1);

insert into public.pabellones (sede_id, nombre, codigo, activo)
select s.id, v.nombre, v.codigo, true
from public.sedes s
cross join (values ('Pabellón A','A'), ('Pabellón B','B'), ('Pabellón C','C')) as v(nombre, codigo)
where s.id = (select id from public.sedes order by creado_en limit 1)
on conflict (sede_id, codigo) do nothing;

insert into public.pisos (pabellon_id, numero, nombre)
select p.id, v.num, 'Piso ' || v.num
from public.pabellones p
cross join (values (1),(2),(3),(4)) as v(num)
where p.codigo in ('A','B') and v.num <= case when p.codigo = 'B' then 4 else 3 end
on conflict (pabellon_id, numero) do nothing;

insert into public.pisos (pabellon_id, numero, nombre)
select p.id, v.num, 'Piso ' || v.num
from public.pabellones p
cross join (values (1),(2)) as v(num)
where p.codigo = 'C'
on conflict (pabellon_id, numero) do nothing;

-- Ambientes + especializaciones + características + QR (determinísticos)
do $$
declare
  v_sede   uuid;
  rec      record;
  v_amb    uuid;
  v_tipo_a uuid; v_tipo_l uuid; v_tipo_o uuid; v_tipo_b uuid; v_tipo_u uuid;
  v_qr     text;
begin
  select id into v_sede from public.sedes order by creado_en limit 1;

  select id into v_tipo_a from public.tipos_ambiente where nombre = 'Aula';
  select id into v_tipo_l from public.tipos_ambiente where nombre = 'Laboratorio';
  select id into v_tipo_o from public.tipos_ambiente where nombre = 'Oficina';
  select id into v_tipo_b from public.tipos_ambiente where nombre = 'Biblioteca';
  select id into v_tipo_u from public.tipos_ambiente where nombre = 'Auditorio';

  for rec in
    select p.codigo as pab, pi.numero as piso
    from public.pisos pi
    join public.pabellones p on p.id = pi.pabellon_id
    where p.sede_id = v_sede and p.codigo in ('A','B','C')
    order by p.codigo, pi.numero
  loop
    -- Aulas (3 por piso en A y B)
    if rec.pab in ('A','B') then
      for k in 1..3 loop
        v_amb := null;
        select a.id into v_amb from public.ambientes a where a.codigo = format('ICA-%s-%s0%s', rec.pab, rec.piso, k);
        if v_amb is null then
          insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, detalle_ubicacion, activo)
          values (
            (select pi.id from public.pisos pi join public.pabellones p on p.id = pi.pabellon_id
              where p.codigo = rec.pab and pi.numero = rec.piso),
            v_tipo_a,
            format('Aula %s-%s0%s', rec.pab, rec.piso, k),
            format('ICA-%s-%s0%s', rec.pab, rec.piso, k),
            format('Pabellón %s · Piso %s', rec.pab, rec.piso), true
          )
          returning id into v_amb;
        end if;

        insert into public.aulas (ambiente_id, capacidad, tiene_computadoras)
        values (v_amb, 28 + (k % 3) * 2, rec.pab = 'B')
        on conflict (ambiente_id) do nothing;

        insert into public.ambientes_caracteristicas
          (ambiente_id, capacidad, proyector, computadoras, internet, aire_acondicionado, pizarra)
        values (v_amb, 30, rec.piso >= 2, case when rec.pab = 'B' then 1 else 0 end, true, rec.piso >= 3, true)
        on conflict (ambiente_id) do nothing;

        perform public.__demo_qr(v_amb, format('ICA-%s-%s0%s-0001', rec.pab, rec.piso, k));
      end loop;
    end if;

    -- Laboratorio en pabellón B
    if rec.pab = 'B' then
      v_amb := null;
      select a.id into v_amb from public.ambientes a where a.codigo = format('ICA-B-%sL', rec.piso);
      if v_amb is null then
        insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, detalle_ubicacion, activo)
        values (
          (select pi.id from public.pisos pi join public.pabellones p on p.id = pi.pabellon_id
            where p.codigo = 'B' and pi.numero = rec.piso),
          v_tipo_l, format('Laboratorio B-L%s', rec.piso), format('ICA-B-%sL', rec.piso),
          format('Pabellón B · Piso %s', rec.piso), true
        )
        returning id into v_amb;
      end if;

      insert into public.laboratorios (ambiente_id, capacidad, tipo_laboratorio)
      values (v_amb, 24, 'Cómputo')
      on conflict (ambiente_id) do nothing;

      insert into public.ambientes_caracteristicas
        (ambiente_id, capacidad, proyector, computadoras, internet, aire_acondicionado, pizarra)
      values (v_amb, 24, true, 24, true, true, false)
      on conflict (ambiente_id) do nothing;

      perform public.__demo_qr(v_amb, format('ICA-B-%sL-0001', rec.piso));
    end if;

    -- Oficinas en pabellón A
    if rec.pab = 'A' then
      v_amb := null;
      select a.id into v_amb from public.ambientes a where a.codigo = format('ICA-A-%sOF', rec.piso);
      if v_amb is null then
        insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, detalle_ubicacion, activo)
        values (
          (select pi.id from public.pisos pi join public.pabellones p on p.id = pi.pabellon_id
            where p.codigo = 'A' and pi.numero = rec.piso),
          v_tipo_o, format('Oficina A-OF%s', rec.piso), format('ICA-A-%sOF', rec.piso),
          format('Pabellón A · Piso %s', rec.piso), true
        )
        returning id into v_amb;
      end if;

      insert into public.ambientes_caracteristicas
        (ambiente_id, capacidad, proyector, computadoras, internet, aire_acondicionado, pizarra)
      values (v_amb, 4, false, 2, true, true, false)
      on conflict (ambiente_id) do nothing;

      perform public.__demo_qr(v_amb, format('ICA-A-%sOF-0001', rec.piso));
    end if;

    -- Biblioteca y Auditorío en pabellón C
    if rec.pab = 'C' then
      v_amb := null;
      select a.id into v_amb from public.ambientes a where a.codigo = format('ICA-C-%sBIB', rec.piso);
      if v_amb is null then
        insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, detalle_ubicacion, activo)
        values (
          (select pi.id from public.pisos pi join public.pabellones p on p.id = pi.pabellon_id
            where p.codigo = 'C' and pi.numero = rec.piso),
          v_tipo_b, format('Biblioteca C-%s', rec.piso), format('ICA-C-%sBIB', rec.piso),
          format('Pabellón C · Piso %s', rec.piso), true
        )
        returning id into v_amb;
      end if;

      insert into public.ambientes_caracteristicas
        (ambiente_id, capacidad, proyector, computadoras, internet, aire_acondicionado, pizarra)
      values (v_amb, 40, false, 8, true, true, false)
      on conflict (ambiente_id) do nothing;

      perform public.__demo_qr(v_amb, format('ICA-C-%sBIB-0001', rec.piso));

      v_amb := null;
      select a.id into v_amb from public.ambientes a where a.codigo = format('ICA-C-%sAUD', rec.piso);
      if v_amb is null then
        insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, detalle_ubicacion, activo)
        values (
          (select pi.id from public.pisos pi join public.pabellones p on p.id = pi.pabellon_id
            where p.codigo = 'C' and pi.numero = rec.piso),
          v_tipo_u, format('Auditorio C-%s', rec.piso), format('ICA-C-%sAUD', rec.piso),
          format('Pabellón C · Piso %s', rec.piso), true
        )
        returning id into v_amb;
      end if;

      insert into public.ambientes_caracteristicas
        (ambiente_id, capacidad, proyector, computadoras, internet, aire_acondicionado, pizarra)
      values (v_amb, 120, true, 2, true, true, true)
      on conflict (ambiente_id) do nothing;

      perform public.__demo_qr(v_amb, format('ICA-C-%sAUD-0001', rec.piso));
    end if;
  end loop;
end $$;

-- ############################################################################
-- 4. ORGANIZACIÓN: áreas, servicios, turnos, técnicos, cobertura coordinador
-- ############################################################################
insert into public.areas (nombre, descripcion, correo, activo) values
  ('Soporte Técnico',              'Atención de equipos y software',              'soporte@upsjb.edu.pe', true),
  ('Redes y Conectividad',         'Infraestructura de red e internet',           'redes@upsjb.edu.pe',   true),
  ('Infraestructura y Mantenimiento','Obra civil, electricidad y mobiliario',     'infra@upsjb.edu.pe',   true),
  ('Académica',                    'Gestión académica de laboratorios y aulas',   'academica@upsjb.edu.pe', true),
  ('Administración',               'Recursos humanos, logística y compras',       'admin@upsjb.edu.pe',   true)
on conflict (nombre) do nothing;

insert into public.servicios (area_id, nombre)
select a.id, v.nombre
from public.areas a
join (values
  ('Soporte Técnico','Mesa de ayuda'),
  ('Soporte Técnico','Mantenimiento de equipos'),
  ('Redes y Conectividad','Conectividad WiFi'),
  ('Redes y Conectividad','Cableado estructurado'),
  ('Infraestructura y Mantenimiento','Electricidad'),
  ('Infraestructura y Mantenimiento','Climatización'),
  ('Infraestructura y Mantenimiento','Mobiliario'),
  ('Académica','Laboratorios'),
  ('Académica','Aulas'),
  ('Administración','Logística'),
  ('Administración','Recursos humanos'),
  ('Administración','Compras')
) as v(area, nombre) on v.area = a.nombre
on conflict (area_id, nombre) do nothing;

insert into public.turnos (nombre, hora_inicio, hora_fin, dias_semana) values
  ('Mañana', '08:00', '13:00', '{1,2,3,4,5}'),
  ('Tarde',  '13:00', '18:00', '{1,2,3,4,5,6}'),
  ('Noche',  '18:00', '22:00', '{1,2,3,4,5}')
on conflict (nombre) do nothing;

insert into public.tecnicos (perfil_id, area_id, sede_id, codigo_tecnico, carga_maxima, activo)
select p.id, a.id, s.id, v.codigo, v.carga, true
from (values
  ('tecnico1@demo.upsjb.edu.pe','Soporte Técnico',              'TEC-001', 10),
  ('tecnico2@demo.upsjb.edu.pe','Soporte Técnico',              'TEC-002', 10),
  ('tecnico3@demo.upsjb.edu.pe','Soporte Técnico',              'TEC-003',  8),
  ('tecnico4@demo.upsjb.edu.pe','Redes y Conectividad',         'TEC-004', 10),
  ('tecnico5@demo.upsjb.edu.pe','Infraestructura y Mantenimiento','TEC-005', 12),
  ('tecnico6@demo.upsjb.edu.pe','Soporte Técnico',              'TEC-006',  8)
) as v(correo, area, codigo, carga)
join public.perfiles p on p.correo::text = v.correo
join public.areas a    on a.nombre = v.area
join public.sedes s    on s.id = (select id from public.sedes order by creado_en limit 1)
on conflict do nothing;

insert into public.tecnicos_especialidades (tecnico_id, especialidad_id)
select t.id, e.id
from public.tecnicos t
join (values
  ('TEC-001','Soporte'), ('TEC-001','Hardware'),
  ('TEC-002','Software'),('TEC-002','Soporte'),
  ('TEC-003','Hardware'),('TEC-003','Software'),
  ('TEC-004','Redes'),
  ('TEC-005','Electricidad'), ('TEC-005','Infraestructura'),
  ('TEC-006','Soporte')
) as v(cod, esp) on v.cod = t.codigo_tecnico
join public.especialidades_tecnicas e on e.nombre = v.esp
on conflict do nothing;

insert into public.tecnicos_turnos (tecnico_id, turno_id)
select t.id, tu.id
from public.tecnicos t
join public.turnos tu on (t.codigo_tecnico like 'TEC-00%' and (
  (t.codigo_tecnico in ('TEC-001','TEC-003','TEC-005') and tu.nombre = 'Mañana') or
  (t.codigo_tecnico in ('TEC-002','TEC-004','TEC-006') and tu.nombre = 'Tarde')))
on conflict do nothing;

-- Cobertura del coordinador (tabla private; el rol COORDINADOR la usa en RLS)
insert into private.tecnico_area_admin (perfil_id, area_id, sede_id, rol)
select p.id, a.id, s.id, 'COORDINADOR'
from public.perfiles p
join public.areas a on a.nombre in ('Soporte Técnico', 'Redes y Conectividad')
join public.sedes s on s.id = (select id from public.sedes order by creado_en limit 1)
where p.correo::text = 'coordinador@demo.upsjb.edu.pe'
on conflict do nothing;

-- Reglas de derivación (tipo → área; las de subtipo evalúan primero)
insert into public.reglas_enrutamiento
  (nombre, tipo_incidencia_id, subtipo_incidencia_id, area_destino_id, servicio_destino_id, prioridad_orden, activa)
select v.nombre, t.id, s.id, a.id, sv.id, v.orden, true
from (values
  ('Auto — Técnica / PC no enciende',   'Técnica',       'Computadora no enciende', 'Soporte Técnico',               'Mantenimiento de equipos', 1),
  ('Auto — Conectividad / Internet',    'Conectividad',  'Internet lento',          'Redes y Conectividad',          'Conectividad WiFi',        2),
  ('Auto — Infraestructura / Luminaria','Infraestructura','Luminaria fundida',      'Infraestructura y Mantenimiento','Electricidad',             3),
  ('Auto — Mobiliario / Silla',         'Mobiliario',    'Silla dañada',            'Infraestructura y Mantenimiento','Mobiliario',               4),
  ('Auto — Técnica (tipo)',             'Técnica',       null,                      'Soporte Técnico',               'Mesa de ayuda',            11),
  ('Auto — Conectividad (tipo)',        'Conectividad',  null,                      'Redes y Conectividad',          null,                       12),
  ('Auto — Infraestructura (tipo)',     'Infraestructura',null,                     'Infraestructura y Mantenimiento',null,                      13),
  ('Auto — Mobiliario (tipo)',          'Mobiliario',    null,                      'Infraestructura y Mantenimiento','Mobiliario',               14)
) as v(nombre, tipo, subtipo, area, servicio, orden)
join public.tipos_incidencia t  on t.nombre = v.tipo
left join public.subtipos_incidencia s on s.nombre = v.subtipo
join public.areas a             on a.nombre = v.area
left join public.servicios sv   on sv.nombre = v.servicio
where not exists (
  select 1 from public.reglas_enrutamiento r
  where r.tipo_incidencia_id = t.id
    and r.subtipo_incidencia_id is not distinct from s.id
    and r.activa
);

-- ############################################################################
-- 5. EQUIPOS (~112) + ubicación activa + movimientos (trigger sincroniza)
-- ############################################################################
do $$
declare
  v_sede uuid;
  v_cat_c uuid; v_cat_l uuid; v_cat_m uuid; v_cat_i uuid; v_cat_ir uuid;
  v_cat_s uuid; v_cat_ap uuid; v_cat_p uuid;
  m_hp uuid; m_dell uuid; m_lenovo uuid; m_epson uuid; m_cisco uuid; m_tpl uuid;
  e_op uuid; e_mant uuid; e_rep uuid; e_baja uuid;
  v_mo_hp_pc uuid; v_mo_dell_pc uuid; v_mo_len_pc uuid;
  v_mo_hp_lt uuid; v_mo_dell_lt uuid; v_mo_len_lt uuid;
  v_mo_epson_l3 uuid; v_mo_epson_fx uuid; v_mo_cisco uuid; v_mo_tpl uuid; v_mo_epson_p uuid;
  v_cat uuid; v_marca uuid; v_modelo uuid; v_estado uuid;
  v_cod text; v_nom text; v_adq date;
  i int; j int;
  v_amb_ids uuid[]; v_amb_n int;
  v_eq uuid; v_amb_actual uuid; v_amb_nuevo uuid; v_admin uuid;
begin
  select id into v_sede from public.sedes order by creado_en limit 1;
  select id into v_admin from public.perfiles where correo::text = 'admin@demo.upsjb.edu.pe';

  select id into v_cat_c  from public.categorias_equipos where nombre = 'Computadora';
  select id into v_cat_l  from public.categorias_equipos where nombre = 'Laptop';
  select id into v_cat_m  from public.categorias_equipos where nombre = 'Monitor';
  select id into v_cat_i  from public.categorias_equipos where nombre = 'Impresora';
  select id into v_cat_ir from public.categorias_equipos where nombre = 'Impresora de red';
  select id into v_cat_s  from public.categorias_equipos where nombre = 'Switch';
  select id into v_cat_ap from public.categorias_equipos where nombre = 'Access Point';
  select id into v_cat_p  from public.categorias_equipos where nombre = 'Proyector';

  select id into m_hp from public.marcas_equipos where nombre = 'HP';
  select id into m_dell from public.marcas_equipos where nombre = 'Dell';
  select id into m_lenovo from public.marcas_equipos where nombre = 'Lenovo';
  select id into m_epson from public.marcas_equipos where nombre = 'Epson';
  select id into m_cisco from public.marcas_equipos where nombre = 'Cisco';
  select id into m_tpl from public.marcas_equipos where nombre = 'TP-Link';

  select id into e_op   from public.estados_equipos where nombre = 'Operativo';
  select id into e_mant from public.estados_equipos where nombre = 'En mantenimiento';
  select id into e_rep  from public.estados_equipos where nombre = 'En reparación';
  select id into e_baja from public.estados_equipos where nombre = 'Baja';

  insert into public.modelos_equipos (marca_id, nombre) values
    (m_hp,     'ProDesk 400 G5'),
    (m_hp,     'ProBook 440 G8'),
    (m_hp,     'LaserJet P1102'),
    (m_dell,   'OptiPlex 3070'),
    (m_dell,   'Latitude 3420'),
    (m_dell,   'UltraSharp E2216H'),
    (m_lenovo, 'ThinkCentre M720q'),
    (m_lenovo, 'IdeaPad 3'),
    (m_epson,  'L3110'),
    (m_epson,  'FX-2190'),
    (m_epson,  'PowerLite S41'),
    (m_cisco,  'Catalyst 2960'),
    (m_tpl,    'TL-WA901N')
  on conflict (marca_id, nombre) do nothing;

  select id into v_mo_hp_pc   from public.modelos_equipos where marca_id = m_hp and nombre = 'ProDesk 400 G5';
  select id into v_mo_dell_pc from public.modelos_equipos where marca_id = m_dell and nombre = 'OptiPlex 3070';
  select id into v_mo_len_pc  from public.modelos_equipos where marca_id = m_lenovo and nombre = 'ThinkCentre M720q';
  select id into v_mo_hp_lt   from public.modelos_equipos where marca_id = m_hp and nombre = 'ProBook 440 G8';
  select id into v_mo_dell_lt from public.modelos_equipos where marca_id = m_dell and nombre = 'Latitude 3420';
  select id into v_mo_len_lt  from public.modelos_equipos where marca_id = m_lenovo and nombre = 'IdeaPad 3';
  select id into v_mo_epson_l3 from public.modelos_equipos where marca_id = m_epson and nombre = 'L3110';
  select id into v_mo_epson_fx from public.modelos_equipos where marca_id = m_epson and nombre = 'FX-2190';
  select id into v_mo_cisco   from public.modelos_equipos where marca_id = m_cisco and nombre = 'Catalyst 2960';
  select id into v_mo_tpl     from public.modelos_equipos where marca_id = m_tpl and nombre = 'TL-WA901N';
  select id into v_mo_epson_p from public.modelos_equipos where marca_id = m_epson and nombre = 'PowerLite S41';

  select coalesce(array_agg(a.id order by a.codigo), '{}') into v_amb_ids
  from public.ambientes a
  join public.pisos pi on pi.id = a.piso_id
  join public.pabellones p on p.id = pi.pabellon_id
  where p.sede_id = v_sede;
  v_amb_n := coalesce(array_length(v_amb_ids, 1), 0);

  if v_amb_n = 0 then
    raise exception 'Seed demo: no hay ambientes disponibles (¿falló el bloque 3?)';
  end if;

  for i in 1..110 loop
    -- Determinar categoría / marca / modelo / estado / código
    if i <= 80 then
      v_cat := v_cat_c;
      j := 1 + (i % 3);
      if j = 1 then v_marca := m_hp; v_modelo := v_mo_hp_pc; v_nom := 'Computadora de escritorio HP';
      elsif j = 2 then v_marca := m_dell; v_modelo := v_mo_dell_pc; v_nom := 'Computadora de escritorio Dell';
      else v_marca := m_lenovo; v_modelo := v_mo_len_pc; v_nom := 'Computadora de escritorio Lenovo'; end if;
      v_cod := 'EQ-PC-' || lpad(i::text, 4, '0');
    elsif i <= 90 then
      v_cat := v_cat_l; j := 1 + (i % 3);
      if j = 1 then v_marca := m_hp; v_modelo := v_mo_hp_lt;
      elsif j = 2 then v_marca := m_dell; v_modelo := v_mo_dell_lt;
      else v_marca := m_lenovo; v_modelo := v_mo_len_lt; end if;
      v_cod := 'EQ-LT-' || lpad((i - 80)::text, 4, '0');
    elsif i <= 100 then
      v_cat := v_cat_m; v_marca := m_dell; v_modelo := null;
      v_cod := 'EQ-MO-' || lpad((i - 90)::text, 4, '0');
    elsif i <= 103 then
      v_cat := v_cat_i; v_marca := m_epson; v_modelo := v_mo_epson_l3;
      v_cod := 'EQ-IM-' || lpad((i - 100)::text, 4, '0');
    elsif i <= 105 then
      v_cat := v_cat_ir; v_marca := m_epson; v_modelo := v_mo_epson_fx;
      v_cod := 'EQ-IR-' || lpad((i - 103)::text, 4, '0');
    elsif i <= 107 then
      v_cat := v_cat_s; v_marca := m_cisco; v_modelo := v_mo_cisco;
      v_cod := 'EQ-SW-' || lpad((i - 105)::text, 4, '0');
    elsif i <= 109 then
      v_cat := v_cat_ap; v_marca := m_tpl; v_modelo := v_mo_tpl;
      v_cod := 'EQ-AP-' || lpad((i - 107)::text, 4, '0');
    else
      v_cat := v_cat_p; v_marca := m_epson; v_modelo := v_mo_epson_p;
      v_cod := 'EQ-PR-' || lpad((i - 109)::text, 4, '0');
    end if;

    if i % 9 = 0 then v_estado := e_mant;
    elsif i % 23 = 0 then v_estado := e_rep;
    elsif i % 37 = 0 then v_estado := e_baja;
    else v_estado := e_op; end if;

    v_adq := date '2019-01-01' + ((i * 37) % 2000);

    insert into public.equipos
      (codigo_interno, numero_serie, categoria_id, modelo_id, estado_id,
       fecha_adquisicion, garantia_hasta, observaciones)
    values
      (v_cod,
       case when v_cat = v_cat_p then null else 'SN-' || v_cod end,
       v_cat, v_modelo, v_estado,
       v_adq,
       case when i % 3 = 0 then v_adq + 1095 else null end,
       null)
    on conflict (codigo_interno) do nothing;

    select id into v_eq from public.equipos where codigo_interno = v_cod;

    -- Ubicación activa (el trigger abre el movimiento 'asignacion')
    insert into public.equipos_ambientes (equipo_id, ambiente_id, activa, asignado_por)
    values (v_eq, v_amb_ids[1 + ((i * 7) % v_amb_n)], true, v_admin)
    on conflict (equipo_id, ambiente_id) do nothing;
  end loop;

  -- 15 traslados posteriores (el trigger cierra la ubicación y el movimiento previo)
  for i in 1..15 loop
    select id into v_eq from public.equipos where codigo_interno = 'EQ-PC-' || lpad(i::text, 4, '0');
    select ea.ambiente_id into v_amb_actual
    from public.equipos_ambientes ea where ea.equipo_id = v_eq and ea.activa limit 1;
    v_amb_nuevo := v_amb_ids[1 + ((i * 11 + 3) % v_amb_n)];
    if v_amb_nuevo is distinct from v_amb_actual then
      insert into public.equipos_ambientes (equipo_id, ambiente_id, activa, asignado_por)
      values (v_eq, v_amb_nuevo, true, v_admin)
      on conflict (equipo_id, ambiente_id) do nothing;
    end if;
  end loop;
end $$;

-- ############################################################################
-- 6. INCIDENCIAS — parte A: 420 históricas RESUELTAS (2024–2026)
--    Códigos fijos INC-<AAAA>-1000NN para no consumir la secuencia del año.
--    Cada fila dispara: historial CREAR, notificación al reportante, y se le
--    agregan derivación + asignación + historial manual + SLA (RPC oficial).
-- ############################################################################
do $$
declare
  v_admin uuid;
  v_ed_res uuid; v_ed_der uuid;
  v_pr_alta uuid; v_pr_crit uuid;
  v_c_web uuid; v_c_tel uuid;
  v_ar_sup uuid; v_ar_red uuid; v_ar_inf uuid;
  v_tec_sup uuid[]; v_tec_red uuid[]; v_tec_inf uuid[];
  v_amb_ids uuid[]; v_amb_cod text[]; v_amb_n int;
  v_rep uuid[];
  v_ti_tec uuid; v_ti_con uuid; v_ti_inf uuid; v_ti_mob uuid;
  v_sub_tec uuid[]; v_sub_tec_n text[];
  v_sub_con uuid[]; v_sub_con_n text[];
  v_sub_inf uuid[]; v_sub_inf_n text[];
  v_sub_mob uuid[]; v_sub_mob_n text[];
  v_i int; v_anio int; v_tipo uuid; v_tipo_nom text; v_sub uuid; v_sub_nom text;
  v_amb uuid; v_amb_codx text; v_rep_x uuid; v_fecha timestamptz;
  v_fa timestamptz; v_fi timestamptz; v_fr timestamptz;
  v_cod text; v_inc uuid; v_nuevo boolean;
  v_area uuid; v_tec uuid; v_mot text;
  v_pr uuid; v_canal uuid;
  v_eq uuid;
  v_res26 uuid[];
  c_rep constant text[] := array[
    'Se detectó la falla al iniciar la jornada.',
    'El equipo dejó de funcionar durante la clase.',
    'La falla se repite desde el día anterior.',
    'Afecta el desarrollo normal de la sesión.',
    'Fue reportado también por otros usuarios del ambiente.'];
begin
  select id into v_admin from public.perfiles where correo::text = 'admin@demo.upsjb.edu.pe';

  -- Simular sesión ADMIN (las RPC de SLA validan permisos por JWT)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.roles', '["ADMINISTRADOR"]', true);

  select id into v_ed_res from public.estados_incidencia where nombre = 'Resuelta';
  select id into v_ed_der from public.estados_incidencia where nombre = 'Derivada';
  select id into v_pr_alta from public.prioridades where nombre = 'Alta';
  select id into v_pr_crit from public.prioridades where nombre = 'Crítica';
  select id into v_c_web from public.canales_reporte where nombre = 'Web';
  select id into v_c_tel from public.canales_reporte where nombre = 'Teléfono';

  select id into v_ar_sup from public.areas where nombre = 'Soporte Técnico';
  select id into v_ar_red from public.areas where nombre = 'Redes y Conectividad';
  select id into v_ar_inf from public.areas where nombre = 'Infraestructura y Mantenimiento';

  select coalesce(array_agg(id order by codigo_tecnico), '{}') into v_tec_sup
  from public.tecnicos where area_id = v_ar_sup and activo;
  select coalesce(array_agg(id order by codigo_tecnico), '{}') into v_tec_red
  from public.tecnicos where area_id = v_ar_red and activo;
  select coalesce(array_agg(id order by codigo_tecnico), '{}') into v_tec_inf
  from public.tecnicos where area_id = v_ar_inf and activo;

  select array_agg(a.id order by a.codigo), array_agg(a.codigo order by a.codigo)
    into v_amb_ids, v_amb_cod
  from public.ambientes a
  join public.pisos pi on pi.id = a.piso_id
  join public.pabellones p on p.id = pi.pabellon_id
  where p.sede_id = (select id from public.sedes order by creado_en limit 1);
  v_amb_n := coalesce(array_length(v_amb_ids, 1), 0);

  select coalesce(array_agg(p.id order by p.correo), '{}') into v_rep
  from public.perfiles p
  where p.correo::text in ('docente@demo.upsjb.edu.pe','estudiante@demo.upsjb.edu.pe',
                           'administrativo@demo.upsjb.edu.pe','admin@demo.upsjb.edu.pe',
                           'coordinador@demo.upsjb.edu.pe','docente2@demo.upsjb.edu.pe');

  select id into v_ti_tec from public.tipos_incidencia where nombre = 'Técnica';
  select id into v_ti_con from public.tipos_incidencia where nombre = 'Conectividad';
  select id into v_ti_inf from public.tipos_incidencia where nombre = 'Infraestructura';
  select id into v_ti_mob from public.tipos_incidencia where nombre = 'Mobiliario';

  select coalesce(array_agg(s.id order by s.nombre), '{}'), coalesce(array_agg(s.nombre order by s.nombre), '{}')
    into v_sub_tec, v_sub_tec_n
  from public.subtipos_incidencia s where s.tipo_incidencia_id = v_ti_tec;
  select coalesce(array_agg(s.id order by s.nombre), '{}'), coalesce(array_agg(s.nombre order by s.nombre), '{}')
    into v_sub_con, v_sub_con_n
  from public.subtipos_incidencia s where s.tipo_incidencia_id = v_ti_con;
  select coalesce(array_agg(s.id order by s.nombre), '{}'), coalesce(array_agg(s.nombre order by s.nombre), '{}')
    into v_sub_inf, v_sub_inf_n
  from public.subtipos_incidencia s where s.tipo_incidencia_id = v_ti_inf;
  select coalesce(array_agg(s.id order by s.nombre), '{}'), coalesce(array_agg(s.nombre order by s.nombre), '{}')
    into v_sub_mob, v_sub_mob_n
  from public.subtipos_incidencia s where s.tipo_incidencia_id = v_ti_mob;

  for v_i in 1..420 loop
    v_anio := case when v_i % 3 = 0 then 2024 when v_i % 3 = 1 then 2025 else 2026 end;
    v_cod  := 'INC-' || v_anio || '-' || lpad((100000 + v_i)::text, 6, '0');

    select id into v_inc from public.incidencias where codigo = v_cod;
    v_nuevo := v_inc is null;

    if v_nuevo then
      -- Tipo/subtipo (siempre de tipos con regla → flujo completo)
      v_tipo_nom := (array['Técnica','Conectividad','Infraestructura','Mobiliario'])[1 + (v_i % 4)];
      v_tipo := case v_tipo_nom
        when 'Técnica' then v_ti_tec when 'Conectividad' then v_ti_con
        when 'Infraestructura' then v_ti_inf else v_ti_mob end;
      if v_i % 3 = 0 then
        case v_tipo_nom
          when 'Técnica' then
            v_sub := v_sub_tec[1 + (v_i % coalesce(array_length(v_sub_tec,1),1))];
            v_sub_nom := v_sub_tec_n[1 + (v_i % coalesce(array_length(v_sub_tec,1),1))];
          when 'Conectividad' then
            v_sub := v_sub_con[1 + (v_i % coalesce(array_length(v_sub_con,1),1))];
            v_sub_nom := v_sub_con_n[1 + (v_i % coalesce(array_length(v_sub_con,1),1))];
          when 'Infraestructura' then
            v_sub := v_sub_inf[1 + (v_i % coalesce(array_length(v_sub_inf,1),1))];
            v_sub_nom := v_sub_inf_n[1 + (v_i % coalesce(array_length(v_sub_inf,1),1))];
          else
            v_sub := v_sub_mob[1 + (v_i % coalesce(array_length(v_sub_mob,1),1))];
            v_sub_nom := v_sub_mob_n[1 + (v_i % coalesce(array_length(v_sub_mob,1),1))];
        end case;
      else
        v_sub := null; v_sub_nom := null;
      end if;

      v_amb := v_amb_ids[1 + (v_i % v_amb_n)];
      v_amb_codx := v_amb_cod[1 + (v_i % v_amb_n)];
      v_rep_x := v_rep[1 + (v_i % coalesce(array_length(v_rep,1),1))];

      v_fecha := (v_anio::text || '-03-01')::timestamptz
                 + ((v_i % 150) || ' days')::interval
                 + ((8 + v_i % 10) || ' hours')::interval;
      v_fa := v_fecha + interval '35 minutes';
      v_fi := v_fecha + ((1 + v_i % 4) || ' hours')::interval;
      v_fr := v_fi + ((6 + (v_i * 7) % 42) || ' hours')::interval;

      v_pr := case when v_i % 23 = 0 then v_pr_crit when v_i % 11 = 0 then v_pr_alta else null end;
      v_canal := case when v_i % 5 = 0 then v_c_web when v_i % 7 = 0 then v_c_tel else null end;

      insert into public.incidencias
        (codigo, usuario_reportante_id, ambiente_id, tipo_incidencia_id, subtipo_incidencia_id,
         prioridad_id, estado_id, canal_reporte_id, descripcion,
         fecha_reporte, fecha_asignacion, fecha_inicio, fecha_resolucion)
      values
        (v_cod, v_rep_x, v_amb, v_tipo, v_sub,
         v_pr, v_ed_res, v_canal,
         coalesce(v_sub_nom, v_tipo_nom) || ' reportada en ' || v_amb_codx || ': ' ||
           c_rep[1 + (v_i % 5)],
         v_fecha, v_fa, v_fi, v_fr)
      returning id into v_inc;

      -- Derivación inicial (según regla del tipo)
      v_area := case v_tipo_nom
        when 'Técnica' then v_ar_sup when 'Conectividad' then v_ar_red else v_ar_inf end;
      select r.nombre into v_mot
      from public.reglas_enrutamiento r
      where r.area_destino_id = v_area and r.tipo_incidencia_id = v_tipo
        and r.subtipo_incidencia_id is not distinct from v_sub and r.activa
      order by r.prioridad_orden limit 1;

      insert into public.incidencia_derivaciones
        (incidencia_id, area_origen_id, area_destino_id, motivo, activa)
      values (v_inc, null, v_area, 'Clasificación automática — regla: ' || coalesce(v_mot, v_tipo_nom), true);

      -- Asignación al técnico del área
      v_tec := case v_tipo_nom
        when 'Técnica' then v_tec_sup[1 + (v_i % coalesce(array_length(v_tec_sup,1),1))]
        when 'Conectividad' then v_tec_red[1 + (v_i % coalesce(array_length(v_tec_red,1),1))]
        else v_tec_inf[1 + (v_i % coalesce(array_length(v_tec_inf,1),1))] end;

      insert into public.incidencia_asignaciones
        (incidencia_id, tecnico_id, activa, asignado_en, aceptado_en)
      values (v_inc, v_tec, true, v_fa, v_fi - interval '10 minutes');

      -- Historial manual (el CREAR y el de asignación lo escriben triggers)
      insert into public.incidencia_historial
        (incidencia_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle, creado_en)
      values
        (v_inc, 'estado', 'estado', 'Asignada', 'En proceso',
         'CAMBIAR_ESTADO: Asignada → En proceso', v_fi),
        (v_inc, 'estado', 'estado', 'En proceso', 'Resuelta',
         'RESOLVER: incidencia marcada como Resuelta', v_fr);

      -- SLA con la RPC oficial (valida permisos; simulamos admin arriba)
      perform public.registrar_sla_incidencia(v_inc);

      -- Comentarios (reportante + técnico)
      if v_i % 2 = 0 then
        insert into public.incidencia_comentarios (incidencia_id, autor_id, comentario, creado_en)
        values (v_inc, v_rep_x,
          '¿Ya está programada la revisión? La falla sigue apareciendo.', v_fa + interval '2 hours');
      end if;
      insert into public.incidencia_comentarios (incidencia_id, autor_id, comentario, creado_en)
      values (v_inc, (select perfil_id from public.tecnicos where id = v_tec),
        'Se revisó el ambiente, se aplicó la corrección y el servicio quedó estable.', v_fr - interval '1 hour');

      -- Vínculo con equipo del ambiente (1 de cada 7)
      if v_i % 7 = 0 then
        select ea.equipo_id into v_eq
        from public.equipos_ambientes ea
        join public.equipos e on e.id = ea.equipo_id
        where ea.ambiente_id = v_amb and ea.activa and e.activo
        order by e.codigo_interno limit 1;
        if v_eq is not null then
          insert into public.incidencia_equipos (incidencia_id, equipo_id, es_equipo_principal, detalle)
          values (v_inc, v_eq, true, 'Equipo asociado al reporte')
          on conflict (incidencia_id, equipo_id) do nothing;
        end if;
      end if;

      if v_anio = 2026 then
        v_res26 := v_res26 || v_inc;
      end if;
    end if;
  end loop;

  -- Encuestas de cierre sobre 25 resueltas de 2026
  for v_i in 1..least(25, coalesce(array_length(v_res26,1), 0)) loop
    insert into public.encuestas_cierre (incidencia_id, token, enviada_en)
    select v_res26[v_i], 'demo-enc-' || lpad(v_i::text, 3, '0'), now() - (v_i || ' days')::interval
    where not exists (
      select 1 from public.encuestas_cierre where token = 'demo-enc-' || lpad(v_i::text, 3, '0'));

    insert into public.respuestas_encuesta (encuesta_id, calificacion, comentario, respondido_en)
    select ec.id, 3 + (v_i % 3),
      case v_i % 3
        when 0 then 'Atención rápida, quedé conforme.'
        when 1 then 'Buen servicio, aunque tardó un poco.'
        else 'Excelente atención del técnico.' end,
    ec.enviada_en + interval '1 day'
    from public.encuestas_cierre ec
    where ec.token = 'demo-enc-' || lpad(v_i::text, 3, '0')
    on conflict (encuesta_id) do nothing;
  end loop;
end $$;

-- ############################################################################
-- 7. INCIDENCIAS — parte B: 110 ACTIVAS de 2026 (códigos 300001–300110)
--    Pendiente 44 · Derivada 33 · Asignada 22 · En proceso 6 · En espera 5
--    Incluye tipos SIN regla (Limpieza, Seguridad, Académica…) que quedan
--    Pendientes: variety realista para coordinador/admin.
-- ############################################################################
do $$
declare
  v_admin uuid;
  v_ed_pend uuid; v_ed_asig uuid; v_ed_proc uuid; v_ed_esp uuid; v_ed_der uuid;
  v_pr_alta uuid; v_pr_crit uuid;
  v_c_web uuid; v_c_tel uuid;
  v_ti_todos uuid[]; v_ti_nombres text[]; v_ti_n int;
  v_amb_ids uuid[]; v_amb_cod text[]; v_amb_n int;
  v_rep uuid[];
  v_ar_sup uuid; v_ar_red uuid; v_ar_inf uuid;
  v_tec_sup uuid[]; v_tec_red uuid[]; v_tec_inf uuid[];
  v_i int; v_tipo uuid; v_tipo_nom text; v_sub uuid;
  v_amb uuid; v_amb_codx text; v_rep_x uuid; v_fecha timestamptz;
  v_cod text; v_inc uuid; v_nuevo boolean;
  v_area uuid; v_tec uuid; v_mot text;
  v_pr uuid; v_canal uuid; v_estado uuid;
  v_regla_ok boolean;
  c_rep constant text[] := array[
    'Se detectó la falla al iniciar la jornada.',
    'El equipo dejó de funcionar durante la clase.',
    'La falla se repite desde el día anterior.',
    'Afecta el desarrollo normal de la sesión.',
    'Fue reportado también por otros usuarios del ambiente.'];
begin
  select id into v_admin from public.perfiles where correo::text = 'admin@demo.upsjb.edu.pe';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.roles', '["ADMINISTRADOR"]', true);

  select id into v_ed_pend from public.estados_incidencia where nombre = 'Pendiente';
  select id into v_ed_asig from public.estados_incidencia where nombre = 'Asignada';
  select id into v_ed_proc from public.estados_incidencia where nombre = 'En proceso';
  select id into v_ed_esp  from public.estados_incidencia where nombre = 'En espera';
  select id into v_ed_der  from public.estados_incidencia where nombre = 'Derivada';
  select id into v_pr_alta from public.prioridades where nombre = 'Alta';
  select id into v_pr_crit from public.prioridades where nombre = 'Crítica';
  select id into v_c_web from public.canales_reporte where nombre = 'Web';
  select id into v_c_tel from public.canales_reporte where nombre = 'Teléfono';

  select array_agg(t.id order by t.nombre), array_agg(t.nombre order by t.nombre)
    into v_ti_todos, v_ti_nombres
  from public.tipos_incidencia t where t.activo;
  v_ti_n := coalesce(array_length(v_ti_todos, 1), 0);

  select array_agg(a.id order by a.codigo), array_agg(a.codigo order by a.codigo)
    into v_amb_ids, v_amb_cod
  from public.ambientes a
  join public.pisos pi on pi.id = a.piso_id
  join public.pabellones p on p.id = pi.pabellon_id
  where p.sede_id = (select id from public.sedes order by creado_en limit 1);
  v_amb_n := coalesce(array_length(v_amb_ids, 1), 0);

  select coalesce(array_agg(p.id order by p.correo), '{}') into v_rep
  from public.perfiles p
  where p.correo::text in ('docente@demo.upsjb.edu.pe','estudiante@demo.upsjb.edu.pe',
                           'administrativo@demo.upsjb.edu.pe','docente2@demo.upsjb.edu.pe');

  select id into v_ar_sup from public.areas where nombre = 'Soporte Técnico';
  select id into v_ar_red from public.areas where nombre = 'Redes y Conectividad';
  select id into v_ar_inf from public.areas where nombre = 'Infraestructura y Mantenimiento';
  select coalesce(array_agg(id order by codigo_tecnico), '{}') into v_tec_sup
  from public.tecnicos where area_id = v_ar_sup and activo;
  select coalesce(array_agg(id order by codigo_tecnico), '{}') into v_tec_red
  from public.tecnicos where area_id = v_ar_red and activo;
  select coalesce(array_agg(id order by codigo_tecnico), '{}') into v_tec_inf
  from public.tecnicos where area_id = v_ar_inf and activo;

  for v_i in 1..110 loop
    v_cod := 'INC-2026-' || lpad((300000 + v_i)::text, 6, '0');
    select id into v_inc from public.incidencias where codigo = v_cod;
    v_nuevo := v_inc is null;

    if v_nuevo then
      v_tipo := v_ti_todos[1 + (v_i % v_ti_n)];
      v_tipo_nom := v_ti_nombres[1 + (v_i % v_ti_n)];
      v_sub := null;
      if v_i % 2 = 0 then
        -- Subtipo COHERENTE con el tipo elegido (FK compuesta D12: el subtipo
        -- debe pertenecer al tipo de la incidencia).
        select s.id into v_sub
        from public.subtipos_incidencia s
        where s.tipo_incidencia_id = v_tipo and s.activo
        order by s.nombre
        limit 1
        offset (v_i / 2) % greatest((
          select count(*) from public.subtipos_incidencia x
          where x.tipo_incidencia_id = v_tipo and x.activo), 1);
      end if;

      v_amb := v_amb_ids[1 + (v_i % v_amb_n)];
      v_amb_codx := v_amb_cod[1 + (v_i % v_amb_n)];
      v_rep_x := v_rep[1 + (v_i % coalesce(array_length(v_rep,1),1))];
      v_fecha := now() - ((v_i % 27) || ' days')::interval - ((v_i % 9) || ' hours')::interval;

      v_pr := case when v_i % 17 = 0 then v_pr_crit when v_i % 13 = 0 then v_pr_alta else null end;
      v_canal := case when v_i % 6 = 0 then v_c_web when v_i % 11 = 0 then v_c_tel else null end;

      -- ¿El tipo tiene regla de derivación? (si no: queda Pendiente)
      select (r.id is not null) into v_regla_ok
      from public.reglas_enrutamiento r
      where r.activa and r.tipo_incidencia_id = v_tipo
        and r.subtipo_incidencia_id is not distinct from v_sub
      order by r.prioridad_orden limit 1;

      -- Estado destino según el patrón del índice
      if v_i % 10 in (0,1,2,3) then v_estado := v_ed_pend;
      elsif v_i % 10 in (4,5,6) then v_estado := case when v_regla_ok then v_ed_der else v_ed_pend end;
      elsif v_i % 10 in (7,8) then v_estado := case when v_regla_ok then v_ed_asig else v_ed_pend end;
      elsif v_i % 20 = 9 then v_estado := case when v_regla_ok then v_ed_proc else v_ed_pend end;
      else v_estado := case when v_regla_ok then v_ed_esp else v_ed_pend end;
      end if;

      insert into public.incidencias
        (codigo, usuario_reportante_id, ambiente_id, tipo_incidencia_id, subtipo_incidencia_id,
         prioridad_id, estado_id, canal_reporte_id, descripcion, fecha_reporte,
         fecha_asignacion, fecha_inicio)
      values
        (v_cod, v_rep_x, v_amb, v_tipo, v_sub, v_pr, v_estado, v_canal,
         coalesce((select s.nombre from public.subtipos_incidencia s where s.id = v_sub), v_tipo_nom)
           || ' reportada en ' || v_amb_codx || ': ' || c_rep[1 + (v_i % 5)],
         v_fecha,
         case when v_estado in (v_ed_asig, v_ed_proc, v_ed_esp) then v_fecha + interval '40 minutes' end,
         case when v_estado in (v_ed_proc, v_ed_esp) then v_fecha + interval '3 hours' end)
      returning id into v_inc;

      v_area := case v_tipo_nom
        when 'Técnica' then v_ar_sup
        when 'Conectividad' then v_ar_red
        when 'Infraestructura' then v_ar_inf
        when 'Mobiliario' then v_ar_inf
        else null end;

      if v_estado = v_ed_der or v_estado in (v_ed_asig, v_ed_proc, v_ed_esp) then
        -- Derivación activa con motivo de la regla
        select r.nombre into v_mot
        from public.reglas_enrutamiento r
        where r.activa and r.tipo_incidencia_id = v_tipo
          and r.subtipo_incidencia_id is not distinct from v_sub
        order by r.prioridad_orden limit 1;
        insert into public.incidencia_derivaciones
          (incidencia_id, area_origen_id, area_destino_id, motivo, activa)
        values (v_inc, null, v_area, 'Clasificación automática — regla: ' || coalesce(v_mot, v_tipo_nom), true);
      end if;

      if v_estado in (v_ed_asig, v_ed_proc, v_ed_esp) then
        v_tec := case v_area
          when v_ar_sup then v_tec_sup[1 + (v_i % coalesce(array_length(v_tec_sup,1),1))]
          when v_ar_red then v_tec_red[1 + (v_i % coalesce(array_length(v_tec_red,1),1))]
          else v_tec_inf[1 + (v_i % coalesce(array_length(v_tec_inf,1),1))] end;

        insert into public.incidencia_asignaciones
          (incidencia_id, tecnico_id, activa, asignado_en, aceptado_en)
        values (v_inc, v_tec, true, v_fecha + interval '40 minutes',
                case when v_estado in (v_ed_proc, v_ed_esp) then v_fecha + interval '2 hours' end);

        if v_estado = v_ed_esp then
          insert into public.incidencia_historial
            (incidencia_id, tipo_cambio, campo, valor_anterior, valor_nuevo, detalle, creado_en)
          values (v_inc, 'estado', 'estado', 'En proceso', 'En espera',
                  'CAMBIAR_ESTADO: En proceso → En espera', v_fecha + interval '3 hours');
        end if;

        perform public.registrar_sla_incidencia(v_inc);

        if v_i % 2 = 0 then
          insert into public.incidencia_comentarios (incidencia_id, autor_id, comentario, creado_en)
          values (v_inc, (select perfil_id from public.tecnicos where id = v_tec),
                  'Técnico asignado: se coordinará la visita al ambiente.', v_fecha + interval '1 hour');
        end if;
      elsif v_estado = v_ed_der and v_i % 2 = 0 then
        insert into public.incidencia_comentarios (incidencia_id, autor_id, comentario, creado_en)
        values (v_inc, v_rep_x, '¿Me pueden indicar cuándo lo revisarán? Gracias.', v_fecha + interval '2 hours');
      end if;
    end if;
  end loop;
end $$;

-- ############################################################################
-- 8. LECTURAS QR demo (60, anónimas y variadas)
-- ############################################################################
do $$
declare
  v_qrs text[] := array['ICA-B-101-0001','ICA-B-201-0001','ICA-B-3L-0001',
                        'ICA-A-1OF-0001','ICA-C-1BIB-0001','B401-0001'];
  v_qr uuid;
  v_i int;
begin
  for v_i in 1..60 loop
    select id into v_qr from public.codigos_qr
    where codigo = v_qrs[1 + (v_i % coalesce(array_length(v_qrs,1),1))];
    if v_qr is not null then
      insert into public.lecturas_qr (codigo_qr_id, dispositivo, navegador, leido_en)
      values (v_qr,
              (array['Android','iPhone','Windows','macOS'])[1 + v_i % 4],
              (array['Chrome','Safari','Firefox','Edge'])[1 + v_i % 4],
              now() - (v_i || ' days')::interval);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Limpieza de demo: marca como leídas las notificaciones de tickets históricos
-- (así la bandeja de los usuarios demo solo muestra las activas) y retira el
-- helper de QR.
-- ----------------------------------------------------------------------------
update public.notificaciones n
   set leida_en = now()
from public.incidencias i
where n.incidencia_id = i.id
  and i.codigo ~ '-1000'
  and n.leida_en is null;

drop function if exists public.__demo_qr(uuid, text);

-- ############################################################################
-- 9. VERIFICACIÓN FINAL (mensajes en la consola del SQL Editor)
-- ############################################################################
do $$
declare
  v_inc int; v_estados record; v_otras record;
begin
  select count(*) into v_inc from public.incidencias;

  raise notice '──────────────────────────────────────────────────────';
  raise notice 'SIR-UPSJB · Seed demo completado ✔  (idempotente)';
  raise notice 'Incidencias totales en la BD: %', v_inc;
  for v_estados in
    select e.nombre, count(*) as total
    from public.incidencias i join public.estados_incidencia e on e.id = i.estado_id
    group by e.nombre order by total desc
  loop
    raise notice '   · %-: %', rpad(v_estados.nombre, 12), v_estados.total;
  end loop;

  select
    (select count(*) from public.equipos)                          as equipos,
    (select count(*) from public.ambientes)                        as ambientes,
    (select count(*) from public.codigos_qr where activo)          as qrs,
    (select count(*) from public.tecnicos)                         as tecnicos,
    (select count(*) from public.incidencia_comentarios)           as comentarios,
    (select count(*) from public.incidencia_historial)             as historial,
    (select count(*) from public.tiempos_sla)                      as slas,
    (select count(*) from public.notificaciones)                   as notificaciones,
    (select count(*) from public.encuestas_cierre)                 as encuestas
  into v_otras;

  raise notice 'Equipos: % · Ambientes: % · QR activos: % · Técnicos: %',
    v_otras.equipos, v_otras.ambientes, v_otras.qrs, v_otras.tecnicos;
  raise notice 'Comentarios: % · Historial: % · SLA: % · Notificaciones: % · Encuestas: %',
    v_otras.comentarios, v_otras.historial, v_otras.slas, v_otras.notificaciones, v_otras.encuestas;
  raise notice '';
  raise notice 'Usuarios demo (contraseña para todos: Demo1234!):';
  raise notice '  admin@demo.upsjb.edu.pe          → ADMINISTRADOR';
  raise notice '  coordinador@demo.upsjb.edu.pe    → COORDINADOR';
  raise notice '  tecnico1..6@demo.upsjb.edu.pe    → TECNICO';
  raise notice '  docente@ / docente2@             → DOCENTE';
  raise notice '  estudiante@demo.upsjb.edu.pe     → ESTUDIANTE';
  raise notice '  administrativo@demo.upsjb.edu.pe → ADMINISTRATIVO';
  raise notice '──────────────────────────────────────────────────────';
end $$;

-- ============================================================================
-- CÓMO ELIMINAR LOS DATOS DEMO (opcional, ejecutar por bloques si hace falta):
--
--   delete from public.incidencias where codigo ~ 'INC-(2024|2025|2026)-[13]000';
--   delete from public.equipos where codigo_interno like 'EQ-%';
--   delete from public.lecturas_qr where leido_en > now() - interval '90 days';
--   delete from public.codigos_qr where codigo like 'ICA-%';
--   delete from public.ambientes a using public.pisos pi, public.pabellones p
--     where a.piso_id = pi.id and pi.pabellon_id = p.id
--       and p.sede_id = (select id from public.sedes order by creado_en limit 1)
--       and a.codigo like 'ICA-%';
--   delete from auth.users where email like '%@demo.upsjb.edu.pe';
--   delete from public.reglas_enrutamiento where nombre like 'Auto — %';
-- ============================================================================
