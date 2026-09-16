"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TOASTS · SIR-UPSJB (Fase 12 — UX/UI)
 *
 * Sistema de notificaciones emergentes sin dependencias externas:
 * Framer Motion para la animación + contexto React global.
 * El icono refuerza el tipo para no depender solo del color (§50).
 *
 * Uso (desde componentes cliente):
 *   const { toast } = useToast();
 *   toast({ title: "Guardado", description: "…", variant: "success" });
 */

export type ToastVariant = "info" | "success" | "warning" | "destructive";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Duración en ms (5000 por defecto; Infinity para no cerrar solo). */
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "title">> {
  id: number;
  description?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  descartar: (id: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let contador = 0;

const META: Record<
  ToastVariant,
  { icon: React.ComponentType<{ className?: string }>; clases: string; iconoClases: string }
> = {
  info: {
    icon: Info,
    clases: "border bg-card text-card-foreground",
    iconoClases: "text-blue-600 dark:text-blue-400",
  },
  success: {
    icon: CircleCheck,
    clases: "border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-950 dark:text-green-100",
    iconoClases: "text-green-600 dark:text-green-400",
  },
  warning: {
    icon: TriangleAlert,
    clases: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-950 dark:text-yellow-100",
    iconoClases: "text-yellow-600 dark:text-yellow-400",
  },
  destructive: {
    icon: CircleAlert,
    clases: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950 dark:text-red-100",
    iconoClases: "text-red-600 dark:text-red-400",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const descartar = React.useCallback((id: number) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ title, description, variant = "info", durationMs = 5000 }: ToastOptions) => {
      const id = ++contador;
      setToasts((actuales) => [...actuales.slice(-4), { id, title, description, variant, durationMs }]);
    },
    []
  );

  // Auto-cierre individual.
  React.useEffect(() => {
    const temporizadores = toasts
      .filter((t) => Number.isFinite(t.durationMs))
      .map((t) => window.setTimeout(() => descartar(t.id), t.durationMs));
    return () => temporizadores.forEach(window.clearTimeout);
  }, [toasts, descartar]);

  const valor = React.useMemo(() => ({ toast, descartar }), [toast, descartar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notificaciones"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const { icon: Icon, clases, iconoClases } = META[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                role="status"
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
                  clases
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", iconoClases)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description ? (
                    <p className="mt-0.5 text-sm opacity-90">{t.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => descartar(t.id)}
                  className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Cerrar notificación"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Hook de acceso al sistema de toasts (solo componentes cliente). */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return ctx;
}
