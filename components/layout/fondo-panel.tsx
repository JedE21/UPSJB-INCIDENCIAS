import Image from "next/image";
import { FondoAnimado } from "@/components/layout/fondo-animado";

/**
 * Fondo del panel usuario (mis incidencias, notificaciones y perfil):
 *  · Foto del campus UPSJB Ica con zoom lento (Ken Burns, .fondo-foto).
 *  · Duotono institucional (tinte rojo del tema sobre la foto).
 *  · Velo del tema que funde la foto con el fondo oscuro del inicio.
 *  · Fondo animado "consola" (partículas, rejilla, escaneo y glow).
 *
 * Capas fijas a viewport con z-index negativo: quedan detrás del contenido
 * y del header sticky (z-40). Decorativo, no interactivo; las animaciones
 * respetan prefers-reduced-motion (regla global + guard del canvas).
 */
export function FondoPanelUsuario() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 overflow-hidden"
      >
        <Image
          src="/upsjb-ica.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="fondo-foto object-cover object-center"
        />
        {/* Duotono institucional: tinte rojo del tema sobre la foto. */}
        <div className="absolute inset-0 bg-primary/20 mix-blend-overlay" />
        {/* Velo del tema: funde la foto con el fondo oscuro del inicio. */}
        <div className="absolute inset-0 bg-background/65" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/25 to-background" />
      </div>
      <FondoAnimado />
    </>
  );
}
