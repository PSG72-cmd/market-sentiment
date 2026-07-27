"use client";

import { useEffect, useRef } from "react";

/**
 * CustomCursor — soft green radial glow that follows the mouse.
 * Two layers: a large ambient bloom + a tight bright core.
 * pointer-events: none so it never blocks clicks.
 */
export default function CustomCursor() {
  const glowRef = useRef(null);
  const coreRef = useRef(null);
  const rafRef  = useRef(null);
  const posRef  = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const glow = glowRef.current;
    const core = coreRef.current;
    if (!glow || !core) return;

    // Check reduced motion
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Hide default cursor on body
    document.documentElement.style.cursor = "none";

    const onMove = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      glow.style.opacity = "1";
      core.style.opacity = "1";
    };
    const onLeave = () => {
      glow.style.opacity = "0";
      core.style.opacity = "0";
    };

    // Smooth follow via rAF
    const loop = () => {
      const { x, y } = posRef.current;
      glow.style.transform = `translate(${x - 180}px, ${y - 180}px)`;
      core.style.transform = `translate(${x - 10}px, ${y - 10}px)`;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      document.documentElement.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {/* Large ambient bloom */}
      <div
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(52,211,153,0.13) 0%, rgba(52,211,153,0.05) 40%, transparent 70%)",
          filter: "blur(18px)",
          pointerEvents: "none",
          zIndex: 9998,
          opacity: 0,
          transition: "opacity 0.3s",
          willChange: "transform",
        }}
      />
      {/* Tight bright core dot */}
      <div
        ref={coreRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(52,211,153,0.9) 0%, rgba(52,211,153,0.4) 40%, transparent 70%)",
          filter: "blur(3px)",
          pointerEvents: "none",
          zIndex: 9999,
          opacity: 0,
          transition: "opacity 0.3s",
          willChange: "transform",
          mixBlendMode: "screen",
        }}
      />
    </>
  );
}
