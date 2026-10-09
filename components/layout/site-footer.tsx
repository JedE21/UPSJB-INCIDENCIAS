import Link from "next/link";
import { MapPin, Phone, Mail, ExternalLink, ShieldCheck } from "lucide-react";
import { LogoUpsjb } from "@/components/layout/logo-upsjb";
import { siteConfig } from "@/lib/site";

/**
 * Pie de página institucional (estilo www.upsjb.edu.pe): logo + descripción,
 * y columnas con contactos, enlaces y datos legales. Usa exclusivamente los
 * tokens del proyecto (primary, muted-foreground, border, accent) para
 * mantener la identidad visual en ambos temas.
 */

const contactos = [
  {
    icono: MapPin,
    titulo: "Dirección",
    lineas: ["Carretera Panamericana Sur N.º 103", "113 y 123 (Ex Km 300), Ica"],
  },
  { icono: Phone, titulo: "Central", lineas: ["(01) 709-5999"] },
  {
    icono: Mail,
    titulo: "SAE / Soporte",
    lineas: ["helpdesk@upsjb.edu.pe"],
    href: "mailto:helpdesk@upsjb.edu.pe",
  },
] as const;

const enlaces = [
  { href: "/", label: "Inicio" },
  { href: "/reportar", label: "Reportar incidencia" },
  { href: "/seguimiento", label: "Consultar incidencia" },
  { href: "/informacion", label: "Información" },
] as const;

const institucional = [
  {
    href: "https://www.upsjb.edu.pe/",
    label: "Sitio web oficial",
    externo: true,
  },
  {
    href: "https://www.upsjb.edu.pe/canales-de-atencion/",
    label: "Canales de atención",
    externo: true,
  },
  {
    href: "https://www.upsjb.edu.pe/servicio-atencion-estudiante/",
    label: "SAE",
    externo: true,
  },
] as const;

/** Los íconos de marca no existen en lucide-react: se usan SVG inline. */
function IconoFacebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7V11H8.2v3h2.5v7h2.8Z" />
    </svg>
  );
}
function IconoInstagram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconoLinkedin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M6.9 8.6H4V20h2.9V8.6ZM5.4 7.3a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM10 20h2.9v-5.6c0-.3 0-.7.1-.9.3-.7.8-1.4 1.8-1.4 1.3 0 1.8 1 1.8 2.4V20h2.9v-6.1c0-2.9-1.5-4.2-3.6-4.2-1.7 0-2.4.9-2.9 1.6h-.1V8.6H10V20Z" />
    </svg>
  );
}

const redes = [
  { href: "https://www.facebook.com/upsjboficial/", label: "Facebook", icono: IconoFacebook },
  { href: "https://www.instagram.com/upsjboficial/", label: "Instagram", icono: IconoInstagram },
  {
    href: "https://www.linkedin.com/school/universidad-privada-san-juan-bautista/",
    label: "LinkedIn",
    icono: IconoLinkedin,
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-card/60">
      <div className="mx-auto max-w-6xl px-seguro py-10">
        {/* Columnas principales */}
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          {/* Marca */}
          <div className="flex flex-col gap-4">
            <LogoUpsjb className="h-10 w-auto self-start" />
            <p className="font-tecnica text-xs uppercase tracking-widest text-primary">
              {siteConfig.name} · {siteConfig.title}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sistema Integral de Registro, Atención y Seguimiento de Incidencias
              del campus {siteConfig.branch}.
            </p>
            {/* Redes sociales */}
            <div className="flex gap-2">
              {redes.map((r) => (
                <a
                  key={r.label}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={r.label}
                  className="flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  <r.icono className="size-4" aria-hidden />
                </a>
              ))}
            </div>
          </div>

          {/* Contacto */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Contacto
            </h3>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              {contactos.map((c) => (
                <li key={c.titulo} className="flex gap-3">
                  <c.icono className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/80">
                      {c.titulo}
                    </p>
                    {c.lineas.map((l) =>
                      "href" in c && c.href ? (
                        <a
                          key={l}
                          href={c.href}
                          className="transition-colors hover:text-foreground"
                        >
                          {l}
                          <br />
                        </a>
                      ) : (
                        <span key={l}>
                          {l}
                          <br />
                        </span>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Navegación */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Sistema
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              {enlaces.map((e) => (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    className="transition-colors hover:text-primary"
                  >
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Institucional */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Universidad
            </h3>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              {institucional.map((e) => (
                <li key={e.href}>
                  <a
                    href={e.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                  >
                    {e.label}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Barra legal inferior */}
        <div className="mt-10 flex flex-col items-center gap-3 border-t pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>
            © {new Date().getFullYear()} {siteConfig.institution} —{" "}
            {siteConfig.branch}. Todos los derechos reservados.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            {siteConfig.name} · Experiencia pública
          </p>
        </div>
      </div>
    </footer>
  );
}
