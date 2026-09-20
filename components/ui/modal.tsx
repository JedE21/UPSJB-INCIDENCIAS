"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * MODAL / DIALOG · SIR-UPSJB (Fase 12 — UX/UI)
 *
 * Dialog renderizado en portal y animado con Framer Motion.
 * Maneja Escape, clic en el fondo y bloqueo del scroll del body.
 * Respeta prefers-reduced-motion.
 */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Ancho máximo del diálogo (sm/md/lg). */
  size?: "sm" | "md" | "lg";
}

const anchos = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const reduceMotion = useReducedMotion();
  const [montado, setMontado] = React.useState(false);
  const idTitulo = React.useId();
  const idDescripcion = React.useId();
  const refCaja = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMontado(true), []);

  // Escape + bloqueo de scroll mientras está abierto.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus al abrir (accesibilidad de teclado §50).
    const foco = window.setTimeout(() => refCaja.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
      window.clearTimeout(foco);
    };
  }, [open, onClose]);

  if (!montado) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={onClose}
        >
          <motion.div
            ref={refCaja}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.97 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={description ? idDescripcion : undefined}
            tabIndex={-1}
            className={cn(
              "w-full rounded-xl border bg-card p-6 shadow-lg focus-visible:outline-none",
              anchos[size]
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">{title}</h2>
                {description ? (
                  <p id={idDescripcion} className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label="Cerrar"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {children ? <div className="mt-4">{children}</div> : null}
            {footer ? (
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
