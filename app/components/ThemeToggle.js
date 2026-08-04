"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * ThemeToggle — Uiverse.io sun/moon toggle adapted for FinSentiment
 *
 * Checked  = LIGHT mode (sun state)
 * Unchecked = DARK mode (moon/stars state — DEFAULT)
 *
 * Stores preference in localStorage("finsent-theme").
 * Respects prefers-color-scheme on first visit only.
 * Sets data-theme="light" on <html> element for CSS variable overrides.
 */
export default function ThemeToggle() {
  // null = not yet initialised (avoid flash on mount)
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("finsent-theme");
    if (stored) {
      const light = stored === "light";
      setIsLight(light);
      applyTheme(light);
    } else {
      // First visit: honour OS preference, default to dark if no preference
      const prefersDark =
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const light = !prefersDark; // if OS says light → use light; else dark
      setIsLight(light);
      applyTheme(light);
    }
    setMounted(true);
  }, []);

  const applyTheme = (light) => {
    const html = document.documentElement;
    if (light) {
      html.setAttribute("data-theme", "light");
    } else {
      html.removeAttribute("data-theme");
    }
  };

  const handleChange = useCallback((e) => {
    const light = e.target.checked;
    setIsLight(light);
    applyTheme(light);
    localStorage.setItem("finsent-theme", light ? "light" : "dark");
  }, []);

  // Avoid hydration mismatch — render nothing on SSR, only mount on client
  if (!mounted) return null;

  return (
    <label
      className="theme-switch"
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      <input
        id="theme-toggle-input"
        type="checkbox"
        checked={isLight}
        onChange={handleChange}
        aria-label="Toggle light and dark theme"
      />
      <div className="theme-slider theme-round">
        <div className="theme-sun-moon">
          <svg id="theme-moon-dot-1" className="theme-moon-dot" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-moon-dot-2" className="theme-moon-dot" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-moon-dot-3" className="theme-moon-dot" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-light-ray-1" className="theme-light-ray" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-light-ray-2" className="theme-light-ray" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-light-ray-3" className="theme-light-ray" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-1" className="theme-cloud-dark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-2" className="theme-cloud-dark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-3" className="theme-cloud-dark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-4" className="theme-cloud-light" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-5" className="theme-cloud-light" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-6" className="theme-cloud-light" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50" />
          </svg>
        </div>
        <div className="theme-stars">
          <svg id="theme-star-1" className="theme-star" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg id="theme-star-2" className="theme-star" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg id="theme-star-3" className="theme-star" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg id="theme-star-4" className="theme-star" viewBox="0 0 20 20">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
        </div>
      </div>
    </label>
  );
}
