# MATRIZ DE PRUEBAS INTEGRALES · SIR-UPSJB (Fase 13)

Estado de ejecución al cierre de esta fase:

- **EJ** = Ejecutado y verificado en esta fase (revisión estática/código, unitarias `node tests/pruebas_unitarias.mjs` o SQL `supabase/pruebas_*.sql`).
- **MAN** = Requiere sesión real en el sistema de desarrollo (instrucciones de reproducción incluidas).
- **SQL** = Script listo para ejecutarse en Supabase SQL Editor (requiere proyecto conectado).

## 1. Pruebas funcionales

| # | Caso | Rol | Estado | Verificación |
|---|------|-----|--------|--------------|
| F1 | Registro de cuenta (signup institucional) | Público→rol base | MAN | Formulario `/login` → crear cuenta; verificar perfil creado y panel asignado |
| F2 | Login correcto / incorrecto | Todos | EJ (lógica) + MAN | `iniciarSesion` mapea errores sin filtrar existencia; credenciales reales en sesión |
| F3 | Logout y limpieza de sesión | Todos | MAN | Menú → cerrar sesión → `/login?cerrado=1`; back no reintenta sesión |
| F4 | Escanear QR válido → ambiente + formulario | Público/Estudiante | EJ (estático) | `/r/[codigo]`: RPC `resolver_qr_publico`, tarjeta de ambiente, catálogos de BD |
| F5 | Reportar desde QR (3 pasos) con foto opcional | Estudiante/Docente | MAN | `/r/[codigo]` → enviar → confirmación con código real `INC-AAAA-NNNNNN` |
| F6 | Confirmación: copiar código, ver estado | Todos | MAN | `/reportar/confirmacion?codigo=...` verifica en BD antes de mostrar éxito |
| F7 | Seguimiento por código (dueño) | Estudiante | MAN | `/seguimiento?codigo=INC-...` muestra detalle, historial, SLA |
| F8 | Asignación de técnico (manual autorizada) | Coordinador/Admin | MAN | Panel de gestión → asignar → estado Asignada + notificación al técnico |
| F9 | Aceptar asignación (Asignada→En proceso) | Técnico | MAN | Dashboard técnico → aceptar; `fecha_inicio` estampada; auditoría CAMBIAR_ESTADO |
| F10 | Derivación con motivo (área/servicio) | Coordinador área/Admin | MAN | Derivar → auditoría DERIVAR + historial + notificación al reportante |
| F11 | Diagnóstico y acciones registradas | Técnico | MAN | Vista de atención → RPC 0014 guarda registro técnico |
| F12 | Resolución con solución obligatoria | Técnico | MAN | Resolver → Resuelta + fecha_resolucion + SLA final + notificación |
| F13 | Confirmación de cierre por el reportante | Dueño | MAN (ver nota 1) | Ver «Fallos pendientes»: paso de cierre del dueño sin UI dedicada |
| F14 | Cambio a En espera con motivo obligatorio | Técnico | MAN | La BD rechaza En espera sin motivo; UI exige el campo |
| F15 | Estadísticas: dashboard admin KPIs + SLA | Admin | MAN | `/admin` KPIs server-side; `/admin/reportes` con filtros y CSV |
| F16 | Clasificación automática con reglas | Sistema | MAN | Reporte nuevo con regla activa → Derivada; sin regla → Pendiente |
| F17 | SLA snapshot al crear; en riesgo/vencido | Sistema | MAN | `/admin/configuracion/sla` con acuerdos; panel SLA en seguimiento |
| F18 | Notificaciones: bandeja, marcar leída, todas, preferencias | Todos | MAN | `/notificaciones` con sesión real; campana sube en realtime |

## 2. Pruebas de seguridad

| # | Caso | Estado | Verificación |
|---|------|--------|--------------|
| S1 | RLS: estudiante solo ve sus incidencias | EJ (policies) + MAN | p_incidencias_select; probar con 2 usuarios distintos |
| S2 | Técnico: flujo solo con asignación activa | EJ + SQL | RPC 0014 `tengo_asignacion_activa`; supabase/pruebas_sla.sql |
| S3 | Coordinador: solo su área vigente | EJ (policies) | `soy_coordinador_de_area` en select/update |
| S4 | Admin según permisos (matriz) | EJ + MAN | `exigirAdminConPermiso` + p_*_admin; probar CRUD con/sin permiso |
| S5 | Supervisor (solo lectura reportes) | EJ (policies) | `SUPERVISOR + ver_reportes` en select de incidencias; sin UI propia [VI] |
| S6 | QR inexistente → 404 amigable | EJ (estático) | `/r/NOEXISTE-9999` → PantallaNoEncontrado (mismo contrato para formato inválido) |
| S7 | QR deshabilitado / ambiente o sede inactivos → 410 | EJ (estático) | `disponible=false` → PantallaDeshabilitado |
| S8 | Usuario sin permiso no reporta | EJ (policies) | p_incidencias_insert exige perfil activo + crear_incidencia |
| S9 | ID manipulado en UUID → rechazo temprano | EJ (unitarias) | `esUuid` en server actions; tests 3.x |
| S10 | Incidencia de otro usuario: comentario/adjunto bloqueados | EJ (SQL) + MAN | RPC 0013 revalida dueño/técnico; probar con 2 cuentas |
| S11 | Técnico sin asignación: aceptar/resolver rechazados | EJ (SQL) | RPC 0014 lanza «No tienes una asignación activa» |
| S12 | Archivo inválido (MIME/tamaño) | EJ (unitarias) + MAN | Validación triple (cliente/acción/bucket+RPC); tests 7.x |
| S13 | Formulario incompleto → errores por campo, sin envío | EJ (estático) | `validar()` del formulario; nunca llama a la acción |
| S14 | Error de red → mensaje y reintento, sin 500 crudo | EJ (estático) | catch en acciones del formulario; PantallaErrorServicio en QR |
| S15 | Sesión expirada → mensajes claros, sin crash | EJ (estático) | «Sesión expirada» en acciones; proxy revalida con getUser() |
| S16 | RLS bloquea: seguimiento no filtra existencia | EJ (estático) | «Incidencia no encontrada» igual para inexistente y ajena |
| S17 | Auditoría append-only (sin UPDATE/DELETE) | SQL | supabase/pruebas_auditoria.sql prueba 5 |
| S18 | Consulta de auditoría sin permiso → excepción | SQL | supabase/pruebas_auditoria.sql prueba 4 |
| S19 | Realtime seguro: solo notificaciones; RLS por suscriptor | SQL + MAN | pruebas_notificaciones.sql; publicaciones verificadas en 0020 |
| S20 | Auditoría de sesión LOGIN/LOGOUT | MAN (nota 2) | Trigger en auth.users_sessions; validar tras primer login real |
| S21 | Rutas protegidas por panel (proxy + guard + RLS) | MAN | Estudiante → /admin debe redirigir a acceso-restringido |
| S22 | Storage: buckets privados, DELETE solo admin | EJ (policies) | 0009 evidencias_delete; probar URL directa sin sesión |

## 3. Pruebas de interfaz

| # | Caso | Estado | Verificación |
|---|------|--------|--------------|
| I1 | Desktop 1280–1920: dashboards en grilla, sin desbordes | EJ (código) | lg:grids; tablas con scroll horizontal (min-w) |
| I2 | Tablet 768: 2 columnas, navegación superior | EJ (código) | sm/md breakpoints en dashboards y formularios |
| I3 | Android/móvil 360–430: flujo QR completo usable | EJ (código) + MAN | Botón enviar sticky 48px, chips táctiles, inputs 44px (pointer coarse) |
| I4 | Navegación móvil con scroll horizontal | EJ | PanelHeader mobile nav; labels con aria |
| I5 | Estados sin depender solo de color (icono+texto+badge) | EJ | Badges, KPIs con `tono`, chips de SLA en reportes |
| I6 | Focus de teclado visible en toda la app | EJ | outline global + focus-visible en componentes |
| I7 | prefers-reduced-motion: sin animaciones | EJ | globals.css + useReducedMotion en Modal/Toast/FadeIn |
| I8 | Formularios: labels asociados, aria-invalid, errores con texto | EJ | FormField + inputs aria; formulario reporte/filtros |
| I9 | Toasts accesibles (aria-live, botón cerrar táctil) | EJ | ToastProvider en layout raíz |

## 4. Pruebas de rendimiento

| # | Caso | Estado | Verificación |
|---|------|--------|--------------|
| R1 | Agregación de reportes en Postgres (no frontend) | EJ (diseño) | RPC 0019 con GROUP BY; índices 0002 en columnas de join/filtro |
| R2 | Conteos de dashboard con count(head) exactos | EJ (código) | `contar()` con head:true; sin traer filas |
| R3 | Consultas de listas acotadas con límites | EJ | límites en RPCs (200 auditoría, 500 CSV, 12 series) |
| R4 | Imágenes QR cacheables 1 año (immutable) | EJ | `/api/qr/[codigo]/png` Cache-Control; contenido estable por diseño |
| R5 | Evidencias: vista previa local, subida secuencial, revoke URLs | EJ (código) | FileUpload revoca objectURL; sin miniaturas en BD |
| R6 | Realtime con reconexión sin micro-cortes | EJ (corregido) | Bug de closure obsoleto corregido (ver fallos); backoff 15s |
| R7 | Dashboard sin bloquear por fallo de alertas SLA | EJ | try/catch en dashboards; fallo no rompe carga |

## 5. Cobertura por tipo de usuario (mínimo exigido)

| Usuario | Flujos cubiertos | Referencias |
|---------|------------------|--------------|
| 1. Público | QR → identificación ambiente; seguimiento por código; login requerido para reportar | F4, F7, S6, S7 |
| 2. Estudiante | Reportar, mis incidencias, notificaciones, seguimiento propio | F5, F7, F18, S1 |
| 3. Docente | Igual que estudiante (mismo panel usuario) | igual 2 |
| 4. Administrativo | Igual que estudiante; sin permisos de gestión | igual 2, S4 |
| 5. Técnico | Dashboard, aceptar, cambiar estado, en espera, diagnóstico, resolver, SLA | F9, F11, F12, F14 |
| 6. Coordinador | Derivar, asignar, gestionar área vigente | F8, F10 |
| 7. Administrador | Configuración, reglas, SLA, reportes, CSV, auditoría, QR, usuarios | F15, F16, S4, S17 |
| 8. Supervisor | Solo lectura de reportes con `ver_reportes` (cuando se use) | S5 |

## 6. Casos negativos (resumen ejecutable)

| Caso | Resultado esperado | Estado |
|------|--------------------|--------|
| QR inexistente | 404 amigable, sin tocar datos privados | EJ |
| QR deshabilitado | 410 con explicación institucional | EJ |
| Usuario sin permiso (reportar/gestionar) | Mensaje claro; BD rechaza | EJ/MAN |
| ID manipulado (UUID/código) | Rechazo temprano en servidor | EJ (unitarias) |
| Incidencia de otro usuario | Igual tratamiento que «no existe» | EJ (policies) |
| Técnico sin asignación | RPC rechaza aceptar/resolver/cambiar estado | EJ (SQL) |
| Archivo inválido | Rechazo triple con mensaje por archivo | EJ (unitarias) |
| Formulario incompleto | Errores por campo, sin envío | EJ |
| Error de red | Mensaje y reintentos; sin 500 crudo | EJ (código) |
| Sesión expirada | Mensaje claro; re-login conservando retorno | EJ (código) |
| RLS bloqueando acceso | Degradación controlada («sin resultados») | EJ (código) |
| Realtime desconectado | Estado visible; reconexión con backoff | EJ (corregido) |
| Consulta sin resultados | Empty states con explicación y acción | EJ |
| Fecha imposible en filtros (2026-13-01) | Rechazada como filtro (no error de BD) | EJ (corregido) |
