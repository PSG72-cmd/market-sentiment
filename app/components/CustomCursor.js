"use client";

import { useEffect, useRef } from "react";

// Reads the current theme from the <html> data-theme attribute
const isLightTheme = () =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "light";

/**
 * CustomCursor — green radial glow cursor + comet-tail trail.
 *
 * Features:
 * - Touch device disable (pointer: coarse)
 * - Physics-based lag (lerp factor 0.12)
 * - Hover shrink on interactive elements
 * - I-beam hand-off over text inputs
 * - Click pulse ring
 * - Comet trail: 8 ring-buffered dots, velocity-aware (thins when stationary)
 * - Trail hidden when drawing tool is active (reads document.body.dataset.drawTool)
 * - prefers-reduced-motion: disabled entirely
 */

const LERP        = 0.12;   // cursor lag factor
const TRAIL_LEN   = 8;      // number of trail dots
const TRAIL_LERP  = 0.18;   // each trail dot chases the one ahead

const INTERACTIVE = [
  "button", "a", "[role='button']", "[role='tab']", "[role='option']",
  ".tab-btn", ".chip", ".analyze-btn", ".stock-range-btn",
  ".chart-type-btn", ".draw-tool-btn", ".country-btn", ".country-option",
  ".stock-trending-card", ".stock-suggestion-item", ".news-item",
  ".news-manual-btn", ".stock-back-btn", ".stock-error-reset",
  ".onboarding-btn", ".history-clear-btn", ".history-close-btn",
  ".history-toggle-btn", ".export-btn",
].join(",");

const TEXT_INPUTS = ["input", "textarea"].join(",");

export default function CustomCursor() {
  const glowRef  = useRef(null);
  const coreRef  = useRef(null);
  const ringRef  = useRef(null);
  // Trail dot refs — array of TRAIL_LEN
  const trailRefs = useRef(Array.from({ length: TRAIL_LEN }, () => ({ current: null })));
  const rafRef   = useRef(null);

  const stateRef = useRef({
    targetX: -999, targetY: -999,
    currentX: -999, currentY: -999,
    hovered: false,
    onInput: false,
    visible: false,
    prevX: -999, prevY: -999,
    velocity: 0,
    // Trail: each entry is { x, y } of a past position
    trail: Array.from({ length: TRAIL_LEN }, () => ({ x: -999, y: -999 })),
  });

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glow  = glowRef.current;
    const core  = coreRef.current;
    const ring  = ringRef.current;
    const trailEls = trailRefs.current.map((r) => r.current).filter(Boolean);
    if (!glow || !core || !ring) return;

    document.documentElement.style.cursor = "none";

    const onMove = (e) => {
      const s = stateRef.current;
      s.targetX = e.clientX;
      s.targetY = e.clientY;

      if (!s.visible) {
        s.currentX = e.clientX;
        s.currentY = e.clientY;
        s.prevX    = e.clientX;
        s.prevY    = e.clientY;
        s.visible  = true;
        // Init trail to same position
        s.trail = s.trail.map(() => ({ x: e.clientX, y: e.clientY }));
        glow.style.opacity = "1";
        core.style.opacity = "1";
      }
    };

    const onLeave = () => {
      const s = stateRef.current;
      s.visible = false;
      glow.style.opacity = "0";
      core.style.opacity = "0";
      trailEls.forEach((el) => { if (el) el.style.opacity = "0"; });
    };

    const onMouseOver = (e) => {
      const s = stateRef.current;
      const target = e.target;

      if (target.closest(TEXT_INPUTS)) {
        s.onInput = true;
        s.hovered = false;
        document.documentElement.style.cursor = "text";
        glow.style.opacity = "0";
        core.style.opacity = "0";
        return;
      }
      s.onInput = false;
      document.documentElement.style.cursor = "none";
      glow.style.opacity = s.visible ? "1" : "0";
      core.style.opacity = s.visible ? "1" : "0";

      s.hovered = !!target.closest(INTERACTIVE);
    };

    const onClick = (e) => {
      ring.style.left      = `${e.clientX}px`;
      ring.style.top       = `${e.clientY}px`;
      ring.style.opacity   = "1";
      ring.style.transform = "translate(-50%, -50%) scale(0.4)";
      ring.style.transition = "none";
      void ring.offsetWidth;
      ring.style.transition = "transform 0.5s ease-out, opacity 0.5s ease-out";
      ring.style.transform  = "translate(-50%, -50%) scale(2.2)";
      ring.style.opacity    = "0";
    };

    const loop = () => {
      const s = stateRef.current;

      // ── Main cursor lerp ──────────────────────────────────────────
      s.currentX += (s.targetX - s.currentX) * LERP;
      s.currentY += (s.targetY - s.currentY) * LERP;

      const x = s.currentX;
      const y = s.currentY;

      // Velocity (smoothed distance per frame)
      const dx = x - s.prevX;
      const dy = y - s.prevY;
      const spd = Math.sqrt(dx * dx + dy * dy);
      s.velocity = s.velocity * 0.8 + spd * 0.2; // exponential smooth
      s.prevX = x;
      s.prevY = y;

      // ── Trail ring-buffer ─────────────────────────────────────────
      // Each trail point chases the one before it
      const trail = s.trail;
      trail[0].x += (x - trail[0].x) * TRAIL_LERP;
      trail[0].y += (y - trail[0].y) * TRAIL_LERP;
      for (let i = 1; i < TRAIL_LEN; i++) {
        trail[i].x += (trail[i - 1].x - trail[i].x) * TRAIL_LERP;
        trail[i].y += (trail[i - 1].y - trail[i].y) * TRAIL_LERP;
      }

      // ── Draw tool suppression ─────────────────────────────────────
      const drawActive = !!document.body.dataset.drawTool;

      // Trail opacity based on velocity (hide when stationary)
      const velFactor = Math.min(s.velocity / 6, 1); // 0 when still, 1 at 6px/frame

      if (trailEls.length > 0 && !drawActive && s.visible && !s.onInput) {
        for (let i = 0; i < TRAIL_LEN; i++) {
          const el = trailEls[i];
          if (!el) continue;
          // Index 0 = closest (largest, most opaque)
          // Index TRAIL_LEN-1 = furthest (smallest, faintest)
          const t = i / (TRAIL_LEN - 1); // 0..1
          const baseOpacity = (1 - t) * 0.65;
          const opacity = baseOpacity * velFactor;
          // Size: 6px → 1.5px
          const sizeFast = 6 - t * 4.5;
          // Slightly larger on fast movement
          const sizeMult = 1 + (s.velocity / 20) * 0.4;
          const size = Math.max(1, sizeFast * sizeMult);

          el.style.opacity   = String(opacity);
          el.style.width     = `${size}px`;
          el.style.height    = `${size}px`;
          el.style.transform = `translate(${trail[i].x - size / 2}px, ${trail[i].y - size / 2}px)`;
        }
      } else {
        trailEls.forEach((el) => { if (el) el.style.opacity = "0"; });
      }

      // ── Theme-aware cursor colors ─────────────────────────────────
      // In light mode: multiply blend keeps green visible on white bg.
      // In dark mode: screen blend produces the glowing neon effect.
      const light = isLightTheme();
      const blendMode = light ? "multiply" : "screen";
      const coreGrad = light
        ? "radial-gradient(circle, rgba(5,150,105,0.95) 0%, rgba(5,150,105,0.5) 40%, transparent 70%)"
        : "radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0.4) 40%, transparent 70%)";
      const coreGradHover = light
        ? "radial-gradient(circle, rgba(5,150,105,1) 0%, rgba(5,150,105,0.6) 50%, transparent 80%)"
        : "radial-gradient(circle, rgba(52,211,153,1) 0%, rgba(52,211,153,0.6) 50%, transparent 80%)";
      const glowGrad = light
        ? "radial-gradient(circle, rgba(5,150,105,0.20) 0%, rgba(5,150,105,0.08) 40%, transparent 70%)"
        : "radial-gradient(circle, rgba(52,211,153,0.13) 0%, rgba(52,211,153,0.05) 40%, transparent 70%)";
      const trailColor = light ? "rgba(5,150,105,0.9)" : "rgba(52,211,153,0.9)";

      // Apply blend modes to trail dots
      trailEls.forEach((el) => {
        if (el) el.style.mixBlendMode = blendMode;
        if (el) el.style.background   = trailColor;
      });
      core.style.mixBlendMode = blendMode;
      ring.style.mixBlendMode = blendMode;
      glow.style.background   = glowGrad;

      // ── Main cursor glow ─────────────────────────────────────────
      if (s.onInput) {
        glow.style.opacity = "0";
        core.style.opacity = "0";
      } else if (s.hovered) {
        glow.style.width     = "90px";
        glow.style.height    = "90px";
        glow.style.opacity   = s.visible ? "0.6" : "0";
        glow.style.transform = `translate(${x - 45}px, ${y - 45}px)`;
        core.style.width     = "10px";
        core.style.height    = "10px";
        core.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
        core.style.background = coreGradHover;
      } else {
        glow.style.width     = "320px";
        glow.style.height    = "320px";
        glow.style.opacity   = s.visible ? "1" : "0";
        glow.style.transform = `translate(${x - 160}px, ${y - 160}px)`;
        core.style.width     = "20px";
        core.style.height    = "20px";
        core.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
        core.style.background = coreGrad;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    document.addEventListener("mousemove",  onMove,      { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseover",  onMouseOver, { passive: true });
    document.addEventListener("click",      onClick);

    return () => {
      document.documentElement.style.cursor = "";
      document.removeEventListener("mousemove",  onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseover",  onMouseOver);
      document.removeEventListener("click",      onClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {/* Ambient bloom */}
      <div
        ref={glowRef}
        aria-hidden="true"
        className="custom-cursor-glow"
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         320,
          height:        320,
          borderRadius:  "50%",
          background:    "radial-gradient(circle, rgba(52,211,153,0.13) 0%, rgba(52,211,153,0.05) 40%, transparent 70%)",
          filter:        "blur(18px)",
          pointerEvents: "none",
          zIndex:        9997,
          opacity:       0,
          transition:    "opacity 0.2s, width 0.18s, height 0.18s",
          willChange:    "transform",
        }}
      />
      {/* Core dot */}
      <div
        ref={coreRef}
        aria-hidden="true"
        className="custom-cursor-core"
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         20,
          height:        20,
          borderRadius:  "50%",
          background:    "radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0.4) 40%, transparent 70%)",
          filter:        "blur(3px)",
          pointerEvents: "none",
          zIndex:        9999,
          opacity:       0,
          transition:    "opacity 0.18s, width 0.18s, height 0.18s, background 0.18s",
          willChange:    "transform",
          mixBlendMode:  "screen", // overridden to multiply in light mode via JS
        }}
      />
      {/* Click pulse ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="custom-cursor-ring"
        style={{
          position:      "fixed",
          top:           0,
          left:          0,
          width:         44,
          height:        44,
          borderRadius:  "50%",
          border:        "2px solid rgba(52,211,153,0.7)",
          pointerEvents: "none",
          zIndex:        9998,
          opacity:       0,
          willChange:    "transform, opacity",
        }}
      />
      {/* Comet trail dots */}
      {Array.from({ length: TRAIL_LEN }, (_, i) => (
        <div
          key={`trail-${i}`}
          ref={(el) => { trailRefs.current[i] = { current: el }; }}
          aria-hidden="true"
          style={{
            position:      "fixed",
            top:           0,
            left:          0,
            width:         6,
            height:        6,
            borderRadius:  "50%",
            background:    "rgba(52, 211, 153, 0.9)",
            filter:        "blur(1.5px)",
            pointerEvents: "none",
            zIndex:        9996,
            opacity:       0,
            willChange:    "transform, opacity, width, height",
            mixBlendMode:  "screen", // overridden to multiply in light mode via JS
          }}
        />
      ))}
    </>
  );
}
