-- ============================================================================
-- SIR-UPSJB · supabase/seed_institucional_minimo.sql
--
-- DATOS INSTITUCIONALES MÍNIMOS para que el panel admin cargue correctamente
-- en cada apartado a partir del estado actual (los catálogos de la semilla
-- 0005 —roles, permisos, tipos/subtipos, prioridades, estados, categorías,
-- marcas, estados de equipo, especialidades, acuerdos SLA— YA EXISTEN).
--
-- Crea SOLO lo que el CRUD necesita para funcionar con datos reales:
--   · 1 sede (Filial Ica) + 1 pabellón + 1 piso + ambientes de ejemplo.
--   · Áreas responsables + servicios técnicos.
--   · Modelos de equipos (la tabla estaba vacía).
--   · Idempotente: ON CONFLICT DO NOTHING en las claves únicas 0001.
--
-- EJECUTAR: Supabase Dashboard → SQL Editor (rol postgres). Después de 0005.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sede raíz (multi-sede: los pabellones cuelgan de esta)
-- ----------------------------------------------------------------------------
INSERT INTO public.sedes (nombre, codigo, direccion, activa)
VALUES ('UPSJB — Filial Ica', 'ICA', 'Ica, Perú', true)
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Áreas responsables (destino de las derivaciones)
-- ----------------------------------------------------------------------------
INSERT INTO public.areas (nombre, descripcion, activo)
VALUES
  ('Soporte Técnico', 'Atención de soporte técnico de equipos y laboratorios.', true),
  ('Sistemas',        'Gestión de redes, servidores y sistemas institucionales.', true),
  ('Infraestructura', 'Mantenimiento de aulas, mobiliario e instalaciones.', true),
  ('Biblioteca',      'Recursos, préstamos y servicios de biblioteca.', true)
ON CONFLICT (nombre) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Servicios por área (nombre único dentro del área: 0001)
-- ----------------------------------------------------------------------------
INSERT INTO public.servicios (area_id, nombre, activo)
SELECT a.id, s.nombre, true
FROM public.areas a
JOIN (VALUES
  ('Soporte Técnico', 'Equipos de cómputo'),
  ('Soporte Técnico', 'Proyectores'),
  ('Sistemas',        'Redes'),
  ('Sistemas',        'Internet'),
  ('Sistemas',        'Servidores'),
  ('Infraestructura', 'Iluminación'),
  ('Infraestructura', 'Mobiliario'),
  ('Biblioteca',      'Libros'),
  ('Biblioteca',      'Préstamos')
) AS s(area, nombre) ON s.area = a.nombre
ON CONFLICT (area_id, nombre) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Pabellón y piso de ejemplo
-- ----------------------------------------------------------------------------
INSERT INTO public.pabellones (sede_id, nombre, codigo, activo)
SELECT s.id, 'Pabellón B', 'B', true
FROM public.sedes s
WHERE s.codigo = 'ICA'
ON CONFLICT (sede_id, codigo) DO NOTHING;

INSERT INTO public.pisos (pabellon_id, numero, nombre)
SELECT p.id, 1, 'Primer piso'
FROM public.pabellones p
WHERE p.codigo = 'B'
  AND p.sede_id = (SELECT id FROM public.sedes WHERE codigo = 'ICA')
ON CONFLICT (pabellon_id, numero) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Ambientes de ejemplo (código jerárquico único: SEDE-PABELLON-AMB)
-- ----------------------------------------------------------------------------
INSERT INTO public.ambientes (piso_id, tipo_ambiente_id, nombre, codigo, activo)
SELECT
  pis2.id,
  ta.id,
  v.nombre,
  v.codigo,
  true
FROM (VALUES
  ('Aula B-101',              'ICA-B-B101', 'Aula'),
  ('Aula B-102',              'ICA-B-B102', 'Aula'),
  ('Laboratorio Cómputo 1',   'ICA-B-LC1',  'Laboratorio'),
  ('Oficina Administración',  'ICA-B-OA1',  'Oficina')
) AS v(nombre, codigo, tipo)
JOIN public.tipos_ambiente ta ON ta.nombre = v.tipo
CROSS JOIN LATERAL (
  SELECT pis3.id
  FROM public.pisos pis3
  JOIN public.pabellones pab ON pab.id = pis3.pabellon_id
  WHERE pab.codigo = 'B'
    AND pab.sede_id = (SELECT id FROM public.sedes WHERE codigo = 'ICA')
    AND pis3.numero = 1
  LIMIT 1
) pis2
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Modelos de equipos (la tabla estaba vacía en esta BD)
-- ----------------------------------------------------------------------------
INSERT INTO public.modelos_equipos (marca_id, nombre)
SELECT m.id, v.nombre
FROM (VALUES
  ('HP',     'ProBook 450 G9'),
  ('HP',     'LaserJet M404dn'),
  ('Lenovo', 'ThinkPad E14'),
  ('Dell',   'OptiPlex 3090'),
  ('Epson',  'PowerLite X49')
) AS v(marca, nombre)
JOIN public.marcas_equipos m ON m.nombre = v.marca
ON CONFLICT (marca_id, nombre) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. Verificación: jerarquía y áreas creadas
-- ----------------------------------------------------------------------------
SELECT 'sedes' AS entidad, count(*) FROM public.sedes
UNION ALL SELECT 'pabellones', count(*) FROM public.pabellones
UNION ALL SELECT 'pisos', count(*) FROM public.pisos
UNION ALL SELECT 'ambientes', count(*) FROM public.ambientes
UNION ALL SELECT 'areas', count(*) FROM public.areas
UNION ALL SELECT 'servicios', count(*) FROM public.servicios
UNION ALL SELECT 'modelos', count(*) FROM public.modelos_equipos;
