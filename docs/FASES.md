# Fases de desarrollo — SIR-UPSJB

Documento de seguimiento. El alcance de cada fase proviene del Plan Maestro (§42) ajustado a la arquitectura aprobada.

## FASE 1 — Arquitectura y base del proyecto ✅

**Objetivo:** proyecto Next.js compilando, con estructura de rutas por contexto y componentes base.

Incluye:

- [x] Next.js (App Router) + TypeScript estricto
- [x] Tailwind CSS v4 con tokens de tema (estilo shadcn/ui)
- [x] Componentes UI: button, badge, card, input, label, textarea, skeleton
- [x] Framer Motion (FadeIn, respeta `prefers-reduced-motion`)
- [x] Lucide Icons
- [x] Sistema de rutas: `(public)`, `(usuario)`, `tecnico`, `coordinador`, `admin`, `login`
- [x] Layouts con navegación por contexto (header/footer/shells)
- [x] Página 404 personalizada
- [x] Variables de entorno plantilla (`.env.example`), sin credenciales
- [x] `.gitignore` (excluye `.env*` excepto `.env.example`)
- [x] README + CI (GitHub Actions: typecheck + build)

No incluye (por diseño): tablas, migraciones, RLS, autenticación funcional, QR, lógica de incidencias, dashboards.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 2 — Integración de Supabase (clientes) ⬜

- Clientes Supabase (`browser`, `server`, `middleware`) con `@supabase/ssr`.
- `.env.local` con valores reales del proyecto (URL + anon key).
- Verificación de conectividad sin crear tablas.

Requiere del usuario: **Project URL** y **Anon/Public Key** (la `SERVICE_ROLE_KEY` no se usa en esta fase).

## FASE 3 — Base de datos (migraciones + RLS) 🔶 migraciones listas · RLS pendiente

- [x] Migraciones SQL ordenadas (`supabase/migrations/0001`–`0005`): 58 tablas (Opción A), PK/FK/UNIQUE/CHECK/DEFAULT, índices, funciones (código INC anual, códigos QR, defaults por nombre), triggers (updated_at, códigos, QR, asignaciones, perfiles, append-only) y semillas de catálogos [P].
- [ ] RLS + políticas por rol (espera confirmación explícita).
- Diseño previo: [`01-DISENO-BASE-DATOS-SIR-UPSJB.md`](01-DISENO-BASE-DATOS-SIR-UPSJB.md) — **aprobado: Opción A, 58 tablas literales del Plan Maestro**.

## FASE 4 — Autenticación, roles y permisos 🔶 implementada · pendiente configuración del hook en Dashboard

- Clientes Supabase (`@supabase/ssr`): browser singleton, server con `cache()`, cliente efímero de verificación.
- [x] Login/logout con Server Actions; redirección por rol (jerarquía de permanencia §8.1).
- [x] Recuperación y restablecimiento de contraseña (PKCE, sin enumeración de correos).
- [x] Sesión en servidor (`getUser()` + perfil vía RLS) y cliente (cookies compartidas, singleton).
- [x] Roles en el JWT vía Custom Access Token Hook (migración 0010) + RPC `sincronizar_roles_auth`.
- [x] Protección de rutas: middleware (refresh + paneles) y guards en layouts (`exigirPanel`).
- [x] Perfil de usuario (datos complementarios editables; credenciales solo en Supabase Auth).
- [x] Asociación `auth.users` ↔ `perfiles` 1:1 (mismo UUID, trigger `register_new_user`).
- [ ] Configurar el hook en Dashboard (Authentication → Hooks) y URL Configuration.
- [ ] Crear el primer ADMINISTRADOR (SQL desde el panel) y pruebas E2E con usuarios reales.

## FASE 5 — Base UI reutilizable ✅

**Objetivo:** sistema visual común sobre el que se construirán todos los módulos (sin lógica de negocio). En la numeración del Plan Maestro (§42) corresponde a parte de la Fase 12 (UX/UI), adelantada como base.

Incluye:

- [x] Primitivas UI: select, alert, modal, toast (provider + useToast), spinner, table
- [x] Catálogo visual de estados y prioridades con ICONO + TEXTO (§50): `lib/incidencias-visual.ts`
- [x] Componentes de dominio: StatusBadge, PriorityBadge, ProgresoEstado (flujo §30)
- [x] Componentes compartidos: PageHeader, Breadcrumbs, EmptyState, LoadingState (+skeletons), StatCard, FormField, SearchInput, FilterBar, DataTable (búsqueda/orden/paginación), ConfirmDialog, FileUpload (visual), Timeline
- [x] ToastProvider montado en el layout raíz
- [x] Página catálogo `/admin/ui` con ejemplos estáticos (sin datos en BD) + ítem de navegación admin
- No incluye (por diseño): QR, incidencias, dashboards, SLA, notificaciones, reportes, lógica de permisos

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## EXPERIENCIA PÚBLICA — Flujo visual del usuario ✅ (etapa intermedia, sin lógica de BD)

**Objetivo:** implementar la experiencia pública y las estructuras visuales del usuario autenticado, priorizando el flujo **Escanear QR → Reportar → Seguimiento** y el enfoque **mobile-first**. Sin conectar la lógica definitiva de incidencias (la BD no se consulta en estas pantallas).

Incluye:

- [x] Inicio (§27) con accesos a Reportar / Consultar / Información
- [x] Información (§ uso del sistema + preguntas frecuentes, sin procedimientos [VI])
- [x] Reportar (§28, §49): TarjetaAmbiente (ubicación automática desde QR, no se pide al usuario) + formulario de 3 pasos (tipo → problema → descripción → equipo opcional → foto opcional → urgencia opcional)
- [x] Confirmación (§29): código de incidencia, estado y resumen; botones hacia seguimiento y nuevo reporte
- [x] Seguimiento (§30): búsqueda por código + estado, ambiente, fecha, historial (Timeline + ProgresoEstado)
- [x] Mis incidencias: resumen, búsqueda, filtro por estado y tarjetas enlazadas al seguimiento
- [x] Notificaciones (nueva ruta `/notificaciones`): bandeja con no leídas por ICONO + TEXTO (§50) y enlaces al seguimiento
- [x] Perfil (usuario): resumen de identidad, roles, accesos rápidos, datos y seguridad
- [x] Marca visible `AvisoDemo` en toda maqueta con datos de ejemplo (`lib/demo/datos-ejemplo.ts`)
- [x] Catálogos del formulario en `lib/incidencias-catalogo.ts` (transitorios; la fuente de verdad sigue siendo la BD)
- [x] Navegación del usuario + proxy: `/notificaciones` protegida por sesión

No incluye (por diseño): lectura real de QR, creación de incidencias en BD, subida de evidencias a Storage, notificaciones en tiempo real, confirmación de resolución.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## MÓDULO QR ✅ (Fase 4 del Plan Maestro — genera/prueba con la BD aprobada)

**Objetivo:** QR por ambiente, asociado y rotable, que inicia directamente el flujo de reporte con la ubicación ya resuelta en servidor.

Incluye:

- [x] Esquema existente respetado: `codigos_qr` (código `<SEDE>-<PAB>-<AMB>-<NNNN>` generado por trigger 0003, `url_destino=/r/<codigo>`, `version`, un activo por ambiente — Regla 9) y `lecturas_qr`
- [x] Migración **0011**: RPC SECURITY DEFINER `resolver_qr_publico` + `registrar_lectura_qr` (flujo anónimo sin abrir tablas a anon; RLS 0007 intacta)
- [x] Ruta pública **`/r/<codigo>`**: valida formato y estado en servidor → formulario con TarjetaAmbiente real; QR inexistente → 404 clara; deshabilitado/ambiente inactivo → pantalla 410 clara; error de servicio → pantalla amigable con reintento
- [x] Registro de lecturas vía `POST /api/qr/lectura` (perfil desde sesión de servidor; UA real; nunca parámetros del cliente)
- [x] Panel **`/admin/qr`**: listar (con ambiente/sede/pabellón/piso), buscar/filtrar por estado y sede, **crear** (solo ambientes activos sin QR), **vista previa** modal, **descargar PNG**, **imprimir tarjetas recortables** (solo activos del filtro), **deshabilitar** y **regenerar** (versión + 1, anterior se desactiva por trigger), estado con icono+texto (§50)
- [x] Generación encapsulada en `lib/qr/qr.ts` (librería `qrcode`; contenido = URL estable; cache immutable en `/api/qr/[codigo]/png`)
- [x] Seguridad: el ambiente no se acepta del navegador — la ruta /r lo resuelve por RPC; las acciones admin revalidan rol y RLS decide; sin service-role en cliente

Pendiente del usuario: aplicar migración 0011 en Supabase y probar con sesión ADMINISTRADOR real y QR escaneado desde el teléfono.

## FASE 6 — Incidencias (creación y consulta) ✅ · adjuntos/Storage pendiente

**Objetivo:** módulo central de registro y seguimiento con trazabilidad completa, respetando el esquema aprobado (58 tablas) y RLS.

Incluye:

- [x] Capa de datos `lib/incidencias/` (tipos + consultas con cliente de servidor; RLS decide visibilidad)
- [x] Server Action `crearIncidencia`: identidad del reportante SOLO de la sesión (nunca del cliente), validación de ambiente/tipo/subtipo/prioridad/equipo contra la BD, descripción 10–2000 (CHECK de BD)
- [x] Código único **INC-<AAAA>-<NNNNNN>** generado por la BD (trigger + secuencia anual atómica 0003/0004; sin colisiones, sin hardcodeo); estado inicial Pendiente, prioridad Media y canal QR por trigger (defaults §6.5)
- [x] Catálogos reales desde la BD (tipos/subtipos/prioridades activos; `lib/incidencias-catalogo.ts` queda solo para presentación)
- [x] Formulario (paso 1 tipo→problema, paso 2 descripción, paso 3 equipo opcional + foto + urgencia) conectado a la acción real; navega a confirmación con el código devuelto
- [x] Equipo relacionado opcional: RPC **0012** `equipos_de_ambiente` (SECURITY DEFINER, mismos datos mínimos; RLS de equipos intacta); se vincula en `incidencia_equipos` (dueño vía RLS)
- [x] Confirmación (§29) con código real verificado en servidor (RLS); seguimiento (§30) real con ProgresoEstado + Timeline del historial append-only (`incidencia_historial`)
- [x] `/reportar` ahora es **QR-first**: exige ambiente resuelto en servidor vía `/r/<codigo>` (no se aceptan ambientes del navegador; sin QR no hay formulario)
- [x] Mis incidencias: lista real por RLS con búsqueda y filtro de estado; sin DELETE en la aplicación (nadie lo concede)
- [x] Pantallas amigables ante fallos de servicio (seguimiento y /r ya lo hacían; ahora también seguimiento con reintento)

No incluye (por diseño de la fase): asignación automática, SLA, notificaciones, dashboard técnico, derivación automática, subida de evidencias a Storage (los adjuntos quedan "preparados para integración": el modelo y las políticas ya existen).

Pendiente del usuario: aplicar migración **0012** y probar el flujo completo con sesión real (crear desde QR, confirmación, seguimiento y mis incidencias).

## FASE 6b — Trazabilidad: evidencias, comentarios e historial ✅ · prueba con sesión real pendiente

**Objetivo:** completar la trazabilidad de las incidencias mediante evidencias (Storage privado), comentarios e historial reconstruible, sin auditoría administrativa global (fase posterior).

Incluye:

- [x] **Migración 0013** (`0013_evidencias_trazabilidad.sql`, también en `aplicar_migraciones_supabase.sql`):
  · Triggers de trazabilidad en BD (SECURITY DEFINER, independientes de la app): **CREAR** (`trg_incidencias_historial_crear`), **CAMBIAR_ESTADO/RESOLVER/CERRAR/CANCELAR**, **cambio de prioridad** y **EDITAR** (descripción) en `trg_incidencias_historial_actualizar`, **ASIGNAR** (`trg_asignaciones_historial`) y **DERIVAR** (`trg_derivaciones_historial`) — el historial append-only (D9) se escribe aunque nadie use la app.
  · RPC `adjuntar_evidencia`: valida perfil activo + permiso `adjuntar_evidencia`, autorización (dueño/técnico asignado/admin), tipo (CHECK BD), **MIME y tamaño en servidor** (lista blanca = bucket 0009; 10 MB), path con convención 0009 apuntando a la incidencia, y exige que el objeto exista en Storage antes de registrar metadatos + evento **ADJUNTAR_EVIDENCIA**.
  · RPC `eliminar_evidencia`: **SOLO ADMINISTRADOR** (coherente con `evidencias_delete` 0009); retira objeto del bucket + metadatos y registra **ELIMINAR_EVIDENCIA** en historial.
  · RPC `agregar_comentario`: dueño o técnico asignado con permiso `comentar_incidencia`; nota interna solo técnico/admin ([VI]); registra **COMENTARIO**.
  · RPC `url_firma_evidencia`: signed URL de 5 min generada EN SERVIDOR (misma autorización que `evidencias_select`; buckets nunca públicos).
  · `path_evidencia_valido` relajada a mayúsculas/minúsculas para el segmento de sede (coherente con `ck_sedes_codigo`).
- [x] **Subida de evidencias** (`subirEvidencias` en `lib/incidencias/actions.ts`): File real del navegador; MIME/tamaño leídos del binario (no del nombre); extensión del path DERIVADA del MIME validado; path armado en servidor `<sede>/<año>/<incidencia>/<tipo>/<uuid>.<ext>`; upload al bucket privado con el JWT (policy 0009) + RPC 0013; objeto huérfano se retira si falla el registro; sin service_role.
- [x] **Formulario de reporte**: tras crear la incidencia sube las fotos (tipo "antes") con el id devuelto por la acción; validación temprana en cliente solo como UX; si falla la subida el reporte NO se pierde (se informa).
- [x] **Visualización** (seguimiento): galería con vista previa de imágenes, icono+texto para documento/video (§50), metadatos (tamaño, quien subió), etiqueta antes/durante/despues/documento/video y enlace "Ver / descargar" con signed URL temporal; "Sin acceso" si la firma no aplica.
- [x] **Eliminación por política**: botón visible solo para ADMINISTRADOR (`puede_eliminar` calculado en servidor vía RPC `soy_administrador`); ConfirmDialog destructivo; la RPC lo vuelve a imponer en BD.
- [x] **Comentarios**: hilo en la vista de seguimiento con autor/fecha, marca de nota interna, formulario con contador (1–3000) y acción de servidor con permisos; filtro visual de internos pendiente a fase técnico (hoy RLS los muestra solo a quien puede verlos por ser técnico/admin; el dueño no puede crearlos).
- [x] **Historial + Timeline**: el historial append-only alimenta la Timeline con actor y detalle; eventos normalizados (estado, prioridad, asignación, derivación, edición, ADJUNTAR_EVIDENCIA, ELIMINAR_EVIDENCIA, COMENTARIO).
- [x] **Seguridad de archivos**: buckets privados (0009); binarios SOLO en Storage, en BD únicamente referencia + metadatos (§2.5); validación MIME/tamaño doble (bucket + RPC) y tripe para la UX (cliente); identidad del actor siempre de la sesión; RLS/policies deciden el acceso real.
- [x] `lib/incidencias/evidencias.ts`: reglas compartidas cliente/servidor en módulo isleto (sin dependencias de servidor).
- [x] `lib/incidencias/formato.ts`: tamaños legibles para metadatos de evidencias.

No incluye (por diseño de la fase): reclasificación antes/durante/despues por el técnico, auditoría administrativa global (`registros_auditoria`), ni confirmación de resolución con encuesta (flujo posterior).

**Pendiente del usuario:** aplicar la migración **0013** en Supabase (SQL Editor o el script acumulado) y probar con sesión real: reporte con foto, visualización en seguimiento, comentario, y (con ADMINISTRADOR) eliminación de evidencia.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 7 — Módulo operativo del TÉCNICO ✅ · prueba con usuario técnico pendiente

**Objetivo:** dashboard, listas y atención completa de incidencias asignadas, con la lógica de flujo y la autorización EN LA BASE DE DATOS (migración 0014). Sin derivación automática, sin SLA automático y sin notificaciones (por diseño de la fase).

Incluye:

- [x] **Migración 0014** (`0014_acciones_tecnico.sql`, también en `aplicar_migraciones_supabase.sql`):
  · Tabla `incidencia_tecnicos` (1:1 con incidencia): **diagnóstico**, **acciones** (log cronológico) y **solución**; RLS: técnico asignado lee/escribe, dueño y admin leen.
  · RPC SECURITY DEFINER con revalidación completa en BD (asignación activa + perfil activo + permiso del rol + **transición de estado válida**): `tecnico_aceptar_incidencia` (Asignada→En proceso, fija `aceptado_en` y `fecha_inicio`), `tecnico_cambiar_estado` (transiciones válidas: Asignada→En proceso, En proceso↔En espera; motivo obligatorio al pausar [VI]), `tecnico_registrar_diagnostico`, `tecnico_registrar_accion`, `tecnico_resolver_incidencia` (En proceso→Resuelta, solución obligatoria, fija `fecha_resolucion`), `tecnico_registro_de_incidencia` (lectura) y `transicion_tecnico_valida` (máquina de estados como fuente de verdad).
  · Cada RPC deja evento en el historial append-only (DIAGNOSTICO, REGISTRAR_ACCION, SOLUCION, CAMBIAR_ESTADO); el técnico NO cierra ni cancela (el cierre lo confirma el reportante, RLS 0007).
- [x] **Estados respetados** (semilla 0005, sin inventar nuevos): Pendiente → Asignada → En proceso ↔ En espera → Resuelta → Cerrada/Cancelada; las transiciones posibles del técnico viven en `transicion_tecnico_valida` (BD), no en la UI.
- [x] **Dashboard técnico**: 4 KPIs contados en servidor (asignadas/en proceso/en espera/resueltas), listas "Por atender" y "En atención", y tabla completa con búsqueda/filtros.
- [x] **Mis incidencias**: lista de asignaciones activas (JOIN con `incidencia_asignaciones` activa + RLS) con búsqueda por código/ambiente/tipo y filtros por estado y prioridad (cliente, sobre datos ya filtrados por RLS).
- [x] **Vista de atención** (`/tecnico/incidencias/[codigo]`): código, ambiente, ubicación, tipo, subtipo, prioridad, descripción, equipo relacionado, reportante, técnico asignado, fecha de reporte, **SLA informativo** cuando existe acuerdo para la prioridad (sin cálculo automático), timeline del historial, comentarios (con nota interna), evidencias (galería + subida) y formularios de flujo.
- [x] **Acciones del técnico**: aceptar, iniciar (implícito al aceptar/reanudar), diagnóstico, comentario, evidencia (tipo "durante"), registrar acción, poner en espera/reanudar (con motivo) y resolver (con solución obligatoria en modal).
- [x] **Historial** (`/tecnico/historial`): incidencias fuera del flujo activo (Resueltas/Cerradas/Canceladas).
- [x] **Seguridad**: cada Server Action delega en RPC que revalida en PostgreSQL; un técnico SIN asignación activa recibe rechazo de la BD aunque manipule la UI; los datos leídos pasan por RLS 0007/0009; sin service_role.

**Pendiente del usuario:** aplicar la migración **0014** en Supabase y probar con un usuario TÉCNICO real (con fila en `tecnicos` y `tecnico_area_admin` si aplica): aceptar → diagnosticar → acción → evidencia → en espera → reanudar → resolver; verificar que otro técnico sin asignación reciba rechazo de la BD.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 7 — Administración (panel admin base) ✅ · pruebas CRUD con sesión real pendientes

**Objetivo:** panel administrativo base con estructura completa (§33) y CRUD de las entidades que ya existen en la base de datos. SIN lógica avanzada de derivación, SLA, notificaciones, reportes ni auditoría administrativa (fases posteriores).

Incluye:

- [x] **Dashboard administrativo** (`/admin`): KPIs contados en servidor con RLS (usuarios activos, técnicos operativos, incidencias abiertas/total, sedes y ambientes activos, equipos, QR activos), desgloses simples por estado y tipo, últimas incidencias y accesos a los módulos.
- [x] **Arquitectura declarativa** (`lib/admin/entidades.tsx`): cada entidad administrable declara tabla, campos (tipos, rangos, CHECK replicados), columnas, filtros y jerarquía. Una sola implementación CRUD genérica sirve a todas.
- [x] **CRUD genérico** (`lib/admin/acciones.ts` + `components/admin/*`): crear/editar/activar-desactivar con validación en servidor contra la definición declarativa, confirmación de acciones, estados vacíos, loading (`app/admin/loading.tsx`) y error boundary con reintento (`app/admin/error.tsx`). Sin DELETE físico (docs/01 §2.7): solo desactivación.
- [x] **Seguridad en profundidad**: guardia de servidor (`lib/admin/guardia.ts`) exige sesión + rol ADMINISTRADOR (JWT) + permiso efectivo del grupo (RPC `tiene_permiso`: gestionar_infraestructura/organizacion/equipos/usuarios/qr); RLS de la migración 0007 (p_*_admin) vuelve a decidir en PostgreSQL. La UI solo oculta, nunca autoriza.
- [x] **Usuarios** (`/admin/usuarios`): listado de perfiles con roles (RLS p_perfiles_admin), búsqueda por nombre/correo/documento, filtros por estado y rol, ficha de roles (asignar/retirar con RPC `sincronizar_roles_auth` para refrescar el claim del JWT), suspensión/reactivación de cuentas. Blindajes: nadie puede quitarse su propio rol ADMINISTRADOR ni cambiar el estado de su propia cuenta. Credenciales: SOLO Supabase Auth.
- [x] **Roles y permisos** (`/admin/roles`): CRUD de roles y permisos + MATRIZ rol↔permiso editable (`alternarPermisoRol` sobre roles_permisos) con confirmación por cambio.
- [x] **Infraestructura** (`/admin/infraestructura/*`): CRUD de sedes, pabellones, pisos, **tipos de ambiente** (Aula, Laboratorio, Oficina, Auditorio, Biblioteca, Baño, Taller, Almacén, Otro — semilla 0005, editable por el admin), ambientes, **aulas y laboratorios como tablas hijas 1:0..1** y **características de ambientes** (capacidad, proyector, computadoras, internet, A/A, pizarra); filtros jerárquicos (sede/pabellón/tipo) y cascadas en los formularios (sede→pabellón→piso); códigos y padres marcados de solo creación (la BD impone UNIQUE/CHECK).
- [x] **Organización** (`/admin/organizacion/*`): áreas, servicios, especialidades y **técnicos** (ficha operativa 1:0..1 sobre un perfil: área/sede/carga, uq_tecnicos_perfil; activar/desactivar disponibilidad).
- [x] **Equipos** (`/admin/equipos/*`): catálogos de categorías, marcas, **modelos** (únicos por marca) y estados del ciclo de vida + **inventario de equipos** (código interno único, serie opcional única, cascada marca→modelo en el formulario) + **asignaciones equipo↔ambiente** (a lo sumo una activa por equipo; el trigger 0003 cierra la anterior y registra el movimiento) + **movimientos** (historial de ubicaciones; solo lectura desde la app).
- [x] **Migración 0015** (`0015_admin_catalogos_completos.sql`): re-declara idempotente `uq_modelos_equipos_marca_nombre` y `uq_tecnicos_perfil` (sin cambiar el modelo de 58 tablas).
- [x] **QR** (`/admin/qr`, ya existente en la Fase 4 del Plan): integrado a la navegación admin y a los KPIs del dashboard.
- [x] Mapeo de errores PostgreSQL → mensajes accionables en español (uniques, FK restrict, CHECK, permisos).

No incluye (por diseño de la fase): derivación automática, SLA automático, notificaciones, reportes/analítica, auditoría global, turnos, base de conocimiento, plantillas de notificación.

**Integridad garantizada en BD (no en la UI):** ambientes únicos por estructura (`uq_pisos_pabellon_numero`, `uq_ambientes_codigo`), FK restrict hacia padres con dependencias (no se puede desactivar ni reasignar lo inexistente), `uq_asignacion_equipo_activa` (una ubicación activa por equipo), sin borrado físico (solo desactivación).

**Nota de datos:** la arquitectura es multi-sede; la Filial Ica es solo la primera filial en operar. NO se sembraron inventarios ni infraestructura "real" de UPSJB: para pruebas usar registros marcados explícitamente como DEMO/TEST (p. ej. sede "DEMO — Filial de prueba (TEST)"), separados de los datos institucionales.

**Pendiente del usuario:** aplicar las migraciones 0001–**0015** si falta alguna (0015 va también al final de `aplicar_migraciones_supabase.sql`) y probar con sesión ADMINISTRADOR real: crear/editar/desactivar registros de cada entidad, asignar/retirar roles (verificar que el usuario afectado recupera el panel correcto al re-autenticar), suspender una cuenta, verificar el rechazo con un rol no-admin, y probar el ciclo de equipos: equipo → asignación a ambiente → reasignación (revisar movimientos generados).

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 8a — Reglas de clasificación, asignación y derivación ✅ · prueba con sesión real pendiente

**Objetivo:** implementar el flujo Crear → Clasificación → Evaluación de reglas → Área/servicio → Asignación o derivación → Atención (Plan Maestro §6, §18, §36, §40), con reglas CONFIGURABLES por el administrador (ningún caso hardcodeado en el código) y auditoría completa.

Incluye:

- [x] **Migración 0016** (`0016_reglas_derivacion.sql`, también al final de `aplicar_migraciones_supabase.sql`):
  · RPC `evaluar_reglas_enrutamiento(tipo, subtipo)`: primera regla activa que coincide, ordenada por `prioridad_orden`; una regla con SUBTIPO específico pisa a la del tipo completo; un reporte sin subtipo solo matchea reglas de tipo. Verifica que área/servicio destino estén activos. Sin coincidencia → NULL (ausencia de regla: el ticket queda Pendiente).
  · RPC `clasificar_incidencia(id, origen)`: aplica la regla → derivación INICIAL (área/servicio destino, motivo con el nombre de la regla aplicada), prioridad por defecto de la regla y estado Pendiente → Derivada. Sin regla: deja constancia en `registros_auditoria` y devuelve NULL. Corre automáticamente tras `crearIncidencia` (Server Action) y manualmente con «Evaluar reglas».
  · RPC `derivar_incidencia(id, area, servicio, motivo)`: DERIVACIÓN MANUAL AUTORIZADA — admin, coordinador del área destino vigente o permiso `derivar_incidencia`; motivo obligatorio (5–500), servicio ∈ área, estados finales excluidos, cierra la asignación activa previa, estado → Derivada, auditoría `DERIVAR` + historial (trigger 0013 `trg_derivaciones_historial`).
  · RPC `asignar_incidencia(id, tecnico)`: ASIGNACIÓN MANUAL AUTORIZADA — admin o coordinador del área vigente con permiso `asignar_incidencia`; el técnico debe estar ACTIVO en el área destino vigente; estado → Asignada; auditoría `ASIGNAR` + historial (trigger `trg_asignaciones_historial`).
  · Trigger `trg_reglas_auditoria`: INSERT/UPDATE/DELETE sobre `reglas_enrutamiento` desde la API queda en `registros_auditoria` (`MODIFICAR_CONFIGURACION`, valores previos/nuevos) — append-only (0004).
  · RPC `derivacion_activa_de_incidencia(id)`: lectura del destino vigente para la UI.
- [x] **Integración en el flujo**: `crearIncidencia` invoca `clasificar_incidencia` tras el INSERT (un fallo de clasificación NO invalida el reporte); `lib/incidencias/actions.ts` expone `clasificarIncidencia`, `derivarIncidencia` y `asignarTecnicoIncidencia` que delegan en las RPC.
- [x] **Datos**: `listarDerivacionesDeIncidencia` (historial de traslados con motivo/regla, quién y cuándo; el área/servicio responsable = fila activa), `listarAreasActivas`, `listarServiciosPorArea`, `listarTecnicosPorArea`; `IncidenciaDetalle` ahora incluye `area_responsable`, `servicio_responsable` y `derivaciones`.
- [x] **UI**: seguimiento muestra «Área responsable» y el **Panel de gestión** (Evaluar reglas / Derivar / Asignar técnico) cuando el lector tiene permisos; la vista técnica muestra el área responsable; modal de derivación con cascada área→servicio y motivo obligatorio.
- [x] **Administración de reglas** (`/admin/configuracion`, entidad declarativa `reglas` sobre `reglas_enrutamiento`): CRUD completo con cascadas tipo→subtipo y área→servicio, orden de evaluación, prioridad por defecto y activar/desactivar (la regla deshabilitada sale del flujo sin borrarse). Autorización: guardia admin (grupo `configuracion` → RPC `tiene_permiso('gestionar_reglas')`) + policy `p_reglas_admin` (0007: admin o coordinador con `gestionar_reglas`).
- [x] **Auditoría**: creación/edición/desactivación de reglas y cada aplicación de regla (coincidente o no) quedan en `registros_auditoria`; la derivación/asignación manual deja `DERIVAR`/`ASIGNAR` con actor, motivo y valores.

No incluye (por diseño de la fase): SLA avanzado (los acuerdos siguen informativos), notificaciones por correo, cancelación/reasignación del coordinador como flujo separado, ni reportes de derivaciones.

**Pendiente del usuario:** aplicar la migración **0016** en Supabase y probar con sesión real: crear una regla (SI Técnica+Internet ENTONCES Sistemas/Redes), reportar desde QR y verificar derivación automática + historial + auditoría; derivar/asignar manualmente como coordinador; verificar rechazo con un usuario sin permisos.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 8b — Módulo SLA y seguimiento de tiempos ✅ · prueba con sesión real pendiente

**Objetivo:** implementar el módulo SLA (Plan Maestro §19 y §47, diseño de BD docs/01 §3.9/§8.7 — modelo aprobado): acuerdos configurables, snapshot por incidencia, seguimiento de tiempos, estado (cumplido / en riesgo / vencido) e indicadores. La LÓGICA vive en la BD (RPC SECURITY DEFINER 0017); el reloj del navegador no interviene.

Incluye:

- [x] **Migración 0017** (`0017_sla_seguimiento.sql`, también al final de `aplicar_migraciones_supabase.sql`):
  · **Estado «Derivada»** (Plan §15.4) creado idempotentemente — la semilla 0005 no lo incluía y las RPC 0016 lo usan; renumeración segura (Resuelta→6, Cerrada→7, Cancelada→8, Derivada→5).
  · Columnas de seguimiento en `tiempos_sla` (sin redefinir el modelo): `inicio_en`, `objetivo_respuesta_en`, `objetivo_resolucion_en`, `horas_*_acuerdo` (snapshot), `horas_*_real`, `calculado_en`. Las columnas `horas_habiles_*` (0001) quedan INTACTAS y reservadas para el cálculo hábil [VI] (feriados + turnos).
  · RPC `sla_acuerdo_para`: especialización por TIPO pisa al SLA base de la prioridad (§8.7). Sin acuerdo activo ⇒ incidencia SIN SLA.
  · RPC `registrar_sla_incidencia`: snapshot inmutable (acuerdo, inicio, objetivos = fecha_reporte + horas del acuerdo). Invocada automáticamente por `crearIncidencia` DESPUÉS de la clasificación (respetando una prioridad por defecto de regla) y por el backfill.
  · RPC `refrescar_sla_incidencia`: estampa primera respuesta (`fecha_inicio` = aceptar) y resolución (`fecha_resolucion`), con horas corridas y cumplimiento. EL PRIMER VALOR GANA (idempotente). Invocada por aceptar y resolver del técnico.
  · RPC `estado_sla_respuesta` / `estado_sla_resolucion`: estados puros y deterministas — pendiente/cumplido/vencido y en_tiempo/**en_riesgo** (restante < 25 % del plazo, umbral técnico [P])/cumplido/vencido.
  · RPC `sla_de_incidencia`: lectura para la UI (objetivos, eventos, estados, minutos restantes, % transcurrido) con la MISMA autorización que `p_tiempos_sla_select` (dueño/técnico/admin); sin acceso o sin SLA ⇒ vacío.
  · RPC `slas_asignadas_al_tecnico`: SLA de las asignaciones activas ordenadas por urgencia (vencidos → en riesgo → en tiempo → sin SLA).
  · RPC `indicadores_sla` (§47): promedios de respuesta/atención/resolución, cumplimiento (resp/resol) y activos por estado (en tiempo/en riesgo/vencidos/sin SLA). Definiciones [P]: respuesta = reporte→inicio · atención = inicio→resolución · resolución = reporte→resolución. Admin/coordinador/`ver_reportes`.
  · RPC `registrar_slas_pendientes`: BACKFILL de incidencias creadas antes del módulo (admin o coordinador con `gestionar_reglas`).
- [x] **Configuración**: CRUD de acuerdos en `/admin/configuracion/sla` (entidad declarativa `sla` sobre `acuerdos_nivel_servicio`, grupo `configuracion` → `gestionar_reglas` + policy `p_sla_admin` 0007). Horas por prioridad (+ especialización por tipo) totalmente CONFIGURABLES; ningún tiempo hardcodeado. Botón «Registrar SLA pendientes» (backfill).
- [x] **UI de seguimiento**: `PanelSla` (componente reutilizable) en seguimiento y en la vista técnica: objetivos, vencimiento, respuesta, estado con chip visual, barra de progreso y cuenta regresiva. Sin acuerdo ⇒ «Sin SLA configurado».
- [x] **Dashboards**: técnico con KPIs vencidos/en riesgo/en tiempo y lista «Prioridad de atención»; admin con la tarjeta de indicadores §47 (promedios, cumplimiento, activos fuera de SLA).
- [x] **Tiempos y zona horaria**: timestamptz SIEMPRE en BD (D11); el único «ahora» es `now()` de PostgreSQL; presentación en `America/Lima` con `lib/fechas`. Formato/Tipos en `lib/incidencias/sla-formato.ts` (isleto, importable por client components); lecturas en `lib/incidencias/sla.ts`; acciones en `lib/incidencias/sla-actions.ts`.
- [x] **Pruebas**: `supabase/pruebas_sla.sql` — 7 escenarios con PASS/FAIL y limpieza de datos TEST: cálculo de objetivos, eventos por cambio de estado (+ idempotencia), SLA cumplido, en riesgo, vencido, incidencia SIN SLA y especialización por tipo.

Decisiones de alcance (sin inventar política institucional):

- **Sin pausas por «En espera»**: el modelo aprobado no contempla columnas/pa usa de cronómetro (docs/01 §6.9); el cómputo es en HORAS CORRIDAS y la UI lo informa. Una política de pausas requiere validación institucional previa.
- **Horas hábiles**: `feriados` existe (0001) pero el régimen hábil (turnos [VI]) no tiene semilla ni horario oficial; `horas_habiles_*` quedan sin uso hasta entonces.
- **Valores de la semilla** (0005, marcados [VI]) y el umbral «en riesgo» (25 %) NO constituyen política oficial de la UPSJB.

**Pendiente del usuario:** aplicar la migración **0017** en Supabase (o re-ejecutar el script acumulado; todo es idempotente), ejecutar `supabase/pruebas_sla.sql` en el SQL Editor, y probar con sesión real: reportar (verificar snapshot), aceptar/resolver como técnico (eventos y horas), tarjeta SLA en seguimiento, KPIs en ambos dashboards y CRUD de acuerdos como admin.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 9 — Notificaciones internas + Supabase Realtime ✅ · prueba con sesión real pendiente

**Objetivo:** sistema de notificaciones internas con eventos del flujo, plantillas, preferencias y actualización en tiempo real de la bandeja/listas (Plan Maestro §20 y §33; diseño docs/01 §3.10). La escritura de notificaciones vive en la BD (triggers/RPC SECURITY DEFINER 0018); la app solo lee, marca leídas y configura preferencias.

Incluye:

- [x] **Migración 0018** (`0018_notificaciones_realtime.sql`, también al final de `aplicar_migraciones_supabase.sql`):
  · Dominio de eventos ampliado (`derivada`, `sla_alerta`) en `plantillas_notificacion` y `preferencias_notificacion` + plantillas [P] de los nuevos eventos (los 8 originales vienen de 0005).
  · RPC `notificar(destinatario, evento, incidencia)`: aplica **preferencias opt-out** del destinatario y la **plantilla activa** del evento; **dedupe** por evento+incidencia+destinatario no leída.
  · **Triggers de eventos del flujo** (escritura en BD, independiente de la app): `nueva_incidencia` → reportante · `asignada` → técnico asignado · `derivada` → reportante (incluida la derivación inicial) · `en_proceso`/`en_espera`/`resuelta`/`cerrada`/`cancelada` → reportante por cambio de estado · `comentario` → reportante (nunca notas internas) · `sla_alerta` → técnico asignado (RPC `notificar_alertas_sla`, dedupe, invocada por los dashboards).
  · RPC `mis_notificaciones` / `notificaciones_no_leidas`: bandeja y badge con la misma autorización que RLS (`perfil_id = usuario_actual()`).
  · Preferencias: se crean por defecto al registrarse el perfil (trigger `trg_preferencias_al_crear_perfil`); `usuario_quiere_evento` aplica el opt-out en cada notificación.
  · **Realtime**: `notificaciones` publicada en `supabase_realtime` (idempotente). Las tablas operativas (incidencias, etc.) NO se publican: postgres_changes aplica RLS por suscriptor — cada usuario recibe SOLO sus filas.
- [x] **Centro de notificaciones real** (`/notificaciones`): bandeja desde BD (reemplaza la maqueta demo), chip del estado de la incidencia enlazada, **marcar una como leída**, **marcar todas**, y panel de **preferencias** por evento (Server Actions con revalidación en BD).
- [x] **Campana en todos los paneles** (`components/notificaciones/campana-notificaciones.tsx` en `PanelShell`): badge de no leídas en vivo + indicador de estado de conexión.
- [x] **Realtime en la app** (`lib/notificaciones/realtime.tsx` + `PuertaRealtime`): provider por layout (usuario/técnico/admin), suscripción INSERT/UPDATE con reconexión y estados visibles (conectando/conectado/desconectado/error); `RealtimeRefresher` refresca las rutas de servidor (`router.refresh`) — las listas (bandeja, dashboard técnico, mis incidencias) se actualizan solas; los datos SIGUEN viniendo de servidor con RLS.
- [x] **Correo PREPARADO pero INACTIVO**: plantillas de canal 'correo' existen como datos editables; `lib/notificaciones/correo.ts` define el punto de extensión de la cola (devuelve «no configurado» sin tocar la red); variables de entorno documentadas en `.env.example` (sin credenciales, sin valores reales). NADA envía correos hasta que la institución apruebe proveedor.
- [x] **Pruebas**: `supabase/pruebas_notificaciones.sql` — notificación interna + dedupe, lectura (una/todas), permisos (bandeja solo filas propias, policies select/update con usuario_actual), preferencias (opt-out silencia), publication realtime correcta. Limpieza de datos TEST.

**Pendiente del usuario:** aplicar la migración **0018** (o re-ejecutar el script acumulado; todo es idempotente), ejecutar `supabase/pruebas_notificaciones.sql`, y probar con sesión real: reportar → ver la campana subir en tiempo real; abrir la bandeja, marcar leídas, cambiar preferencias; verificar con dos usuarios que nadie recibe notificaciones ajenas; cortar la red y observar el estado de reconexión.

**Verificación:** `npm run typecheck` y `npm run build` sin errores.

## FASE 10 — Dashboard analítico y reportes ✅ · prueba con sesión real pendiente

**Objetivo:** dashboard administrativo con indicadores operativos, de tiempo, ubicación, equipos y áreas; gráficos, filtros y exportación (Plan Maestro §47/§48). Toda la AGREGACIÓN vive en Postgres (RPC 0019) — nada se cuenta en el frontend; la autorización también vive en la BD (admin / coordinador / permiso `ver_reportes`).

Incluye:

- [x] **Migración 0019** (`0019_reportes_analiticos.sql`, también al final de `aplicar_migraciones_supabase.sql`):
  · **Vista `v_reportes_incidencias`** (SECURITY_INVOKER): 1 fila por incidencia con catálogos, jerarquía de ambientes (sede/pabellón/piso), área/servicio vigente (derivación activa), equipo principal, técnico activo y SLA (horas reales + banderas de cumplimiento). Al consultarla se aplican las policies RLS de cada tabla subyacente: no amplia accesos.
  · RPC `indicadores_analiticos`: KPIs operativos (total, pendientes, en proceso, resueltas, cerradas, por prioridad, derivadas) y de tiempo (promedios de respuesta/atención/resolución, fuera de SLA, sin SLA) con filtros server-side.
  · RPC `series_analiticas(p_serie, …)`: series agregadas con GROUP BY por estado / prioridad / tipo / área / ambiente / sede / pabellón / piso / equipo / categoría / evolución mensual (America/Lima) / tiempo de atención por servicio. IF/ELSE con serie validada — sin SQL dinámico.
  · RPC `reporte_detalle`: tabla paginada con SECURITY INVOKER (RLS del lector); alimenta la vista y la exportación CSV.
  · RPC `reporte_filtros`: opciones activas para los `<select>`.
  · Autorización: administrador / coordinador / `ver_reportes` (mismo criterio que `indicadores_sla`, 0017); sin permiso → excepción controlada.
- [x] **Página `/admin/reportes`** (reemplaza el placeholder): KPIs operativos + de tiempo, gráficos **Recharts v3** (donut por estado, barras por prioridad/tipo/área/ambiente/equipos top, línea de evolución mensual, barras de horas por servicio), tabla de detalle y botón de **exportación CSV**.
- [x] **Filtros compartibles en la URL** (desde/hasta/sede/área/estado/prioridad/tipo): formulario cliente que hace `router.push` y servidor que re-parsea con validación estricta (fechas YYYY-MM-DD, UUID, longitudes) antes de tocar la BD.
- [x] **Exportación CSV en servidor** (`/admin/reportes/csv`): autorización con la misma matriz que la RPC; escapa comillas y prefija fórmulas (OWASP CSV); genera el archivo desde `reporte_detalle` (RLS del lector, sin BYPASS).
- [x] **Estados sin datos** (`SinDatos` con mensaje por gráfico), **loading** propio (`loading.tsx` con esqueletos de KPIs/gráficos) y **manejo de errores** (errores controlados por tarjeta; el error boundary del panel `app/admin/error.tsx` cubre fallos de render).
- [x] **Pruebas**: `supabase/pruebas_reportes.sql` — agregados con semilla controlada, filtros (estado/fechas), tiempos y fuera de SLA (cumplido vs vencido con promedio esperado 52.0 h), permisos (sin rol → excepción), RLS en `reporte_detalle` (el dueño ve solo lo suyo), filtros imposibles → ceros, serie desconocida → excepción. Limpieza TEST.

**Pendiente del usuario:** aplicar la migración **0019** (o re-ejecutar el script acumulado; idempotente), ejecutar `supabase/pruebas_reportes.sql`, y probar con datos reales: filtros combinados, cálculos contra incidencias conocidas, exportación CSV y responsive (los gráficos usan `ResponsiveContainer`; en móvil apilan a una columna).

**Verificación:** `npx tsc --noEmit` y `npm run build` sin errores (el proyecto no tiene ESLint configurado).

## FASE 11 — Auditoría + revisión de seguridad ✅ · prueba con sesión real pendiente

**Objetivo:** registro de auditoría de acciones importantes (Plan §41) y revisión profunda de seguridad (§49). La escritura de auditoría vive en la BD (triggers/RPC); la consulta administrativa es read-only y la protección de registros es append-only a nivel de BD.

Incluye:

- [x] **Migración 0020** (`0020_auditoria_seguridad.sql`, también al final de `aplicar_migraciones_supabase.sql`):
  · RPC `auditar(accion, tabla, registro, codigo, previos, nuevos)`: registro con actor (auth.uid()), fecha/hora (now()), acción (dominio 0001 validado), entidad, identificador y valores previos/nuevos JSONB (información para reconstruir el evento). Sin SQL dinámico.
  · RPC `consultar_auditoria(...)`: consulta administrativa con filtros (acción, tabla, registro, actor, fechas, búsqueda de texto en código/JSON) + paginación; misma autorización que p_auditoria_select (admin + `ver_auditoria`). Une perfiles para mostrar al actor.
  · Cobertura de eventos: LOGIN/LOGOUT (triggers en auth.users_sessions → sesiones_usuario + espejo en auditoría) · CAMBIAR_ESTADO (aceptar/cambiar, RPC 0014 redefinidas) · RESOLVER (RPC 0014) · CERRAR/ANULAR (trigger en incidencias al pasar a estado final) · ADJUNTAR_EVIDENCIA (trigger en incidencia_adjuntos) · MODIFICAR_CONFIGURACION/ANULAR (triggers en acuerdos_nivel_servicio, reglas_enrutamiento, plantillas_notificacion, feriados, roles, permisos, roles_permisos, usuarios_roles). DERIVAR/ASIGNAR/CREAR ya quedaban de 0016/0004.
  · Fortaleza de grants: revoke a public/anon en RPCs sensibles.
  · VERIFICACIÓN global: falla si alguna tabla public.* quedó sin RLS; la publication `supabase_realtime` se auto-limpia para dejar SOLO notificaciones.
- [x] **Página `/admin/auditoria` real** (reemplaza el placeholder): bandeja paginada de registros con chip de acción, tabla, código, actor y fecha (America/Lima); filtros por acción/tabla/búsqueda/fechas en la URL; detalle JSON de valores previos/nuevos; loading propio. Errores controlados (sin permiso → mensaje, no 500).
- [x] **Protección de registros** (ya existía, verificada): SELECT solo admin con `ver_auditoria`; sin policies INSERT/UPDATE/DELETE para la API; trigger append-only de 0004 bloquea UPDATE/DELETE incluso para el dueño del esquema.

### Informe de seguridad (Fase 11)

**Problemas encontrados y corregidos:**
1. **Eventos de auditoría faltantes** en flujo técnico (aceptar/cambiar estado/resolver), cierre del reportante, adjuntos y cambios de configuración → corregido con RPCs redefinidas y triggers en BD (0020), sin depender de la app.
2. **Límite servidor/cliente** (`lib/auditoria/datos.ts` importado por un client component, trae `next/headers` → build falla) → corregido con módulo isleto `lib/auditoria/constantes.ts` (mismo patrón que sla-formato.ts).
3. **Grants públicos por defecto** en RPCs sensibles (EXECUTE a public/anon) → revocados a public/anon, concedidos solo a authenticated (0020 §8).
4. **Publication realtime** podía contener tablas extra → verificación que la auto-limpia a solo `notificaciones` (0020 §9).
5. **Sin verificación global de RLS** → check que falla la migración si cualquier tabla public.* queda sin `row security` activado.

**Verificado sin hallazgos (correcto de origen):**
- RLS por rol: estudiante/usuario ve solo sus incidencias (p_incidencias_select); técnico activo ve el flujo operativo; coordinador solo su área vigente (soy_coordinador_de_area); admin/supervisor con permisos; UPDATE del dueño limitado a confirmar cierre (congelando descripción/prioridad/ambiente/tipo); **DELETE de incidencias: nadie** (sin policy; la app no llama .delete() a incidencias en ningún punto).
- Rutas protegidas en tres capas: proxy (redirección por panel) + guards de layout (getUser + panel) + RLS final en BD.
- Server/client boundaries: toda operación privilegiada en Server Actions/RPC; el cliente solo envía identificadores validados (UUID/regex) — nunca paths de Storage, ids de usuario ni estados.
- Variables de entorno: solo NEXT_PUBLIC_SUPABASE_URL/ANON_KEY y NEXT_PUBLIC_SITE_URL en el bundle; **service_role no existe en el código** (documentado como prohibición); .env.example sin valores reales.
- Storage: buckets privados; evidencias con path generado en servidor y policies por dueño/técnico/admin (path_evidencia_valido); DELETE solo admin.
- IDOR/acceso cruzado: cada lectura/escritura revalida en BD (RLS o RPC); el seguimiento por código devuelve «no existe» tanto ante inexistente como ante no autorizada (sin filtrar información).
- Validación de inputs: límites de longitud, regex de código INC-, UUID, MIME y tamaño de archivos validados en servidor (además de BD).

**Riesgos pendientes (documentados, no corregibles en código):**
- Los triggers de LOGIN/LOGOUT en `auth.users_sessions` dependen de que GoTrue escriba ahí; validar tras el primer login real (si el proyecto usa otra tabla de sesiones, migrar el trigger).
- La auditoría de sesión guarda user_agent sin normalizar (tamaño acotado por GoTrue).
- La RPC `auditar` es ejecutable por authenticated (necesario para RPCs del sistema); abusa solo si alguien autenticado la invoca directamente con datos falsos — mitigable en producción revocando EXECUTE a authenticated y llamándola solo desde SECURITY DEFINER ya existentes.
- Pruebas SQL marcadas como pendientes de ejecución por el usuario (requieren proyecto Supabase real).

**Pruebas:** `supabase/pruebas_auditoria.sql` — registro completo vía auditar, dominio de acciones inválido, consulta con filtros y paginación, permisos (sin rol → excepción), append-only (UPDATE/DELETE bloqueados), auditoría de configuración SLA (INSERT+UPDATE+DELETE → MODIFICAR_CONFIGURACION/ANULAR), RLS global y publication realtime. Limpieza TEST (los registros de auditoría TEST permanecen: es inmutable por diseño).

**Verificación:** `npx tsc --noEmit` y `npm run build` sin errores (el proyecto no tiene ESLint configurado).

## FASE 12 — Refinamiento UX/UI ✅

**Objetivo:** pulido de experiencia sin funcionalidades nuevas ni cambios de modelo/arquitectura (Plan §50). Revisión completa de pantallas con foco en el flujo móvil prioritario QR → Reportar → Confirmación → Seguimiento.

Mejoras aplicadas:

- [x] **Base global (`app/globals.css`)**: foco de teclado siempre visible (outline global), `prefers-reduced-motion` respetado en TODAS las animaciones/transiciones, scroll suave entre anclas y targets táctiles de 44px en inputs/selects con puntero grueso (`pointer: coarse`).
- [x] **Formulario de reporte (flujo prioritario)**: chips de tipo/urgencia con `min-h-11` y aria completo (`(seleccionado)` para lectores), error global con icono + `role="alert"`, botón ENVIAR pegado al fondo en móvil (sticky) con 48px de alto, `aria-describedby` en el submit, label dinámica de progreso (paso X de 3).
- [x] **Confirmación**: botón **Copiar código** real con feedback inmediato (✓ «Copiado», `aria-live`) en lugar del tip de long-press; cabecera centrada y compacta en móvil.
- [x] **Estados sin depender solo del color (§50)**: SLA vencido/en riesgo en el dashboard técnico ahora con badge de borde + icono + texto (no solo texto rojo); KPIs de SLA con `tono` (exito/alerta/peligro) en StatCard (borde + icono teñidos); tabla de reportes con chips de SLA (Cumplido/Fuera de SLA/Sin SLA) con icono + texto + fondo.
- [x] **Modal**: focus automático al abrir, `aria-labelledby/describedby`, botón cerrar con target táctil y foco visible (reduced-motion ya respetado).
- [x] **Toasts**: botón de cierre con área táctil y foco visible (icono + color ya existían).
- [x] **DataTable**: `aria-sort` en encabezados, botones de orden con `aria-label` + foco visible y min-h táctil; paginación ya con aria-labels.
- [x] **Tablas admin**: tabla de detalle de reportes con `min-w-[720px]` + scroll horizontal (usable en móvil sin aplastar columnas) y caption oculto.
- [x] **Ya existente y verificado** (sin cambios): badges de estado/prioridad con icono+texto, EmptyState con icono/título/acción, skeletons en loading.tsx de admin/reportes/auditoria, ConfirmDialog con spinner y deshabilitado durante proceso, toasts con `aria-live`, campana/notificaciones con aria-labels completos, menú móvil con scroll horizontal en PanelHeader, gráficos ResponsiveContainer con estados «Sin datos».

**Framer Motion con moderación (verificado):** FadeIn usa `whileInView` una sola vez y `useReducedMotion`; Modal/Toast tienen duraciones ≤ 0.2s; ninguna animación bloquea interacción ni scroll; con reduce-motion todo queda estático.

**Verificación:** `npx tsc --noEmit` y `npm run build` sin errores (el proyecto no tiene ESLint configurado).

## FASE 13 — Pruebas integrales ✅ (verificación estática + unitarias; pruebas MAN con sesión real pendientes)

**Objetivo:** matriz de pruebas integral (funcionales, seguridad, interfaz, rendimiento) cubriendo los 8 tipos de usuario, el flujo crítico completo y los casos negativos (Plan §52).

Entregables:

- [x] **Matriz completa** en `docs/MATRIZ-PRUEBAS.md`: 18 pruebas funcionales, 22 de seguridad, 9 de interfaz, 7 de rendimiento, cobertura por usuario (público, estudiante, docente, administrativo, técnico, coordinador, administrador, supervisor) y los 14 casos negativos exigidos, cada uno con su estado de ejecución y cómo reproducirlo.
- [x] **Pruebas unitarias ejecutables** `tests/pruebas_unitarias.mjs` (node, sin dependencias): 35 pruebas de lógica pura — códigos QR, códigos INC, UUIDs (anti-IDOR), parseo de filtros, anti open-redirect, escapado CSV (anti-fórmula), extensiones/tamaños de evidencias, formato SLA. **35/35 PASS**.
- [x] **Pruebas SQL** ya listas de fases previas: `supabase/pruebas_sla.sql`, `supabase/pruebas_notificaciones.sql`, `supabase/pruebas_reportes.sql`, `supabase/pruebas_auditoria.sql`.

Fallos encontrados y corregidos (causa raíz, sin ocultar):

1. **Realtime reconectaba en bucle estando conectado** (`lib/notificaciones/realtime.tsx`): el intervalo de reconexión leía `estado` del closure del efecto (siempre "conectando"), así que cada 75 s remontaba el canal aunque estuviera conectado → parpadeos del badge. Causa raíz: closure obsoleto. Corrección: referencia `refEstado.current` actualizada en el callback `subscribe` y leída por el intervalo. Reprobado: reconexión solo cuando el estado ≠ conectado.
2. **Filtros de fecha aceptaban fechas imposibles** (`lib/reportes/datos.ts`, `lib/auditoria/constantes.ts`): la validación era solo de formato (regex) y `2026-13-01` llegaba a la RPC, que fallaba con error 500 al convertir a date. Causa raíz: falta de validación semántica. Corrección: `esFechaValida` (regex + ida y vuelta por `Date`/ISO) en ambos módulos; ahora se degradan a "sin filtro". Reprobado con unitarias (2026-13-01, 2026-02-30 → null).
3. **Errores de test** (no de producto): dominio de acciones y escape de comillas del CSV mal replicados en la primera versión de las unitarias — corregidos para replicar EXACTAMENTE los módulos reales (el producto sí validaba el dominio; el CSV cumple RFC 4180).

Fallos pendientes (identificados, con causa raíz; requieren decisión de alcance):

1. **Paso «confirmación de cierre» sin UI dedicada para el dueño** (F13): el flujo aprobado contempla Resuelta → (reportante confirma) → Cerrada; RLS 0007 ya permite al dueño mover su ticket a Cerrada/Cancelada congelando los demás campos, pero no existe ni la Server Action ni el botón en `/seguimiento`. Causa: el paso quedó fuera del alcance de las fases 6–12 (las fases lo documentaron como «flujo posterior» junto a la encuesta de cierre). No se ocultó: queda registrado como hueco de implementación, no como bug de lo ya implementado. Corrección propuesta: Server Action del dueño (validando estado Resuelta) + botón con ConfirmDialog en seguimiento; en BD no hace falta nada.
2. **`ToastProvider` roto en navegadores sin `Intl.DateTimeFormat` moderno** [riesgo menor, no reproducido]: sin evidencia de fallo en Chrome/Firefox/Safari modernos; solo verificar en el set objetivo (Android Chrome).

Riesgos:

- Las pruebas MAN (con sesión y datos reales) siguen pendientes de ejecución por el usuario: la matriz indica exactamente cómo reproducir cada una.
- Los triggers de LOGIN/LOGOUT dependen de `auth.users_sessions` de GoTrue: validar con el primer login real (S20).
- Rendimiento validado por diseño (agregación en BD, límites, caché de QR); medición de carga con volumen real pendiente.

**Resultado final:** `node tests/pruebas_unitarias.mjs` 35/35 PASS · `npx tsc --noEmit` ✓ · `npm run build` ✓ (el proyecto no tiene ESLint configurado).

## FASE 14 — Optimización pre-despliegue ✅

**Objetivo:** optimización sin funcionalidad nueva ni cambios de comportamiento (Plan §54). Auditoría frontend, Supabase, dashboards, responsive, calidad y SEO.

Problemas encontrados y optimizaciones aplicadas:

1. **Dashboard técnico duplicaba una consulta** (`lib/incidencias/datos.ts`, `app/tecnico/dashboard/page.tsx`): `obtenerKpisTecnico()` re-ejecutaba la misma consulta que `listarIncidenciasAsignadas()` en el mismo request (2× la query de asignaciones con jerarquía). Corrección: los KPIs se derivan de la lista ya cargada (`obtenerKpisTecnico(asignadas)`). Mejora medible: **2 consultas → 1** por carga del dashboard.
2. **Memoización por request** (`lib/incidencias/datos.ts`, `lib/notificaciones/datos.ts`): `cache()` de React en catálogos (tipos, subtipos, prioridades, equipos por ambiente), listados (mis incidencias, asignadas) y notificaciones (bandeja, contador, preferencias). El layout pide el contador y la página la bandeja: ahora comparten memo cuando coinciden los parámetros. Mejora medible: elimina consultas duplicadas layout↔página en el mismo render.
3. **Dashboard admin traía hasta 2×2000 filas para contar en memoria** (`lib/admin/datos.ts`): los desgloses por estado/tipo descargaban filas y agregaban en JS. Corrección: usa la RPC `series_analiticas` (0019, GROUP BY en Postgres) que ya existía de la Fase 10; degrada a vacío si la RPC no está aplicada. Mejora medible: **hasta ~4000 filas por carga → ~30 filas de resultados agregados**.
4. **Recharts (~410 KB sin comprimir ≈ 130 KB gzip) cargado como chunk común** (`app/admin/reportes/page.tsx`, nuevo `components/reportes/panel-graficos.tsx`): los gráficos ahora son puntos de entrada `next/dynamic` (client) con skeleton; el chunk de Recharts solo se descarga al pintar /admin/reportes. Mejora medible: **~410 KB fuera de la carga inicial de todas las demás rutas** (chunk 02_*.js separado verificado en la build).
5. **Canal Realtime compartido entre usuarios** (`lib/notificaciones/realtime.tsx`, `components/notificaciones/puerta-realtime.tsx`, layouts): el nombre de canal era global (`notificaciones-usuario`); ahora lleva sufijo por `usuarioId`. La seguridad no cambia (RLS filtra por suscriptor), pero cada socket solo procesa su flujo. Corrección también reactiva el efecto si cambia el usuario (login/logout en caliente).
6. **SEO/metadata** (root layout, `app/(public)/layout.tsx`, nuevos `app/robots.ts` y `app/sitemap.ts`): `metadataBase`, OpenGraph (es_PE) y `robots: index:false` por defecto (privado) re-habilitado solo en el grupo público; robots bloquea paneles privados, `/api`, `/auth`, `/r/` y `/seguimiento`; sitemap solo con páginas públicas y URL canónica desde `NEXT_PUBLIC_SITE_URL`. Sin exposición de información privada.

Verificado sin cambios necesarios:

- **Índices**: 0002 ya cubre estado, prioridad, tipo, ambiente, fecha_reporte y reportante+fecha en `incidencias`; índice parcial de no leídas en notificaciones; índices únicos parciales (asignación activa, derivación activa, un QR activo).
- **Seguridad intacta**: RLS en todas las tablas (verificación 0020), anon key solo, service_role ausente, buckets privados con signed URLs por evidencia, sin secretos en el bundle (solo NEXT_PUBLIC_* públicas).
- **Server/client boundaries**: todas las consultas en servidor; client components solo presentación/interacción.
- **Responsive**: revisado (Fase 12): grids sm/md/lg, tablas con scroll, targets táctiles, nav móvil.
- **TypeScript estricto**: `strict` compila sin errores; build sin warnings relevantes.
- **Observabilidad**: logging de servidor solo con `console.error` de fallos no-bloqueantes (SLA/clasificación) sin datos sensibles; errores controlados por tarjeta en UI.

Riesgos pendientes: medir tiempos reales con volumen (RPCs ya límitadas); `robots.ts` depende de que el dominio final no requiera reglas extra; el chunk de Recharts sigue descargándose en la primera visita a /admin/reportes (lazy, no eliminado).

**Resultado:** `npx tsc --noEmit` ✓ · `npm run build` ✓ (60/60 páginas; ruta /admin/reportes dynamic ƒ) · unitarias 35/35 ✓ · **sin deploy**.

---

> Pendiente de validación institucional: dominio de producción (antes de imprimir QR), logo oficial, método de autenticación, áreas/servicios reales y plan de Supabase.
