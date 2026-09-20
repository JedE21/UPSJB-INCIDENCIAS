/**
 * ARQUITECTURA DE CORREO · SIR-UPSJB (FASE 9 — Plan §20, canal 'correo')
 *
 * ESTADO: PREPARADA PERO INACTIVA. La institución aún NO aprobó proveedor
 * de correo (SMTP/API transaccional), así que:
 *   · NO se envía ningún correo real desde la aplicación.
 *   · NO hay credenciales ni endpoints hardcodeados: cuando se apruebe el
 *     proveedor, sus valores irán en variables de entorno DE SERVIDOR
 *     (sin NEXT_PUBLIC_; ver .env.example), nunca en el repositorio.
 *   · Las plantillas de canal 'correo' ya existen como datos
 *     (plantillas_notificacion) y son editables por el administrador.
 *
 * DISEÑO FUTURO (cuando se apruebe proveedor):
 *   1. El trigger/RPC 0018 ya guarda la notificación interna (fuente única).
 *   2. Una cola de envío (worker/edge function con SERVICE_ROLE, SOLO
 *      servidor) lee las notificaciones pendientes cuyo evento tenga
 *      plantilla de canal 'correo' activa para el destinatario.
 *   3. El cuerpo sale SIEMPRE de la plantilla (placeholders ya resueltos por
 *      la BD); este módulo solo transporta: destinatario + asunto + cuerpo.
 *   4. Config por env: PROVEEDOR (smtp|api), URL API + API KEY o host/puerto/
 *      usuario/clave SMTP, REMITENTE visible. Sin valores por defecto que
 *      apunten a servicios reales.
 *
 * Esta implementación expone `procesarColaCorreo()` como PUNTO DE
 * EXTENSIÓN seguro: hoy devuelve "no configurado" sin tocar la red.
 */

export interface CorreoPendiente {
  notificacionId: string;
  destinatarioCorreo: string;
  asunto: string;
  cuerpo: string;
}

/** Config resuelta de entorno (servidor). null = correo NO configurado. */
function configCorreo(): { proveedor: string } | null {
  const proveedor = process.env.CORREO_PROVEEDOR?.trim();
  if (!proveedor) return null; // sin env ⇒ deshabilitado por diseño
  return { proveedor };
}

/**
 * Punto de extensión de la cola de correo. MIENTRAS no exista proveedor
 * aprobado devuelve { configurado: false, enviados: 0 } y no hace nada.
 * Cuando se apruebe, implementar aquí la llamada al proveedor (o dejar que
 * un worker externo la consuma) SIN guardar credenciales en el código.
 */
export async function procesarColaCorreo(
  pendientes: CorreoPendiente[]
): Promise<{ configurado: boolean; enviados: number }> {
  if (!configCorreo()) {
    return { configurado: false, enviados: 0 };
  }
  // Implementación futura por proveedor (SMTP/API). Punto único de cambio.
  void pendientes;
  return { configurado: true, enviados: 0 };
}
