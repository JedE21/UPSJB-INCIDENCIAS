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

## FASE 6 — Incidencias ⬜

- Formulario desde QR (ya integrado visualmente con /r), adjuntos, código único, confirmación, seguimiento/timeline.

## FASE 6 — Incidencias ⬜

- Formulario desde QR, adjuntos, código único, confirmación, seguimiento/timeline.

## FASES 7–13 ⬜

Técnico → Administración → Derivación/SLA → Notificaciones → Analítica → Auditoría/Seguridad → UX/UI → Pruebas.

---

> Pendiente de validación institucional: dominio de producción (antes de imprimir QR), logo oficial, método de autenticación, áreas/servicios reales y plan de Supabase.
