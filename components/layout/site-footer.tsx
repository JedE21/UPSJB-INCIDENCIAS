import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} {siteConfig.institution} — {siteConfig.branch}
        </p>
        <p>
          {siteConfig.name} · Experiencia pública · Reportar y hacer seguimiento
        </p>
      </div>
    </footer>
  );
}
