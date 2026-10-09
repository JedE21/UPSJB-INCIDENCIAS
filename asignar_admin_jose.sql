-- ============================================================================
-- SIR-UPSJB · asignar_admin_jose.sql
-- Asigna el rol ADMINISTRADOR al único usuario de Supabase:
--   joseeche21gd@gmail.com
--
-- QUÉ HACE:
--   1. Garantiza la fila en public.perfiles (trigger register_new_user la crea
--      al registrarse; esto solo cubre el caso de un user creado a mano).
--   2. Activa el perfil (estado = 'activo').
--   3. Inserta en public.usuarios_roles el rol ADMINISTRADOR (idempotente:
--      ON CONFLICT DO NOTHING; conserva los roles previos, la jerarquía de
--      0010 pone ADMINISTRADOR primero).
--   4. Ejecuta sincronizar_roles_auth(perfil_id) (migración 0010) para
--      persistir los roles en auth.users.raw_app_meta_data.roles → de ahí los
--      lee el frontend (lib/auth/session.ts y proxy.ts vía claim `roles`).
--
-- CÓMO EJECUTAR: Supabase Dashboard → SQL Editor (rol postgres, bypass RLS).
-- Después: cerrar sesión y volver a iniciar sesión en el frontend para que el
-- navegador reciba un JWT nuevo con el claim `roles`.
-- ============================================================================

-- Correo del usuario objetivo (cambiar aquí si se necesita otro).

do $$
declare
  v_auth_id uuid;
  v_rol     uuid;
  v_roles   text[];
begin
  -- 0. Localizar el usuario en auth.users (debe existir).
  select u.id into v_auth_id
    from auth.users u
   where u.email = 'joseeche21gd@gmail.com';

  if v_auth_id is null then
    raise exception 'No existe el usuario joseeche21gd@gmail.com en auth.users';
  end if;

  -- 1. Garantizar el perfil 1:1 (mismo UUID).
  insert into public.perfiles (id, nombres, apellido_paterno, apellido_materno, correo)
  values (v_auth_id, 'Jose', 'Eche', '', 'joseeche21gd@gmail.com')
  on conflict (id) do nothing;

  -- 2. Perfil activo (una cuenta suspendida no pasa los guards del panel).
  update public.perfiles
     set estado = 'activo', actualizado_en = now()
   where id = v_auth_id;

  -- 3. Asignar ADMINISTRADOR en usuarios_roles (fuente de verdad).
  select r.id into v_rol
    from public.roles r
   where r.nombre = 'ADMINISTRADOR';

  if v_rol is null then
    raise exception 'No existe el rol ADMINISTRADOR. Ejecuta antes la migración 0005_seed_catalogos.sql';
  end if;

  insert into public.usuarios_roles (perfil_id, rol_id)
  values (v_auth_id, v_rol)
  on conflict (perfil_id, rol_id) do nothing;

  -- 4. Sincronizar roles → auth.users.raw_app_meta_data.roles (claim del JWT).
  --    Ejecutado como postgres (sin JWT): la RPC lo permite para cualquier usuario.
  v_roles := public.sincronizar_roles_auth(v_auth_id);

  raise notice 'Usuario % → roles en JWT: %', 'joseeche21gd@gmail.com', v_roles;
end;
$$;

-- 5. Verificación rápida: roles efectivos y metadatos sincronizados.
select p.correo,
       p.estado,
       coalesce(array_agg(r.nombre order by r.nombre) filter (where r.nombre is not null), '{}') as roles_bd,
       a.raw_app_meta_data -> 'roles' as roles_jwt
  from auth.users a
  join public.perfiles p on p.id = a.id
  left join public.usuarios_roles ur on ur.perfil_id = p.id
  left join public.roles r on r.id = ur.rol_id
 where a.email = 'joseeche21gd@gmail.com'
 group by p.id, p.correo, p.estado, a.raw_app_meta_data;
