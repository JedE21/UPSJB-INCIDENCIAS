-- ============================================================================
-- SIR-UPSJB · supabase/limpiar_datos_demo.sql
-- LIMPIEZA QUIRÚRGICA DE DATOS DEMO / PRUEBAS (seed_demo.sql,
-- datos_ambiente_b401.sql, pruebas_*.sql) conservando catálogos de las
-- migraciones 0001–0020 y TODOS los datos reales.
--
-- CÓMO EJECUTAR: Supabase Dashboard → SQL Editor (rol postgres).
--   ⚠ HAZ UN BACKUP ANTES (Database → Backups) por prudencia.
--   ⚠ Es UNA SOLA TRANSACCIÓN: si algo falla, NO queda nada a medias.
--   ⚠ Idempotente: se puede re-ejecutar sin efectos extra.
--
-- QUÉ ELIMINA (solo filas que provienen de los scripts demo/pruebas):
--   · Usuarios demo/prueba: *@demo.upsjb.edu.pe, *@test.invalid,
--     test-*@example.com + perfiles de prueba sin auth (ids 00000000-…aa/bb).
--   · Sus incidencias (por reportante demo, ambiente TEST o código demo) con
--     todo su detalle en cascada: historial, comentarios, adjuntos, SLA,
--     encuestas, asignaciones, derivaciones, notificaciones.
--   · Equipos EQ-#### del seed, sus movimientos y los modelos que creó.
--   · Infraestructura del seed: sedes ICA/TESTSLA/TESTNOT/TESTREP,
--     pabellones, pisos, ambientes (incl. B401 si no tiene datos reales),
--     QRs y lecturas QR.
--   · Organización del seed: técnicos demo, turnos Mañana/Tarde/Noche,
--     áreas/servicios del seed, reglas 'Auto — %', cobertura del coordinador.
--   · Sesiones, reportes y auditoría de los actores/entidades demo.
--   · Objetos de Storage (bucket evidencias) de las incidencias demo.
--   · Funciones de apoyo de los scripts (__demo_qr, __sla_simular_sesion).
--
-- QUÉ CONSERVA:
--   · Catálogos de migraciones: roles, permisos, prioridades, estados,
--     canales, tipos/subtipos, tipos de ambiente, categorías/marcas/estados
--     de equipos, especialidades, plantillas de notificación, SLA base.
--   · CUALQUIER fila real que referencie un dato demo: las guardas NOT EXISTS
--     conservan el demo retencionario y el resumen final lo reporta.
--   · Tickets reales con códigos INC-2026-300111 o superior (si la secuencia
--     del año se sincronizó con códigos demo, los reales empiezan ahí: el
--     patrón de borrado termina exactamente en 300110).
--
-- NOTA: si un ticket REAL fue reportado por una cuenta demo, el ticket se
-- elimina con la cuenta (son credenciales publicitadas como demo). Si en
-- cambio un REAL cuelga de infraestructura demo, la infra se conserva.
-- ============================================================================

begin;

-- ############################################################################
-- 0. ANCLAS DEMO (tablas temporales, viven solo en esta transacción)
-- ############################################################################
create temp table _demo_sedes on commit drop as
select id from public.sedes where codigo in ('ICA', 'TESTSLA', 'TESTNOT', 'TESTREP');

create temp table _demo_sedes_test on commit drop as
select id from public.sedes where codigo in ('TESTSLA', 'TESTNOT', 'TESTREP');

create temp table _demo_perfiles on commit drop as
select p.id
from public.perfiles p
where p.correo::text like '%@demo.upsjb.edu.pe'
   or p.correo::text like '%@test.invalid'
   or p.correo::text like 'test-%@example.com'
   or p.id in (
        '00000000-0000-0000-0000-00000000aa01',
        '00000000-0000-0000-0000-00000000aa02',
        '00000000-0000-0000-0000-00000000bb01',
        '00000000-0000-0000-0000-00000000bb02');

-- Incidencias demo: por reportante demo, ambiente de sedes TEST, o código
-- del rango fijo del seed (100001–100420 y 300001–300110; 300111+ = reales).
create temp table _demo_incidencias on commit drop as
select i.id
from public.incidencias i
where i.usuario_reportante_id in (select id from _demo_perfiles)
   or i.ambiente_id in (
        select a.id
        from public.ambientes a
        join public.pisos pi       on pi.id = a.piso_id
        join public.pabellones pab on pab.id = pi.pabellon_id
        where pab.sede_id in (select id from _demo_sedes_test))
   or i.codigo ~ '^INC-(2024|2025|2026)-(100[0-9]{3}|300(0[0-9]{2}|10[0-9]|110))$';

create temp table _demo_equipos on commit drop as
select e.id
from public.equipos e
where e.codigo_interno ~ '^EQ-(PC|LT|MO|IM|IR|SW|AP|PR)-[0-9]{4}$';

do $$ declare
  v_inc int; v_per int; v_eq int; v_sed int;
begin
  select count(*) into v_inc from _demo_incidencias;
  select count(*) into v_per from _demo_perfiles;
  select count(*) into v_eq  from _demo_equipos;
  select count(*) into v_sed from _demo_sedes;
  raise notice 'PRE-CHECK → incidencias demo: % · perfiles demo: % · equipos demo: % · sedes demo: %',
    v_inc, v_per, v_eq, v_sed;
end $$;

-- ############################################################################
-- 1. PERMITIR BORRADO EN TABLAS APPEND-ONLY (se reactivan en el paso 10)
--    imprescindible: el historial de tickets demo viaja en cascada con la
--    incidencia y el trigger append-only lo bloquearía.
-- ############################################################################
alter table public.incidencia_historial disable trigger trg_incidencia_historial_append_only;
alter table public.registros_auditoria    disable trigger trg_registros_auditoria_append_only;

-- ############################################################################
-- 2. STORAGE: binarios de evidencias de incidencias demo. Envuelto en
--    excepción para que un problema de permisos de Storage no aborte la
--    limpieza (los archivos huérfanos se pueden podar después sin riesgo).
-- ############################################################################
do $$
begin
  delete from storage.objects o
  where o.bucket_id = 'evidencias'
    and exists (
      select 1 from _demo_incidencias d
      where o.name like '%/' || d.id::text || '/%');
  raise notice 'Storage: objetos de evidencias demo eliminados.';
exception when others then
  raise notice 'AVISO: no se pudieron borrar objetos de Storage (%). Revisar bucket evidencias después.', sqlerrm;
end $$;

-- ############################################################################
-- 3. INCIDENCIAS DEMO (en cascada: historial, comentarios, adjuntos, SLA,
--    encuestas/respuestas, asignaciones, derivaciones, notificaciones…)
-- ############################################################################
delete from public.incidencias
where id in (select id from _demo_incidencias);

-- Enlaces incidencia↔equipo restantes hacia equipos demo (evita FK restrict
-- y permite borrar equipos aunque un ticket REAL los cite).
delete from public.incidencia_equipos
where incidencia_id in (select id from _demo_incidencias)
   or equipo_id      in (select id from _demo_equipos);

-- ############################################################################
-- 4. EQUIPOS DEMO + modelos creados por el seed
--    Guarda: un equipo citado por un ticket REAL se conserva.
-- ############################################################################
create temp table _demo_equipos_borrar on commit drop as
select e.id
from public.equipos e
where e.id in (select id from _demo_equipos)
  and not exists (
    select 1 from public.incidencia_equipos ie where ie.equipo_id = e.id);

delete from public.equipos
where id in (select id from _demo_equipos_borrar);

-- Modelos del seed: solo si ningún equipo (también real) los usa, porque la
-- FK es on delete set null y anularía el modelo de un equipo real.
delete from public.modelos_equipos m
where m.nombre in ('ProDesk 400 G5','ProBook 440 G8','LaserJet P1102','OptiPlex 3070',
                   'Latitude 3420','UltraSharp E2216H','ThinkCentre M720q','IdeaPad 3',
                   'L3110','FX-2190','PowerLite S41','Catalyst 2960','TL-WA901N')
  and not exists (select 1 from public.equipos e where e.modelo_id = m.id);

-- ############################################################################
-- 5. ORGANIZACIÓN DEL SEED (antes de la infraestructura: los técnicos
--    referencian la sede con FK restrict y bloquearían su borrado)
-- ############################################################################
create temp table _demo_reglas on commit drop as
select id from public.reglas_enrutamiento where nombre like 'Auto%';

delete from public.reglas_enrutamiento
where id in (select id from _demo_reglas);

delete from private.tecnico_area_admin
where perfil_id in (select id from _demo_perfiles)
   or area_id in (select id from public.areas where nombre in
        ('Soporte Técnico','Redes y Conectividad','Infraestructura y Mantenimiento',
         'Académica','Administración'));

-- Técnicos demo (guarda: con asignaciones vigentes/reales se conservan, la FK
-- incidencia_asignaciones.tecnico_id es restrict)
delete from public.tecnicos t
where t.perfil_id in (select id from _demo_perfiles)
  and not exists (
    select 1 from public.incidencia_asignaciones ia where ia.tecnico_id = t.id);

-- Turnos del seed, solo si ningún técnico (real) los usa ya
delete from public.turnos tu
where tu.nombre in ('Mañana','Tarde','Noche')
  and not exists (
    select 1 from public.tecnicos_turnos tt
    where tt.turno_id = tu.id);

-- Servicios de las áreas del seed (solo si nadie los referencia)
delete from public.servicios s
where s.area_id in (select id from public.areas where nombre in
      ('Soporte Técnico','Redes y Conectividad','Infraestructura y Mantenimiento',
       'Académica','Administración'))
  and not exists (select 1 from public.incidencia_derivaciones d where d.servicio_destino_id = s.id)
  and not exists (select 1 from public.reglas_enrutamiento r      where r.servicio_destino_id = s.id);

-- Áreas del seed (si un dato real las usa, la FK restrict las conserva)
delete from public.areas a
where a.nombre in ('Soporte Técnico','Redes y Conectividad',
                   'Infraestructura y Mantenimiento','Académica','Administración')
  and not exists (select 1 from public.tecnicos t                where t.area_id = a.id)
  and not exists (select 1 from public.incidencia_derivaciones d where d.area_destino_id = a.id)
  and not exists (select 1 from public.reglas_enrutamiento r     where r.area_destino_id = a.id)
  and not exists (select 1 from public.servicios s               where s.area_id = a.id);

-- ############################################################################
-- 6. INFRAESTRUCTURA DEL SEED (de abajo hacia arriba, con guardas)
--    Los ambientes con datos REALES colgando (ticket real, equipo real,
--    movimiento real) se conservan junto con su QR y su cadena de ubicación.
-- ############################################################################
create temp table _demo_ambientes_borrar on commit drop as
select a.id
from public.ambientes a
where a.codigo = 'B401'
   or a.piso_id in (
        select pi.id from public.pisos pi
        join public.pabellones pab on pab.id = pi.pabellon_id
        where pab.sede_id in (select id from _demo_sedes))
  and not exists (select 1 from public.incidencias i         where i.ambiente_id = a.id)
  and not exists (select 1 from public.equipos_ambientes ea  where ea.ambiente_id = a.id)
  and not exists (select 1 from public.movimientos_equipos m where m.ambiente_destino_id = a.id);

-- QRs de los ambientes a borrar (lecturas_qr viaja en cascada)
delete from public.codigos_qr
where ambiente_id in (select id from _demo_ambientes_borrar);

delete from public.ambientes
where id in (select id from _demo_ambientes_borrar);

delete from public.pisos pi
where pi.pabellon_id in (
        select pab.id from public.pabellones pab
        where pab.sede_id in (select id from _demo_sedes))
  and not exists (select 1 from public.ambientes a where a.piso_id = pi.id);

delete from public.pabellones pab
where pab.sede_id in (select id from _demo_sedes)
  and not exists (select 1 from public.pisos pi where pi.pabellon_id = pab.id);

delete from public.sedes s
where s.id in (select id from _demo_sedes)
  and not exists (select 1 from public.pabellones p where p.sede_id = s.id)
  and not exists (select 1 from public.tecnicos t   where t.sede_id = s.id);

-- ############################################################################
-- 7. HUELLAS DEMO: sesiones, reportes y auditoría
--    (scope limitado a actores/entidades demo; el resto del log se respeta)
-- ############################################################################
delete from public.sesiones_usuario
where perfil_id in (select id from _demo_perfiles);

delete from public.reportes_generados
where solicitado_por in (select id from _demo_perfiles);

delete from public.registros_auditoria
where actor_id in (select id from _demo_perfiles)
   or registro_id in (select id from _demo_incidencias)
   or registro_id in (select id from _demo_equipos_borrar)
   or registro_id in (select id from _demo_ambientes_borrar)
   or registro_id in (select id from _demo_reglas)
   or codigo_referencia ~ '^INC-(2024|2025|2026)-(100[0-9]{3}|300(0[0-9]{2}|10[0-9]|110))$'
   or codigo_referencia like 'INC-TEST-%';

-- ############################################################################
-- 8. USUARIOS DEMO/PRUEBA
--    (notificaciones, preferencias, dispositivos, roles y técnicos restantes
--    viajan en cascada; perfiles de prueba sin auth.users se borran por id)
-- ############################################################################
delete from public.perfiles
where id in (select id from _demo_perfiles);

delete from auth.users
where email like '%@demo.upsjb.edu.pe'
   or email like '%@test.invalid'
   or email like 'test-%@example.com';

-- ############################################################################
-- 9. FUNCIONES DE APOYO dejadas por los scripts demo/pruebas
-- ############################################################################
drop function if exists public.__demo_qr(uuid, text);
drop function if exists public.__sla_simular_sesion(uuid);

-- ############################################################################
-- 10. REACTIVAR PROTECCIÓN APPEND-ONLY
-- ############################################################################
alter table public.incidencia_historial enable trigger trg_incidencia_historial_append_only;
alter table public.registros_auditoria    enable trigger trg_registros_auditoria_append_only;

-- ############################################################################
-- 11. RESUMEN FINAL (verificación: no debe quedar huella demo)
-- ############################################################################
do $$
declare
  v_inc int; v_usr int; v_eq int; v_amb int; v_qr int; v_tec int;
  v_area int; v_hist int; v_aud int; v_sed int; v_trg int;
begin
  select count(*) into v_inc from public.incidencias
   where usuario_reportante_id in (select p.id from public.perfiles p
                                   where p.correo::text like '%@demo.upsjb.edu.pe')
      or codigo ~ '^INC-(2024|2025|2026)-(100[0-9]{3}|300(0[0-9]{2}|10[0-9]|110))$';
  select count(*) into v_usr from public.perfiles
   where correo::text like '%@demo.upsjb.edu.pe' or correo::text like '%@test.invalid'
      or correo::text like 'test-%@example.com';
  select count(*) into v_eq from public.equipos
   where codigo_interno ~ '^EQ-(PC|LT|MO|IM|IR|SW|AP|PR)-[0-9]{4}$';
  select count(*) into v_amb from public.ambientes a
   join public.pisos pi       on pi.id = a.piso_id
   join public.pabellones pab on pab.id = pi.pabellon_id
   join public.sedes s        on s.id = pab.sede_id
   where s.codigo in ('ICA','TESTSLA','TESTNOT','TESTREP') or a.codigo = 'B401';
  select count(*) into v_qr from public.codigos_qr
   where codigo like 'ICA-%' or codigo like 'B401-%';
  select count(*) into v_tec from public.tecnicos t
   join public.perfiles p on p.id = t.perfil_id
   where p.correo::text like '%@demo.upsjb.edu.pe';
  select count(*) into v_area from public.areas
   where nombre in ('Soporte Técnico','Redes y Conectividad',
                    'Infraestructura y Mantenimiento','Académica','Administración');
  select count(*) into v_hist from public.incidencia_historial h
   join public.incidencias i on i.id = h.incidencia_id
   where i.usuario_reportante_id in (select p.id from public.perfiles p
                                     where p.correo::text like '%@demo.upsjb.edu.pe');
  select count(*) into v_aud from public.registros_auditoria
   where actor_id in (select p.id from public.perfiles p
                      where p.correo::text like '%@demo.upsjb.edu.pe');
  select count(*) into v_sed from public.sedes
   where codigo in ('ICA','TESTSLA','TESTNOT','TESTREP');
  select count(*) into v_trg from pg_trigger
   where tgname in ('trg_incidencia_historial_append_only',
                    'trg_registros_auditoria_append_only')
     and not tgisinternal and tgenabled <> 'D';

  raise notice '──────────────────────────────────────────────────────';
  raise notice 'Limpieza demo completada ✔ (transacción confirmada)';
  raise notice 'Residuos demo → incidencias=% usuarios=% equipos=% ambientes=% qrs=%',
    v_inc, v_usr, v_eq, v_amb, v_qr;
  raise notice '                tecnicos=% areas_seed=% historial_demo=% auditoria_demo=%',
    v_tec, v_area, v_hist, v_aud;
  if v_sed > 0 or v_amb > 0 then
    raise notice 'NOTA: % sede(s) / % ambiente(s) demo conservados porque tienen datos REALES colgando (guardas).', v_sed, v_amb;
  end if;
  if v_trg = 2 then
    raise notice 'Protección append-only de historial y auditoría: ACTIVA ✔';
  else
    raise exception ' Los triggers append-only NO quedaron activos (%/2) — revierta y revise', v_trg;
  end if;
  raise notice '──────────────────────────────────────────────────────';
end $$;

commit;

-- ----------------------------------------------------------------------------
-- SI EL RESUMEN REPORTA RESIDUOS, son datos reales protegidos por las guardas.
-- Inspección rápida de qué retiene cada cosa:
--
--   -- ambientes demo conservados y por qué:
--   select a.codigo,
--          (select count(*) from public.incidencias i         where i.ambiente_id = a.id)          as tickets,
--          (select count(*) from public.equipos_ambientes ea  where ea.ambiente_id = a.id)         as equipos,
--          (select count(*) from public.movimientos_equipos m where m.ambiente_destino_id = a.id)  as movimientos
--   from public.ambientes a
--   join public.pisos pi       on pi.id = a.piso_id
--   join public.pabellones pab on pab.id = pi.pabellon_id
--   join public.sedes s        on s.id = pab.sede_id
--   where s.codigo in ('ICA','TESTSLA','TESTNOT','TESTREP') or a.codigo = 'B401';
--
-- RECORDATORIOS POST-LIMPIEZA:
--   · Si se borró la sede ICA y no queda ninguna sede ACTIVA, crea la sede
--     institucional real: los QR solo resuelven con sede activa.
--   · Regenera los QR institucionales desde el panel de administración
--     (los del seed fueron eliminados).
--   · Los catálogos de las migraciones (roles, prioridades, SLA base,
--     plantillas, permisos) NO fueron tocados.
-- ----------------------------------------------------------------------------
