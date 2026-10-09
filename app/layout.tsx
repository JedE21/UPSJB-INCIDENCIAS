import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/lib/site";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: `${siteConfig.name} · ${siteConfig.title}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
  // Páginas privadas por defecto no indexables; robots.ts afina lo público.
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} · ${siteConfig.title}`,
    description: siteConfig.description,
    locale: "es_PE",
  },
};

/**
 * Viewport móvil (Next 16): 100 dvh corrige el salto del 100vh en móviles
 * (barra del navegador), viewportFit=cover habilita el uso de las safe-area
 * insets (notch / barra inferior de gestos) y themeColor pinta la barra del
 * navegador con el fondo institucional.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0606",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
