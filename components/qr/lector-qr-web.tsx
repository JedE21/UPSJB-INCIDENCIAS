"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, CameraOff, Loader2, ScanLine, ShieldCheck, X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

/**
 * LECTOR DE QR DESDE LA CÁMARA (público).
 *
 * · La cámara SOLO se enciende cuando la persona lo pide (botón) — nunca
 *   autoplay: los navegadores exigen gesto del usuario para getUserMedia.
 * · La decodificación es 100% local en el navegador (@zxing/browser): el
 *   video no sale del dispositivo (privacidad, sin servidores intermedios).
 * · Solo se decodifica el CUADRADO central del encuadre (donde el usuario
 *   alinea el QR): más fiable y coincide con el marco de la UI.
 * · Se acepta el código crudo (AMB-...-0001) o la URL impresa en el QR
 *   (https://.../r/AMB-...-0001); cualquier otro contenido se ignora.
 * · Tras decodificar se navega a /r/<codigo>, la misma ruta que usa el QR
 *   impreso: toda la validación (RPC, disponibilidad, sesión) sigue en
 *   servidor; este componente solo "escribe" la ruta.
 */
const CODIGO_REGEX = /^([A-Z0-9]+-)+[0-9]{4}$/;

/**
 * Extrae el código institucional del contenido decodificado:
 *  · Acepta el código crudo          → PAB-B-P4-LAB-B401-0001
 *  · Acepta la URL impresa en el QR  → https://sir-upsjb.vercel.app/r/PAB-B-P4-LAB-B401-0001
 * Cualquier otro contenido (QRs ajenos) retorna null y se ignora.
 */
const extraerCodigoInstitucional = (texto: string): string | null => {
  const limpio = texto.trim();
  // La ruta /r/ se busca sobre el texto ORIGINAL (la URL es sensible a
  // mayúsculas: pasar todo a MAYÚSCULAS antes rompía el match ".../R/...").
  const desdeUrl = /\/r\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/i.exec(limpio)?.[1];
  const candidata = (desdeUrl ?? limpio).toUpperCase();
  return CODIGO_REGEX.test(candidata) ? candidata : null;
};

/** Área de escaneo: fracción del lado del video que se decodifica (cuadrado central). */
const FRACCION_CUADRO = 0.7;
/** Frecuencia de intentos de decodificación (ms). */
const INTERVALO_ESCANEO_MS = 120;

type EstadoLector =
  | { tipo: "apagado" }
  | { tipo: "iniciando" }
  | { tipo: "activo" }
  | { tipo: "error"; titulo: string; detalle: string };

/** Etiqueta del indicador superior según el estado del lector. */
const ETIQUETA_ESTADO: Record<EstadoLector["tipo"], string> = {
  apagado: "En espera",
  iniciando: "Conectando",
  activo: "En vivo",
  error: "Sin cámara",
};

/** Paleta del indicador superior (identidad UPSJB). */
const CLASE_ESTADO: Record<EstadoLector["tipo"], string> = {
  apagado: "border-white/10 bg-white/5 text-[#9C8A8A]",
  iniciando: "border-[#FF3936]/40 bg-[#FF3936]/10 text-[#FF7673]",
  activo: "border-[#FF3936]/45 bg-[#FF3936]/15 text-[#FF7673]",
  error: "border-destructive/40 bg-destructive/10 text-[#FF7673]",
};

export function LectorQrWeb() {
  const router = useRouter();
  const prefiereMenosMovimiento = useReducedMotion();

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const controlesRef = React.useRef<IScannerControls | null>(null);
  const lectorRef = React.useRef<BrowserMultiFormatReader | null>(null);
  const intervaloRef = React.useRef<number | null>(null);
  const avisoTimerRef = React.useRef<number | null>(null);
  const navigateRef = React.useRef(router);
  navigateRef.current = router;

  const [estado, setEstado] = React.useState<EstadoLector>({ tipo: "apagado" });
  // Aviso transitorio: se detectó un QR legible pero NO es del sistema.
  const [avisoAjeno, setAvisoAjeno] = React.useState(false);

  /** Detiene cámara y timers de forma segura (idempotente). */
  const detener = React.useCallback(() => {
    if (intervaloRef.current) {
      window.clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
    if (avisoTimerRef.current) {
      window.clearTimeout(avisoTimerRef.current);
      avisoTimerRef.current = null;
    }
    controlesRef.current?.stop();
    controlesRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) {
      for (const pista of stream.getTracks()) pista.stop();
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    lectorRef.current = null;
  }, []);

  const abrirCamara = React.useCallback(() => {
    detener();
    setEstado({ tipo: "iniciando" });

    const video = videoRef.current;
    if (!video) return;

    // decodeFromConstraints pide la cámara al navegador (diálogo de permiso)
    // y enciende el stream. El delay de ZXing se deja alto porque la
    // decodificación real ocurre en el bucle propio de abajo, SOLO sobre el
    // cuadrado central (canvas propio) donde el usuario alinea el QR.
    const lector = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 10000,
      delayBetweenScanSuccess: 10000,
    });
    lectorRef.current = lector;

    lector
      .decodeFromConstraints(
        {
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        },
        video,
        () => {}, // la decodificación real ocurre en el bucle de abajo
      )
      .then((controles) => {
        controlesRef.current = controles;
        setEstado({ tipo: "activo" });

        // Bucle de decodificación sobre el CUADRADO CENTRAL del video.
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        intervaloRef.current = window.setInterval(() => {
          const v = videoRef.current;
          if (!ctx || !v || v.readyState < 2 || !v.videoWidth) return;

          const lado = Math.floor(Math.min(v.videoWidth, v.videoHeight) * FRACCION_CUADRO);
          const ladoCanvas = Math.min(lado, 720);
          if (canvas.width !== ladoCanvas) {
            canvas.width = ladoCanvas;
            canvas.height = ladoCanvas;
          }
          ctx.drawImage(
            v,
            (v.videoWidth - lado) / 2, // recorte centrado: el marco cuadrado de la UI
            (v.videoHeight - lado) / 2,
            lado,
            lado,
            0,
            0,
            ladoCanvas,
            ladoCanvas,
          );

          let resultado;
          try {
            resultado = lector.decodeFromCanvas(canvas);
          } catch {
            return; // sin QR legible en este intento: se reintenta
          }

          const codigo = extraerCodigoInstitucional(resultado?.getText() ?? "");
          if (!codigo) {
            // QR legible pero ajeno al sistema: aviso transitorio (no silencio).
            const crudo = (resultado?.getText() ?? "").trim();
            if (crudo) {
              setAvisoAjeno(true);
              if (avisoTimerRef.current) window.clearTimeout(avisoTimerRef.current);
              avisoTimerRef.current = window.setTimeout(() => {
                setAvisoAjeno(false);
                avisoTimerRef.current = null;
              }, 2600);
            }
            return;
          }

          // Un solo salto: detener cámara y navegar a la ruta pública real.
          detener();
          setEstado({ tipo: "apagado" });
          navigateRef.current.push(`/r/${encodeURIComponent(codigo)}`);
        }, INTERVALO_ESCANEO_MS);
      })
      .catch((error: unknown) => {
        const nombre = (error as { name?: string })?.name ?? "";
        if (nombre === "NotAllowedError") {
          setEstado({
            tipo: "error",
            titulo: "Permiso de cámara denegado",
            detalle:
              "Tu navegador bloqueó la cámara. Habilítala en el candado de la barra de direcciones y vuelve a intentarlo.",
          });
        } else if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
          setEstado({
            tipo: "error",
            titulo: "No se encontró cámara",
            detalle: "Este dispositivo no tiene una cámara disponible o está siendo usada por otra app.",
          });
        } else {
          setEstado({
            tipo: "error",
            titulo: "No se pudo abrir la cámara",
            detalle:
              "El escaneo necesita una conexión segura (HTTPS) y permiso de cámara. También puedes usar la app de cámara de tu teléfono.",
          });
        }
      });
  }, [detener]);

  // Al desmontar: nunca dejar la cámara encendida.
  React.useEffect(() => detener, [detener]);

  const activo = estado.tipo === "activo" || estado.tipo === "iniciando";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card/80 shadow-[0_24px_70px_-30px_rgb(255_57_54/45%)] backdrop-blur">
      {/* Canto superior neón (lenguaje del mockup) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3936]/60 to-transparent"
        aria-hidden
      />

      {/* Barra técnica superior: identidad + estado del lector */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-4 py-2.5">
        <span className="chip-tecnico flex items-center gap-2 text-primary/80">
          <ScanLine className="size-3.5 shrink-0 text-primary" aria-hidden />
          Escáner QR · UPSJB
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={estado.tipo}
            initial={prefiereMenosMovimiento ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${CLASE_ESTADO[estado.tipo]}`}
          >
            {estado.tipo === "activo" || estado.tipo === "iniciando" ? (
              <span className="live-dot" aria-hidden />
            ) : (
              <span className="size-1.5 rounded-full bg-current opacity-60" aria-hidden />
            )}
            {ETIQUETA_ESTADO[estado.tipo]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Zona de video CUADRADA (área de escaneo alineada al marco) */}
      <div className="p-2.5">
        <div
          className={`relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-[#0A0606] ring-1 ring-white/5 ${
            activo ? "marco-vivo" : ""
          }`}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className={`size-full object-cover transition-opacity duration-500 ${activo ? "opacity-100" : "opacity-0"}`}
            muted
            playsInline
          />

          {/* Rejilla técnica de fondo (solo cuando está apagado) */}
          {!activo && <div className="lector-grid absolute inset-0 opacity-60" aria-hidden />}

          {/* Halo rojo que respira detrás del estado inicial */}
          {estado.tipo === "apagado" && <div className="halo-camara" aria-hidden />}

          {/* Marco de esquinas + línea de barrido + viñeta de enfoque */}
          {activo && (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_90px_24px_rgb(10_6_6/60%)]" />
              {/* Esquinas alineadas al cuadrado REAL de decodificación (70% central). */}
              <span className="esquina-qr absolute left-[15%] top-[15%] size-12 rounded-tl-2xl border-l-[3px] border-t-[3px] border-[#FF3936]" />
              <span className="esquina-qr absolute right-[15%] top-[15%] size-12 rounded-tr-2xl border-r-[3px] border-t-[3px] border-[#FF3936] [animation-delay:0.4s]" />
              <span className="esquina-qr absolute bottom-[15%] left-[15%] size-12 rounded-bl-2xl border-b-[3px] border-l-[3px] border-[#FF3936] [animation-delay:0.8s]" />
              <span className="esquina-qr absolute bottom-[15%] right-[15%] size-12 rounded-br-2xl border-b-[3px] border-r-[3px] border-[#FF3936] [animation-delay:1.2s]" />
              {estado.tipo === "activo" && !prefiereMenosMovimiento && (
                <div className="absolute inset-x-[15%] top-1/2 h-px">
                  {/* Barrido principal + estela difuminada (mockup) */}
                  <span className="lector-scanline absolute inset-x-0 top-0 block h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#FF3936] to-transparent" />
                  <span className="lector-scanline absolute inset-x-0 top-0 block h-3 rounded-full bg-gradient-to-r from-transparent via-[#FF3936]/25 to-transparent blur-md" />
                </div>
              )}
              <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF3936]/70 shadow-[0_0_12px_2px_rgb(255_57_54/50%)]" />
            </div>
          )}

          {/* Estados superpuestos */}
          <AnimatePresence mode="wait">
            {estado.tipo === "apagado" && (
              <motion.div
                key="apagado"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center"
              >
                <motion.span
                  initial={prefiereMenosMovimiento ? false : { scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="relative flex size-16 items-center justify-center rounded-2xl border border-[#FF3936]/40 bg-gradient-to-b from-[#FF3936]/20 to-[#FF3936]/5 shadow-[0_0_40px_-10px_rgb(255_57_54/60%)]"
                >
                  <Camera className="size-7 text-[#FF7673]" aria-hidden />
                  <span
                    className="halo-respira absolute -inset-1.5 rounded-[1.25rem] border border-[#FF3936]/20"
                    aria-hidden
                  />
                </motion.span>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#F3ECEC]">Escáner de QR institucional</p>
                  <p className="mx-auto max-w-xs text-xs leading-relaxed text-[#EBE5E5]/75">
                    Apunta al QR del ambiente con tu cámara. El video se procesa solo en tu dispositivo.
                  </p>
                </div>

                <motion.div
                  whileHover={prefiereMenosMovimiento ? undefined : { scale: 1.03 }}
                  whileTap={prefiereMenosMovimiento ? undefined : { scale: 0.97 }}
                >
                  <Button
                    onClick={abrirCamara}
                    size="lg"
                    className="btn-brillo rounded-xl shadow-[0_12px_32px_-12px_rgb(255_57_54/70%)]"
                  >
                    <ScanLine className="size-4" aria-hidden />
                    Abrir cámara y escanear
                  </Button>
                </motion.div>

                <p className="flex items-center gap-1 text-[11px] text-[#9C8A8A]">
                  <ShieldCheck className="size-3" aria-hidden />
                  Se solicitará permiso de cámara
                </p>
              </motion.div>
            )}

            {estado.tipo === "iniciando" && (
              <motion.div
                key="iniciando"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0A0606]/55 text-[#EBE5E5] backdrop-blur-[2px]"
              >
                <span className="relative flex size-14 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#FF3936]/20" aria-hidden />
                  <Loader2 className="size-7 animate-spin text-[#FF3936]" aria-hidden />
                </span>
                <p className="text-sm font-medium">Encendiendo cámara…</p>
                <div className="h-1 w-44 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <span className="barra-progreso block h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#FF3936] to-transparent" />
                </div>
                <p className="text-[11px] text-[#9C8A8A]">Revisa el aviso de permiso de tu navegador</p>
              </motion.div>
            )}

            {estado.tipo === "activo" && (
              <motion.div
                key="activo"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-t from-[#0A0606]/95 via-[#0A0606]/50 to-transparent px-4 pb-3 pt-8"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={avisoAjeno ? "ajeno" : "buscando"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className={`live-dot flex items-center gap-1.5 text-xs font-medium ${
                      avisoAjeno ? "text-[#F3ECEC]" : "text-[#FF7673]"
                    }`}
                  >
                    {avisoAjeno ? "QR ajeno · apunta al QR del ambiente" : "Buscando código…"}
                  </motion.span>
                </AnimatePresence>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    detener();
                    setEstado({ tipo: "apagado" });
                  }}
                  className="gap-1.5 border-white/15 bg-black/40 text-[#EBE5E5] hover:bg-black/60 hover:text-white"
                >
                  <X className="size-3.5" aria-hidden />
                  Cerrar
                </Button>
              </motion.div>
            )}

            {estado.tipo === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0A0606]/70 px-6 text-center backdrop-blur-[2px]"
              >
                <span className="flex size-14 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/15">
                  <CameraOff className="size-7 text-[#FF7673]" aria-hidden />
                </span>
                <p className="text-sm font-semibold text-[#F3ECEC]">{estado.titulo}</p>
                <p className="max-w-xs text-xs leading-relaxed text-[#9C8A8A]">{estado.detalle}</p>
                <div className="flex gap-2">
                  <Button onClick={abrirCamara} size="sm" className="btn-brillo">
                    Reintentar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEstado({ tipo: "apagado" })}
                    className="border-white/15 bg-black/40 text-[#EBE5E5] hover:bg-black/60 hover:text-white"
                  >
                    Cerrar
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pie técnico */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/60 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          Detección local · el video no sale de tu dispositivo
        </span>
        <span className="font-tecnica text-[10px] text-muted-foreground/70">/r/&lt;código&gt;</span>
      </div>
    </div>
  );
}
