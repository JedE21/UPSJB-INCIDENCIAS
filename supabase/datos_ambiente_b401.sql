-- ============================================================================
-- DATOS · Aula de Cómputo B401 (Pabellón B, Piso 4) + QR institucional
-- ----------------------------------------------------------------------------
-- Ejecutar en: Supabase Dashboard → SQL Editor (rol postgres, bypass RLS).
-- Idempotente: se puede re-ejecutar sin duplicar datos.
-- Resultado: QR con código FIJO "B401-0001" y URL estable /r/B401-0001.
-- ============================================================================

-- 1a. Sede: si NO existe ninguna, se crea la Filial Ica (idempotente).
insert into public.sedes (nombre, codigo, direccion, activa)
select 'UPSJB — Filial Ica', 'ICA', 'Ica, Perú', true
where not exists (select 1 from public.sedes)
on conflict do nothing;

-- 1b. Se usa la primera registrada y se marca ACTIVA
--     (los QR solo resuelven con sede activa; ajusta el filtro si hay varias).
update public.sedes set activa = true
where id = (select id from public.sedes order by creado_en limit 1);

-- 2. Pabellón B y Piso 4 (idempotente).
insert into public.pabellones (sede_id, nombre, codigo, activo)
select s.id, 'Pabellón B', 'B', true
from public.sedes s
where s.id = (select id from public.sedes order by creado_en limit 1)
on conflict (sede_id, codigo) do nothing;

insert into public.pisos (pabellon_id, numero, nombre)
select p.id, 4, 'Piso 4'
from public.pabellones p
where p.sede_id = (select id from public.sedes order by creado_en limit 1)
  and p.codigo = 'B'
on conflict (pabellon_id, numero) do nothing;

-- 3. Tipo de ambiente (ya viene del seed 0005; se asegura por si acaso).
insert into public.tipos_ambiente (nombre, activo)
values ('Aula', true)
on conflict (nombre) do nothing;

-- 4. Ambiente B401 · Aula de Cómputo (código institucional del ambiente: B401).
insert into public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, detalle_ubicacion, activo)
select pi.id, t.id, 'Aula de Cómputo B401', 'B401', 'Pabellón B · Piso 4', true
from public.pisos pi
cross join public.tipos_ambiente t
where pi.pabellon_id = (
        select p.id from public.pabellones p
        where p.sede_id = (select id from public.sedes order by creado_en limit 1)
          and p.codigo = 'B'
      )
  and pi.numero = 4
  and t.nombre = 'Aula'
on conflict (codigo) do nothing;

-- 5. Especialización: aula CON computadoras (tabla-hija de ambientes).
insert into public.aulas (ambiente_id, tiene_computadoras)
select a.id, true from public.ambientes a where a.codigo = 'B401'
on conflict (ambiente_id) do nothing;

-- 6. QR institucional con código FIJO (determinístico): B401-0001.
--    El trigger de INSERT permite código manual ("importación: no recalcular");
--    url_destino se provee explícitamente (la ruta estable /r/<codigo>).
update public.codigos_qr
   set activo = false, deshabilitado_en = now()
where ambiente_id = (select id from public.ambientes where codigo = 'B401')
  and activo = true
  and codigo <> 'B401-0001';

insert into public.codigos_qr (ambiente_id, codigo, url_destino, activo)
select a.id, 'B401-0001', '/r/B401-0001', true
from public.ambientes a
where a.codigo = 'B401'
on conflict (codigo) do nothing;

-- Si el código ya existía pero estaba deshabilitado, reactivarlo
-- (solo hay un QR activo por ambiente: el update anterior ya liberó el puesto).
update public.codigos_qr
   set activo = true, deshabilitado_en = null
where codigo = 'B401-0001' and activo = false;

-- 7. Verificación: debe devolver UNA fila (codigo = B401-0001, activo = true,
--    sede_activa = true).
select q.codigo,
       q.url_destino,
       q.activo,
       a.nombre  as ambiente,
       s.activa  as sede_activa
from public.codigos_qr q
join public.ambientes a  on a.id  = q.ambiente_id
join public.pisos pi     on pi.id = a.piso_id
join public.pabellones p on p.id  = pi.pabellon_id
join public.sedes s      on s.id  = p.sede_id
where q.codigo = 'B401-0001';
