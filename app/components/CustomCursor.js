"use client";

import { useEffect, useRef } from "react";

/**
 * CustomCursor — refined green radial glow cursor.
 *
 * Features:
 * - Touch device disable (pointer: coarse)
 * - Physics-based lag (lerp factor 0.12 — ~100ms natural delay)
 * - Hover shrink on interactive elements (buttons, links, chips, etc.)
 * - I-beam hand-off over text inputs (textarea, input)
 * - Click pulse ring that expands outward from cursor on click
 * - prefers-reduced-motion: disabled entirely
 */

const LERP = 0.12; // lag factor — lower = more lag

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
  const rafRef   = useRef(null);
  const stateRef = useRef({
    targetX: -999, targetY: -999,
    currentX: -999, currentY: -999,
    hovered: false,   // over interactive element
    onInput: false,   // over text input
    visible: false,
  });

  useEffect(() => {
    // Disable on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;
    // Disable on reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const glow = glowRef.current;
    const core = coreRef.current;
    const ring = ringRef.current;
    if (!glow || !core || !ring) return;

    // Hide native cursor on entire document
    document.documentElement.style.cursor = "none";

    const onMove = (e) => {
      const s = stateRef.current;
      s.targetX = e.clientX;
      s.targetY = e.clientY;

      if (!s.visible) {
        // Teleport on first move so glow doesn't slide in from offscreen
        s.currentX = e.clientX;
        s.currentY = e.clientY;
        s.visible = true;
        glow.style.opacity = "1";
        core.style.opacity = "1";
      }
    };

    const onLeave = () => {
      stateRef.current.visible = false;
      glow.style.opacity = "0";
      core.style.opacity = "0";
    };

    const onMouseOver = (e) => {
      const s = stateRef.current;
      const target = e.target;

      // Text input → hand off to I-beam
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

      // Interactive element → shrink
      if (target.closest(INTERACTIVE)) {
        s.hovered = true;
      } else {
        s.hovered = false;
      }
    };

    // Click pulse
    const onClick = (e) => {
      ring.style.left = `${e.clientX}px`;
      ring.style.top  = `${e.clientY}px`;
      ring.style.opacity = "1";
      ring.style.transform = "translate(-50%, -50%) scale(0.4)";
      ring.style.transition = "none";
      // Trigger reflow
      void ring.offsetWidth;
      ring.style.transition = "transform 0.5s ease-out, opacity 0.5s ease-out";
      ring.style.transform = "translate(-50%, -50%) scale(2.2)";
      ring.style.opacity = "0";
    };

    // rAF loop — lerp towards target, apply hover/input scale
    const loop = () => {
      const s = stateRef.current;

      // Lerp
      s.currentX += (s.targetX - s.currentX) * LERP;
      s.currentY += (s.targetY - s.currentY) * LERP;

      const x = s.currentX;
      const y = s.currentY;

      // Glow
      if (s.onInput) {
        glow.style.opacity = "0";
        core.style.opacity = "0";
      } else if (s.hovered) {
        // Shrink to tight targeting dot
        glow.style.width  = "90px";
        glow.style.height = "90px";
        glow.style.opacity = s.visible ? "0.6" : "0";
        glow.style.transform = `translate(${x - 45}px, ${y - 45}px)`;
        core.style.width  = "10px";
        core.style.height = "10px";
        core.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
        core.style.background = "radial-gradient(circle, rgba(52,211,153,1) 0%, rgba(52,211,153,0.6) 50%, transparent 80%)";
      } else {
        // Normal ambient bloom
        glow.style.width  = "320px";
        glow.style.height = "320px";
        glow.style.opacity = s.visible ? "1" : "0";
        glow.style.transform = `translate(${x - 160}px, ${y - 160}px)`;
        core.style.width  = "20px";
        core.style.height = "20px";
        core.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
        core.style.background = "radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0.4) 40%, transparent 70%)";
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    document.addEventListener("mousemove",  onMove,     { passive: true });
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
          mixBlendMode:  "screen",
        }}
      />
      {/* Click pulse ring */}
      <div
        ref={ringRef}
        aria-hidden="true"
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
    </>
  );
}
