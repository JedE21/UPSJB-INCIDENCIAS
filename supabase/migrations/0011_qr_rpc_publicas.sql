-- ============================================================================
-- SIR-UPSJB · 0011_qr_rpc_publicas.sql
-- RPC SECURITY DEFINER para el flujo público del QR (Fase 4/QR).
--
-- CONTEXTO: las políticas RLS aprobadas (0007) otorgan acceso a las tablas
-- solo a `authenticated` (p_qr_lectura, p_infra_lectura_ambientes, etc.) y NO
-- existen grants/policies `to anon`. El escaneo de un QR es anónimo por diseño
-- (lecturas_qr.perfil_id admite NULL), por lo que la ruta pública /r/<codigo>
-- NO puede leer codigos_qr/ambientes con el rol anon directamente.
--
-- SOLUCIÓN (mínima y encapsulada): dos funciones SECURITY DEFINER con
-- search_path vacío que exponen SOLO:
--   · resolver_qr_publico(codigo)   → 1 fila: datos de ubicación del ambiente
--                                     si el QR existe y está activo.
--   · registrar_lectura_qr(codigo, dispositivo, navegador) → inserta en
--     lecturas_qr (perfil solo si hay sesión).
--
-- No se exponen UUID internos, ni filas de otros QR, ni permisos de escritura
-- sobre codigos_qr/ambientes. El "token" de acceso público es el CÓDIGO del QR
-- (secreto razonable impreso en el aula; rotable con regenerar).
--
-- Idempotente: CREATE OR REPLACE / DROP POLICY IF NOT EXISTS manual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Resolución pública de un QR por su código.
--    Devuelve SOLO lo que la pantalla necesita: ubicación (§28) + banderas de
--    estado para decidir la pantalla (activo / deshabilitado / inactivo).
--    Si el código no existe → 0 filas. Nunca expone UUID de codigos_qr.
-- ----------------------------------------------------------------------------
create or replace function public.resolver_qr_publico(p_codigo text)
returns table (
  qr_codigo        text,
  qr_activo        boolean,
  ambiente_id      uuid,
  ambiente_nombre  text,
  ambiente_codigo  text,
  ambiente_activo  boolean,
  tipo_ambiente    text,
  piso_nombre      text,
  piso_numero      integer,
  pabellon_nombre  text,
  sede_nombre      text,
  sede_activa      boolean,
  disponible       boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    q.codigo,
    q.activo,
    a.id,
    a.nombre,
    a.codigo,
    a.activo,
    ta.nombre,
    coalesce(p.nombre, 'Piso ' || p.numero::text),
    p.numero,
    pb.nombre,
    s.nombre,
    s.activa,
    (q.activo and a.activo and s.activa)
  from public.codigos_qr q
  join public.ambientes a  on a.id  = q.ambiente_id
  join public.tipos_ambiente ta on ta.id = a.tipo_ambiente_id
  join public.pisos p      on p.id  = a.piso_id
  join public.pabellones pb on pb.id = p.pabellon_id
  join public.sedes s      on s.id  = pb.sede_id
  where q.codigo = p_codigo;
$$;

revoke all on function public.resolver_qr_publico(text) from public;
grant execute on function public.resolver_qr_publico(text) to anon, authenticated;

comment on function public.resolver_qr_publico(text) is
  'Flujo QR público: ubicación + banderas de estado (activo/deshabilitado) sin exponer tablas.';

-- ----------------------------------------------------------------------------
-- 2. Registro de lectura (§14.2). Anónimo permitido; el perfil se toma del
--    JWT en el SERVIDOR (never trust the browser). El cliente nunca envía
--    perfil_id. IP: NO se registra aquí (ip_hash solo si hay finalidad;
--    el endpoint puede añadirla como hash con sal en una fase posterior).
-- ----------------------------------------------------------------------------
create or replace function public.registrar_lectura_qr(
  p_codigo     text,
  p_dispositivo text default null,
  p_navegador   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qr_id uuid;
  v_perfil uuid := nullif(current_setting('request.jwt.claim.sub', true), '');
begin
  -- Solo lecturas de QR existentes (activo o no: la lectura es un hecho).
  select id into v_qr_id
    from public.codigos_qr
   where codigo = p_codigo;

  if v_qr_id is null then
    return;  -- QR inexistente: nada que registrar (la pantalla ya dio 404).
  end if;

  insert into public.lecturas_qr (codigo_qr_id, perfil_id, dispositivo, navegador)
  values (v_qr_id, v_perfil::uuid, p_dispositivo, p_navegador);
end;
$$;

revoke all on function public.registrar_lectura_qr(text, text, text) from public;
grant execute on function public.registrar_lectura_qr(text, text, text) to anon, authenticated;

comment on function public.registrar_lectura_qr(text, text, text) is
  'Registra escaneo en lecturas_qr; perfil desde JWT de servidor, nunca del cliente.';
