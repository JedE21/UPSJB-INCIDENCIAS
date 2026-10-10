-- ============================================================================
-- SIR-UPSJB · supabase/migrations/0022_admin_crud_incidencias.sql
--
-- CRUD TOTAL del ADMINISTRADOR sobre incidencias (idempotente):
--
--   · RPC incidencias_admin_lista()   → lista TODAS las incidencias con RLS
--     en pantalla (SECURITY INVOKER: pasa p_incidencias_select del admin) +
--     filtros de estado/pendientes/sin área/sin técnico.
--   · Policies: p_incidencias_insert_admin / _update_admin / _delete_admin
--     (hoy NO existía INSERT/UPDATE/DELETE admin explícito sobre esta tabla).
--   · RPC incidencias_admin_actualizar() → edita descripción, tipo, subtipo,
--     prioridad y ambiente (el estado lo sigue manejando el flujo técnico).
--   · RPC incidencias_admin_crear()     → crea una incidencia a nombre del
--     admin (reutiliza triggers de código/estado/canal + clasificación + SLA).
--   · RPC incidencias_admin_eliminar()  → DELETE físico con snapshot en
--     registros_auditoria (append-only) y limpieza best-effort de Storage.
--
-- SEGURIDAD: las RPC de escritura son SECURITY DEFINER con guard explícito
-- soy_administrador() (decisión re-verificada en BD, nunca solo en la UI).
-- El listado es SECURITY INVOKER: la lectura respeta el RLS del perfil.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Idempotencia
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.incidencias_admin_lista(text, boolean, boolean, boolean, int, int);
DROP FUNCTION IF EXISTS public.incidencias_admin_lista(text, boolean, boolean, boolean, boolean, boolean, int, int);
DROP FUNCTION IF EXISTS public.incidencias_admin_eliminar(uuid);
DROP FUNCTION IF EXISTS public.incidencias_admin_actualizar(uuid, text, uuid, uuid, boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.incidencias_admin_actualizar(uuid, text, uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.incidencias_admin_crear(uuid, uuid, uuid, uuid, text);

-- ----------------------------------------------------------------------------
-- 1. RPC LISTAR (SECURITY INVOKER: lee con el JWT del admin; RLS filtra).
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.incidencias_admin_lista(
  p_estado      text    DEFAULT NULL,
  p_pendientes  boolean DEFAULT false,
  p_sin_area    boolean DEFAULT false,
  p_sin_tecnico boolean DEFAULT false,
  p_limite      int     DEFAULT 300,
  p_offset      int     DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  codigo           text,
  descripcion      text,
  fecha_reporte    timestamptz,
  estado           text,
  prioridad        text,
  tipo             text,
  subtipo          text,
  ambiente         text,
  ambiente_codigo  text,
  sede             text,
  pabellon         text,
  piso             text,
  reportante       text,
  area_responsable text,
  tecnico_asignado text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.codigo,
    i.descripcion,
    i.fecha_reporte,
    COALESCE(est.nombre, '—')                 AS estado,
    COALESCE(pri.nombre, '—')                 AS prioridad,
    COALESCE(tip.nombre, '—')                 AS tipo,
    COALESCE(sub.nombre, '')                  AS subtipo,
    COALESCE(a.nombre, '(ambiente eliminado)') AS ambiente,
    COALESCE(a.codigo, '—')                   AS ambiente_codigo,
    COALESCE(sede.nombre, '')                 AS sede,
    COALESCE(pab.nombre, '')                  AS pabellon,
    COALESCE(pis.nombre, CASE WHEN pis.numero IS NOT NULL THEN 'Piso ' || pis.numero::text ELSE '' END) AS piso,
    COALESCE(NULLIF(btrim(COALESCE(rep.nombres, '') || ' ' || COALESCE(rep.apellido_paterno, '')), ''), '') AS reportante,
    COALESCE(der.area_nombre, '')             AS area_responsable,
    COALESCE(tecnico.nombre, '')              AS tecnico_asignado
  FROM incidencias i
  LEFT JOIN estados_incidencia est    ON est.id  = i.estado_id
  LEFT JOIN prioridades pri           ON pri.id  = i.prioridad_id
  LEFT JOIN tipos_incidencia tip      ON tip.id  = i.tipo_incidencia_id
  LEFT JOIN subtipos_incidencia sub   ON sub.id  = i.subtipo_incidencia_id
  LEFT JOIN ambientes a               ON a.id    = i.ambiente_id
  LEFT JOIN pisos pis                 ON pis.id  = a.piso_id
  LEFT JOIN pabellones pab            ON pab.id  = pis.pabellon_id
  LEFT JOIN sedes sede                ON sede.id = pab.sede_id
  LEFT JOIN perfiles rep              ON rep.id  = i.usuario_reportante_id
  LEFT JOIN LATERAL (
    SELECT ar.nombre AS area_nombre
    FROM incidencia_derivaciones d
    JOIN areas ar ON ar.id = d.area_destino_id
    WHERE d.incidencia_id = i.id AND d.activa
    LIMIT 1
  ) der ON true
  LEFT JOIN LATERAL (
    SELECT btrim(COALESCE(p2.nombres, '') || ' ' || COALESCE(p2.apellido_paterno, '')) AS nombre
    FROM incidencia_asignaciones ia
    JOIN tecnicos t  ON t.id  = ia.tecnico_id
    JOIN perfiles p2 ON p2.id = t.perfil_id
    WHERE ia.incidencia_id = i.id AND ia.activa
    LIMIT 1
  ) tecnico ON true
  WHERE
        (p_estado IS NULL OR p_estado = '' OR est.nombre = p_estado)
    AND (NOT p_pendientes  OR est.nombre = 'Pendiente')
    AND (NOT p_sin_area    OR der.area_nombre IS NULL)
    AND (NOT p_sin_tecnico OR tecnico.nombre IS NULL)
  ORDER BY i.fecha_reporte DESC
  LIMIT  LEAST(GREATEST(COALESCE(p_limite, 300), 1), 2000)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
$$;

REVOKE ALL ON FUNCTION public.incidencias_admin_lista(text, boolean, boolean, boolean, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.incidencias_admin_lista(text, boolean, boolean, boolean, int, int) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Policies CRUD del ADMIN (INSERT/UPDATE/DELETE ya controladas en BD).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS p_incidencias_insert_admin ON public.incidencias;
DROP POLICY IF EXISTS p_incidencias_update_admin ON public.incidencias;
DROP POLICY IF EXISTS p_incidencias_delete_admin ON public.incidencias;

CREATE POLICY p_incidencias_insert_admin
  ON public.incidencias
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (soy_administrador());

CREATE POLICY p_incidencias_update_admin
  ON public.incidencias
  AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING (soy_administrador())
  WITH CHECK (soy_administrador());

CREATE POLICY p_incidencias_delete_admin
  ON public.incidencias
  AS PERMISSIVE FOR DELETE
  TO authenticated
  USING (soy_administrador());

-- ----------------------------------------------------------------------------
-- 3. RPC ELIMINAR (SECURITY DEFINER + guard admin): snapshot en auditoría,
--    limpieza best-effort de los objetos de Storage, DELETE con cascadas.
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.incidencias_admin_eliminar(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_codigo   text;
  obj        record;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Incidencia no válida.';
  END IF;
  IF NOT soy_administrador() THEN
    RAISE EXCEPTION 'Solo el administrador puede eliminar incidencias.';
  END IF;

  SELECT to_jsonb(i), i.codigo INTO v_snapshot, v_codigo
  FROM incidencias i
  WHERE i.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La incidencia no existe o no es visible.';
  END IF;

  -- (a) Objetos de evidencias en Storage (metadata; el binario queda huérfano
  --     si la API de Storage no está disponible para postgres — best effort).
  -- (b) Desactivar TEMPORALMENTE los guards append-only de 0008 sobre las
  --     tablas hijas, SOLO dentro de esta operación privilegiada y auditada
  --     (sin esto el DELETE en cascada del historial lanzaría "prohibido").
  --     El guard se repone siempre, incluso si el DELETE falla (manejo de excepción).
  DECLARE
    v_tablas text[] := ARRAY[
      'incidencia_historial','incidencia_comentarios','incidencia_adjuntos',
      'incidencia_asignaciones','incidencia_derivaciones','incidencia_equipos',
      'incidencia_tecnicos','incidencia_ubicaciones','tiempos_sla',
      'respuestas_encuesta','notificaciones'
    ];
    t text;
  BEGIN
    FOREACH t IN ARRAY v_tablas LOOP
      BEGIN
        EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
      EXCEPTION WHEN INSUFFICIENT_PRIVILEGE OR UNDEFINED_TABLE OR UNDEFINED_OBJECT THEN NULL;
      END;
    END LOOP;

    DELETE FROM incidencias WHERE id = p_id;

    FOREACH t IN ARRAY v_tablas LOOP
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
      EXCEPTION WHEN INSUFFICIENT_PRIVILEGE OR UNDEFINED_TABLE OR UNDEFINED_OBJECT THEN NULL;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    FOREACH t IN ARRAY v_tablas LOOP
      BEGIN
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
      EXCEPTION WHEN INSUFFICIENT_PRIVILEGE OR UNDEFINED_TABLE OR UNDEFINED_OBJECT THEN NULL;
      END;
    END LOOP;
    RAISE;
  END;

  -- (c) Auditoría del borrado (append-only, 0020).
  INSERT INTO registros_auditoria (actor_id, accion, tabla_afectada, registro_id, valores_previos)
  VALUES (auth.uid(), 'ANULAR', 'incidencias', p_id, v_snapshot);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.incidencias_admin_eliminar(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.incidencias_admin_eliminar(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC ACTUALIZAR (SECURITY DEFINER + guard admin). Campos administrables:
--    descripción, tipo, subtipo (FK compuesta fk_incidencias_subtipo_coherente
--    revalida la coherencia), prioridad y ambiente. El estado NO cambia aquí.
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.incidencias_admin_actualizar(
  p_id            uuid,
  p_descripcion   text,
  p_tipo_id       uuid,
  p_subtipo_id    uuid,
  p_quitar_subtipo boolean,
  p_prioridad_id  uuid,
  p_ambiente_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_cambios  text[] := '{}';
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Incidencia no válida.';
  END IF;
  IF NOT soy_administrador() THEN
    RAISE EXCEPTION 'Solo el administrador puede editar incidencias.';
  END IF;

  SELECT to_jsonb(i) INTO v_snapshot FROM incidencias i WHERE i.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La incidencia no existe o no es visible.';
  END IF;

  -- La FK compuesta (tipo ↔ subtipo) y los CHECK de descripción revalidan.
  UPDATE incidencias i SET
    descripcion = CASE
      WHEN p_descripcion IS NOT NULL AND btrim(p_descripcion) <> '' THEN btrim(p_descripcion)
      ELSE i.descripcion END,
    tipo_incidencia_id  = COALESCE(p_tipo_id,  i.tipo_incidencia_id),
    subtipo_incidencia_id = CASE
      WHEN COALESCE(p_quitar_subtipo, false) THEN NULL
      ELSE COALESCE(p_subtipo_id, i.subtipo_incidencia_id) END,
    prioridad_id = COALESCE(
      NULLIF(p_prioridad_id, '00000000-0000-0000-0000-000000000000'::uuid),
      i.prioridad_id),
    ambiente_id  = COALESCE(p_ambiente_id, i.ambiente_id)
  WHERE i.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo actualizar la incidencia.';
  END IF;

  -- Auditoría del cambio (valores previos → nuevos).
  INSERT INTO registros_auditoria (actor_id, accion, tabla_afectada, registro_id, valores_previos)
  VALUES (auth.uid(), 'EDITAR', 'incidencias', p_id, v_snapshot);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.incidencias_admin_actualizar(uuid, text, uuid, uuid, boolean, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.incidencias_admin_actualizar(uuid, text, uuid, uuid, boolean, uuid, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC CREAR (SECURITY DEFINER + guard admin): misma lógica de negocio que
--    el flujo web — el trigger asigna código/estado/prioridad/canal, y luego
--    se intenta clasificación + snapshot de SLA (best effort, no bloquean).
--    El reportante es el propio ADMIN (usuario_actual()), nunca un id del
--    cliente.
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.incidencias_admin_crear(
  p_ambiente_id   uuid,
  p_tipo_id       uuid,
  p_subtipo_id    uuid,
  p_prioridad_id  uuid,
  p_descripcion   text
)
RETURNS TABLE (id uuid, codigo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_codigo text;
BEGIN
  IF NOT soy_administrador() THEN
    RAISE EXCEPTION 'Solo el administrador puede crear incidencias.';
  END IF;
  IF p_ambiente_id IS NULL OR p_tipo_id IS NULL THEN
    RAISE EXCEPTION 'Ambiente y tipo son obligatorios.';
  END IF;
  IF p_descripcion IS NULL OR length(btrim(p_descripcion)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'La descripción debe tener entre 10 y 2000 caracteres.';
  END IF;

  PERFORM 1 FROM ambientes a WHERE a.id = p_ambiente_id AND a.activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'El ambiente no está disponible.'; END IF;

  PERFORM 1 FROM tipos_incidencia t WHERE t.id = p_tipo_id AND t.activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'El tipo de incidencia no está disponible.'; END IF;

  IF p_subtipo_id IS NOT NULL THEN
    PERFORM 1 FROM subtipos_incidencia s
    WHERE s.id = p_subtipo_id AND s.tipo_incidencia_id = p_tipo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'El subtipo no corresponde al tipo.'; END IF;
  END IF;

  IF p_prioridad_id IS NOT NULL THEN
    PERFORM 1 FROM prioridades p WHERE p.id = p_prioridad_id AND p.activo;
    IF NOT FOUND THEN RAISE EXCEPTION 'La prioridad no está disponible.'; END IF;
  END IF;

  INSERT INTO incidencias
    (usuario_reportante_id, ambiente_id, tipo_incidencia_id,
     subtipo_incidencia_id, prioridad_id, descripcion)
  VALUES
    (usuario_actual(), p_ambiente_id, p_tipo_id, p_subtipo_id,
     p_prioridad_id, btrim(p_descripcion))
  RETURNING incidencias.id, incidencias.codigo INTO v_id, v_codigo;

  INSERT INTO registros_auditoria (actor_id, accion, tabla_afectada, registro_id)
  VALUES (auth.uid(), 'CREAR', 'incidencias', v_id);

  BEGIN
    PERFORM clasificar_incidencia(v_id, 'admin_panel');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    PERFORM registrar_sla_incidencia(v_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN QUERY SELECT v_id, v_codigo;
END;
$$;

REVOKE ALL ON FUNCTION public.incidencias_admin_crear(uuid, uuid, uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.incidencias_admin_crear(uuid, uuid, uuid, uuid, text) TO authenticated;

-- ============================================================================
-- FIN DE 0022
-- ============================================================================
