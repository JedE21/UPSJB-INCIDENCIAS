import type { MetadataRoute } from "next";

/**
 * ROBOTS (Fase 14 — SEO): solo las páginas públicas son indexables.
 * Los paneles privados (admin/técnico/coordinador/usuario), APIs y rutas de
 * callback se excluyen; también /seguimiento por código (resultados
 * personales) y /r (páginas de QR, no deben indexarse).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/informacion", "/reportar", "/login"],
        disallow: [
          "/admin",
          "/admin/",
          "/coordinador",
          "/coordinador/",
          "/tecnico",
          "/tecnico/",
          "/mis-incidencias",
          "/notificaciones",
          "/perfil",
          "/seguimiento",
          "/r/",
          "/api/",
          "/auth/",
        ],
      },
    ],
  };
}
