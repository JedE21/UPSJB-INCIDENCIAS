"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo animado "consola UPSJB" (lenguaje del mockup aprobado):
 *  · Canvas con red de partículas conectadas (rojo institucional).
 *  · Rejilla técnica con máscara radial y pulso.
 *  · Línea de barrido vertical (scanline).
 *  · Resplandor que sigue el cursor.
 *
 * Todo es decorativo (aria-hidden), no captura interacción y se atenúa
 * con prefers-reduced-motion (los canvas ni siquiera se inician).
 */
export function FondoAnimado() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxActual = canvas.getContext("2d");
    if (!ctxActual) return;
    // Copia con tipo no-nulo: el estrechamiento no entra a métodos de clase.
    const ctx: CanvasRenderingContext2D = ctxActual;

    let W = 0;
    let H = 0;
    let raf = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORES = ["rgba(255,4,0,", "rgba(255,57,54,", "rgba(255,118,115,"];

    class Particula {
      x = 0;
      y = 0;
      vx = 0;
      vy = 0;
      r = 0;
      a = 0;
      col = "";
      life = 0;
      max = 0;

      constructor(inicial: boolean) {
        this.reset(inicial);
      }

      reset(inicial: boolean) {
        this.x = Math.random() * W;
        this.y = inicial ? Math.random() * H : H + 10;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = -(Math.random() * 0.5 + 0.1);
        this.r = Math.random() * 1.8 + 0.3;
        this.a = Math.random() * 0.3 + 0.06;
        this.col = COLORES[Math.floor(Math.random() * COLORES.length)];
        this.life = 0;
        this.max = Math.random() * 260 + 110;
      }

      tick() {
        this.x += this.vx;
        this.y += this.vy;
        this.life++;
        if (this.life > this.max || this.y < -10) this.reset(false);
      }

      draw() {
        const f =
          this.life < 0.15 * this.max
            ? this.life / (0.15 * this.max)
            : this.life > 0.85 * this.max
              ? (this.max - this.life) / (0.15 * this.max)
              : 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.col + this.a * f + ")";
        ctx.fill();
      }
    }

    const particulas: Particula[] = [];
    for (let i = 0; i < 90; i++) particulas.push(new Particula(true));

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      // Conexiones entre partículas cercanas (efecto red).
      for (let i = 0; i < particulas.length; i++) {
        for (let j = i + 1; j < particulas.length; j++) {
          const dx = particulas[i].x - particulas[j].x;
          const dy = particulas[i].y - particulas[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            ctx.beginPath();
            ctx.moveTo(particulas[i].x, particulas[i].y);
            ctx.lineTo(particulas[j].x, particulas[j].y);
            ctx.strokeStyle = `rgba(255,118,115,${0.055 * (1 - d / 90)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      for (const p of particulas) {
        p.tick();
        p.draw();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    // Glow del cursor (interpolación suave, sin dependencias externas).
    const glow = document.getElementById("fondo-cursor-glow");
    let gx = -500;
    let gy = -500;
    let tx = gx;
    let ty = gy;
    let rafGlow = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (glow) glow.style.opacity = "1";
    };
    const seguir = () => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      if (glow) glow.style.transform = `translate(${gx}px, ${gy}px)`;
      rafGlow = requestAnimationFrame(seguir);
    };
    if (window.matchMedia("(pointer: fine)").matches) {
      document.addEventListener("mousemove", onMove);
      rafGlow = requestAnimationFrame(seguir);
    }

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rafGlow);
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className="fondo-animado" aria-hidden>
      <canvas ref={canvasRef} className="fondo-canvas" />
      <div className="fondo-grid" />
      <div className="fondo-scanline" />
      <div className="fondo-cursor-glow" id="fondo-cursor-glow" />
    </div>
  );
}
