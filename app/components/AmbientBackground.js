"use client";

import { useEffect, useRef } from "react";

/**
 * AmbientBackground — fixed canvas dot-grid behind all content.
 * Very low opacity, slow drift. Stops animation on prefers-reduced-motion.
 */
export default function AmbientBackground() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const GRID = 40;
    const DOT_R = 1.2;
    const DRIFT_SPEED = 0.18;
    const BASE_ALPHA = 0.28;

    let W, H, cols, rows;
    let t = 0;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cols = Math.ceil(W / GRID) + 1;
      rows = Math.ceil(H / GRID) + 1;
    }

    function drawFrame() {
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * GRID;
          const y = r * GRID;
          // subtle wave alpha per dot
          const wave = Math.sin(t * 0.4 + r * 0.5 + c * 0.3) * 0.5 + 0.5;
          const alpha = BASE_ALPHA * (0.4 + 0.6 * wave);
          ctx.beginPath();
          ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
    }

    function loop() {
      t += DRIFT_SPEED * 0.016; // ~60fps normalised
      drawFrame();
      rafRef.current = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      // Static draw once — no animation loop
      drawFrame();
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.055,
      }}
    />
  );
}
