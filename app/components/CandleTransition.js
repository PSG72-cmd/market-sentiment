"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * CandleTransition — full-screen animated candlestick bars that
 * play during tab switches. Gives a live-market / stock-trader vibe.
 *
 * Usage: Render inside AnimatePresence as a shared-key overlay,
 * pass `direction`: "toStock" | "toSentiment".
 */

const CANDLES = [
  { h: 110, bodyTop: 20,  bodyH: 60,  up: true  },
  { h: 80,  bodyTop: 30,  bodyH: 35,  up: false },
  { h: 140, bodyTop: 10,  bodyH: 90,  up: true  },
  { h: 60,  bodyTop: 15,  bodyH: 30,  up: false },
  { h: 160, bodyTop: 5,   bodyH: 110, up: true  },
  { h: 90,  bodyTop: 20,  bodyH: 50,  up: true  },
  { h: 50,  bodyTop: 10,  bodyH: 28,  up: false },
];

export default function CandleTransition({ direction }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const W = canvas.width;
    const H = canvas.height;
    const n = 9;
    const candleW = 28;
    const gap = Math.min(60, (W * 0.7) / n);
    const startX = (W - gap * (n - 1) - candleW) / 2;
    const baseY  = H * 0.72;

    // Generate n random-ish candles
    const candles = Array.from({ length: n }, (_, i) => {
      const seed = (i * 137 + 42) % 100;
      const totalH = 60 + (seed % 120);
      const bodyFrac = 0.45 + (seed % 30) / 100;
      const bodyH = totalH * bodyFrac;
      const wickTop = (totalH - bodyH) * 0.4;
      const up = i % 3 !== 1;
      return { totalH, bodyH, wickTop, up, x: startX + i * gap };
    });

    let start = null;
    const DURATION = 520; // ms

    function draw(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / DURATION, 1);

      ctx.clearRect(0, 0, W, H);

      // Dark overlay
      ctx.fillStyle = "rgba(10,15,28,0.96)";
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = "rgba(52,211,153,0.06)";
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 48) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      candles.forEach((c, i) => {
        // Each candle staggers by 40ms
        const candleStart = (i / n) * 0.5;
        const candleProgress = Math.max(0, Math.min(1, (progress - candleStart) / 0.6));
        const ease = 1 - Math.pow(1 - candleProgress, 3);

        const drawnH  = c.totalH * ease;
        const drawnBody = c.bodyH * ease;
        const topY = baseY - drawnH;

        // Wick
        const wickColor = c.up ? "rgba(52,211,153,0.7)" : "rgba(251,113,133,0.7)";
        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x + candleW / 2, topY);
        ctx.lineTo(c.x + candleW / 2, baseY);
        ctx.stroke();

        // Body
        const bodyY = baseY - drawnBody - c.wickTop * ease;
        const grad = ctx.createLinearGradient(c.x, bodyY, c.x, bodyY + drawnBody);
        if (c.up) {
          grad.addColorStop(0, "rgba(52,211,153,0.95)");
          grad.addColorStop(1, "rgba(5,150,105,0.8)");
        } else {
          grad.addColorStop(0, "rgba(251,113,133,0.9)");
          grad.addColorStop(1, "rgba(225,29,72,0.75)");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(c.x, bodyY, candleW, Math.max(2, drawnBody), 3);
        ctx.fill();

        // Glow
        if (c.up && candleProgress > 0.5) {
          ctx.shadowBlur = 16 * candleProgress;
          ctx.shadowColor = "rgba(52,211,153,0.6)";
          ctx.fillRect(c.x, bodyY, candleW, Math.max(2, drawnBody));
          ctx.shadowBlur = 0;
        }
      });

      // "FinSentiment" flash label
      if (progress > 0.55) {
        const alpha = Math.min(1, (progress - 0.55) / 0.25);
        ctx.font = "700 13px 'JetBrains Mono', monospace";
        ctx.letterSpacing = "0.1em";
        ctx.fillStyle = `rgba(52,211,153,${alpha * 0.7})`;
        ctx.textAlign = "center";
        ctx.fillText(
          direction === "toStock" ? "STOCK EXPLORER" : "SENTIMENT ANALYSIS",
          W / 2,
          H * 0.72 + 48
        );
      }

      if (progress < 1) requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
  }, [direction]);

  return (
    <motion.div
      key="candle-transition"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        pointerEvents: "none",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </motion.div>
  );
}
