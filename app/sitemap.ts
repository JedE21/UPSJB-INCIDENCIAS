import type { MetadataRoute } from "next";

/**
 * SITEMAP (Fase 14 — SEO): únicamente páginas públicas de contenido general.
 * Sin parámetros (evita indexar seguimientos individuales) y sin rutas
 * privadas. La URL canónica sale de NEXT_PUBLIC_SITE_URL si está definida.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ahora = new Date();

  const rutas: Array<{ path: string; prioridad: number; cambio: "monthly" | "yearly" }> = [
    { path: "", prioridad: 1, cambio: "monthly" },
    { path: "/informacion", prioridad: 0.8, cambio: "monthly" },
    { path: "/reportar", prioridad: 0.8, cambio: "monthly" },
    { path: "/login", prioridad: 0.3, cambio: "yearly" },
  ];

  return rutas.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: ahora,
    changeFrequency: r.cambio,
    priority: r.prioridad,
  }));
}
