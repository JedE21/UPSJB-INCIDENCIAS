import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo institucional UPSJB (horizontal, 768×205, fondo transparente,
 * rojo corporativo) — réplica del encabezado de www.upsjb.edu.pe.
 */
export function LogoUpsjb({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-san-juan.webp"
      alt="Universidad Privada San Juan Bautista — Filial Ica"
      width={768}
      height={205}
      priority
      className={cn("h-auto w-auto", className)}
    />
  );
}
