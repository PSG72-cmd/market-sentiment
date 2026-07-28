"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    id: "confidence",
    icon: "📊",
    title: "Confidence Bars",
    body: "The three bars show how certain the model is about each sentiment class — Positive, Neutral, and Negative. The tallest bar wins and becomes the final prediction.",
    anchor: null,
  },
  {
    id: "lexicon",
    icon: "🔍",
    title: "Matched Lexicon Terms",
    body: "Below the bars you'll see highlighted financial keywords the model specifically recognized — things like \"earnings beat\", \"credit crisis\", or \"default\". These power part of the model's signal.",
    anchor: null,
  },
  {
    id: "tabs",
    icon: "📈",
    title: "Stock Explorer",
    body: "Switch to the Stock Explorer tab to look up any publicly listed stock, see live quotes, candlestick charts with drawing tools, and auto-scored news headlines — all in one place.",
    anchor: null,
  },
];

export default function OnboardingOverlay({ onDismiss }) {
  const [step, setStep] = useState(0);
  const overlayRef = useRef(null);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  // Dismiss on overlay click (not card click)
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onDismiss();
  };

  // Dismiss on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return (
    <motion.div
      ref={overlayRef}
      className="onboarding-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome walkthrough"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="onboarding-card"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress dots */}
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`onboarding-dot ${i === step ? "active" : ""}`}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>

          {/* Close button */}
          <button
            className="onboarding-close"
            onClick={onDismiss}
            aria-label="Dismiss walkthrough"
          >
            ✕
          </button>

          {/* Content */}
          <div className="onboarding-icon">{current.icon}</div>
          <h2 className="onboarding-title">{current.title}</h2>
          <p className="onboarding-body">{current.body}</p>

          {/* Step indicator */}
          <div className="onboarding-step-label">
            {step + 1} of {STEPS.length}
          </div>

          {/* Nav buttons */}
          <div className="onboarding-actions">
            {step > 0 && (
              <button
                className="onboarding-btn secondary"
                onClick={() => setStep((s) => s - 1)}
              >
                ← Back
              </button>
            )}
            <button
              className="onboarding-btn primary"
              onClick={() => (isLast ? onDismiss() : setStep((s) => s + 1))}
              id={isLast ? "onboarding-get-started" : undefined}
            >
              {isLast ? "Get Started →" : "Next →"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
