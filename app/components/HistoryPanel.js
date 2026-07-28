"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "sentimentHistory";
const MAX_ENTRIES = 50;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {}
}

/** Call this from the Sentiment tab after every successful prediction. */
export function appendHistory({ text, sentiment, confidence }) {
  const existing = loadHistory();
  const entry = {
    id:         Date.now(),
    ts:         Date.now(),
    text:       String(text).slice(0, 100),
    sentiment,
    confidence: typeof confidence === "number" ? confidence : parseFloat(confidence) || 0,
  };
  saveHistory([entry, ...existing]);
}

const SENT_COLOR = { positive: "up", negative: "down", neutral: "neutral" };
const SENT_LABEL = { positive: "▲ POS", negative: "▼ NEG", neutral: "▬ NEU" };

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HistoryPanel() {
  const [open, setOpen]       = useState(false);
  const [entries, setEntries] = useState([]);

  // Load on open
  useEffect(() => {
    if (open) setEntries(loadHistory());
  }, [open]);

  // Also listen for custom event fired when a new prediction is added
  useEffect(() => {
    const handler = () => { if (open) setEntries(loadHistory()); };
    window.addEventListener("sentiment-history-updated", handler);
    return () => window.removeEventListener("sentiment-history-updated", handler);
  }, [open]);

  const clearAll = () => {
    saveHistory([]);
    setEntries([]);
  };

  if (!open) {
    return (
      <button
        id="history-panel-toggle"
        className="history-toggle-btn"
        onClick={() => setOpen(true)}
        aria-label="Show prediction history"
      >
        🕐 History {entries.length > 0 ? `(${loadHistory().length})` : ""}
      </button>
    );
  }

  return (
    <motion.div
      className="history-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="history-panel-header">
        <span className="history-panel-title">🕐 Prediction History</span>
        <div style={{ display: "flex", gap: 8 }}>
          {entries.length > 0 && (
            <button className="history-clear-btn" onClick={clearAll}>
              Clear All
            </button>
          )}
          <button
            className="history-close-btn"
            onClick={() => setOpen(false)}
            aria-label="Close history"
          >
            ✕
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="history-empty">
          No predictions yet. Analyze some text to see it here.
        </div>
      ) : (
        <div className="history-list">
          <AnimatePresence>
            {entries.map((e) => (
              <motion.div
                key={e.id}
                className="history-entry"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <span className={`history-badge ${SENT_COLOR[e.sentiment] || "neutral"}`}>
                  {SENT_LABEL[e.sentiment] || e.sentiment}
                </span>
                <span className="history-text" title={e.text}>
                  {e.text.length > 72 ? e.text.slice(0, 72) + "…" : e.text}
                </span>
                <span className="history-conf">
                  {typeof e.confidence === "number"
                    ? `${e.confidence.toFixed(1)}%`
                    : "—"}
                </span>
                <span className="history-ts">{timeAgo(e.ts)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
