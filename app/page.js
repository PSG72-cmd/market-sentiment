"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import dynamic from "next/dynamic";

// Lazy-load StockExplorer so lightweight-charts only loads on demand
const StockExplorer = dynamic(() => import("./components/StockExplorer"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)" }}>
      Loading Stock Explorer…
    </div>
  ),
});

// ── Fallback static data ────────────────────────────────────────────────────
const FALLBACK_TICKER = [
  { symbol: "AAPL", price: "—", change: "—", up: true },
  { symbol: "TSLA", price: "—", change: "—", up: false },
  { symbol: "NVDA", price: "—", change: "—", up: true },
  { symbol: "MSFT", price: "—", change: "—", up: true },
  { symbol: "JPM",  price: "—", change: "—", up: false },
  { symbol: "AMZN", price: "—", change: "—", up: true },
  { symbol: "GOOG", price: "—", change: "—", up: true },
  { symbol: "BTC",  price: "—", change: "—", up: true },
  { symbol: "GS",   price: "—", change: "—", up: false },
  { symbol: "BAC",  price: "—", change: "—", up: true },
];

// ── Country config ──────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "US", flag: "🇺🇸", name: "United States",  exchange: "NYSE / NASDAQ" },
  { code: "IN", flag: "🇮🇳", name: "India",           exchange: "NSE / BSE"     },
  { code: "UK", flag: "🇬🇧", name: "United Kingdom",  exchange: "LSE"           },
  { code: "DE", flag: "🇩🇪", name: "Germany",         exchange: "XETRA / FSE"   },
  { code: "JP", flag: "🇯🇵", name: "Japan",           exchange: "TSE"           },
  { code: "AU", flag: "🇦🇺", name: "Australia",       exchange: "ASX"           },
  { code: "BR", flag: "🇧🇷", name: "Brazil",          exchange: "B3"            },
  { code: "CN", flag: "🇨🇳", name: "China",           exchange: "NYSE ADR"      },
];

// ── Example sentences ───────────────────────────────────────────────────────
const EXAMPLES = [
  { text: "Shares surged after strong earnings beat analyst estimates.", type: "pos", label: "Positive" },
  { text: "The firm is facing bankruptcy and a massive credit crisis.", type: "neg", label: "Negative" },
  { text: "The quarterly report showed revenue in line with forecasts.", type: "neu", label: "Neutral"  },
  { text: "Market volatility increased amid rising inflation and rate hike fears.", type: "neg", label: "Negative" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
const ARROW = { positive: "▲", neutral: "▬", negative: "▼" };
const MAX_CHARS = 2000;

function toPercent(val) {
  return `${(val * 100).toFixed(1)}%`;
}

// ── CountrySelector Component ────────────────────────────────────────────────
function CountrySelector({ countries, selected, open, onToggle, onSelect, onClose }) {
  const sel = countries.find((c) => c.code === selected);

  return (
    <div className="country-selector">
      {open && (
        <div className="dropdown-overlay" onClick={onClose} aria-hidden="true" />
      )}

      <button
        id="country-selector-btn"
        className={`country-btn ${open ? "open" : ""}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select market country"
      >
        <span className="country-btn-flag">{sel?.flag}</span>
        <span>{sel?.code}</span>
        <span className="country-btn-chevron">▼</span>
      </button>

      {open && (
        <div className="country-dropdown" role="listbox" aria-label="Market country">
          <div className="country-dropdown-header">Select Market</div>
          {countries.map((country) => (
            <button
              key={country.code}
              id={`country-option-${country.code}`}
              className={`country-option ${country.code === selected ? "active" : ""}`}
              role="option"
              aria-selected={country.code === selected}
              onClick={() => onSelect(country.code)}
            >
              <span className="country-option-flag">{country.flag}</span>
              <span className="country-option-info">
                <span className="country-option-name">{country.name}</span>
                <span className="country-option-exchange">{country.exchange}</span>
              </span>
              <span className="country-option-check">✓</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AnimatedBar — single confidence bar with count-up ───────────────────────
function AnimatedBar({ cls, value, delay, shouldReduce }) {
  const targetPct = Math.round((value ?? 0) * 100 * 10) / 10;
  const [displayPct, setDisplayPct] = useState(shouldReduce ? targetPct : 0);
  const [barWidth, setBarWidth] = useState(shouldReduce ? `${targetPct}%` : "0%");
  const started = useRef(false);

  useEffect(() => {
    if (shouldReduce) {
      setDisplayPct(targetPct);
      setBarWidth(`${targetPct}%`);
      return;
    }
    const timer = setTimeout(() => {
      setBarWidth(`${targetPct}%`);
      // count-up
      const duration = 900;
      let start = null;
      const step = (ts) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setDisplayPct(Math.round(ease * targetPct * 10) / 10);
        if (progress < 1) requestAnimationFrame(step);
        else setDisplayPct(targetPct);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timer);
  }, [targetPct, delay, shouldReduce]);

  return (
    <div className="proba-row">
      <span className={`proba-class ${cls}`}>{cls}</span>
      <div className="proba-track">
        <div
          className={`proba-fill ${cls}`}
          style={{
            width: barWidth,
            transition: shouldReduce ? "none" : "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <span className="proba-value">{displayPct.toFixed(1)}%</span>
    </div>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function HomePage() {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState("sentiment");

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ripple, setRipple] = useState(false);

  // ── Country + Ticker state ─────────────────────────────────────────────
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [countryOpen, setCountryOpen] = useState(false);
  const [tickerItems, setTickerItems] = useState(FALLBACK_TICKER);
  const [tickerLive, setTickerLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const tickerIntervalRef = useRef(null);

  const fetchQuotes = useCallback(async (country) => {
    try {
      const res = await fetch(`/api/quotes?country=${country}`, { cache: "no-store" });
      if (!res.ok) throw new Error("quotes fetch failed");
      const data = await res.json();
      if (data.quotes && data.quotes.length > 0) {
        setTickerItems(data.quotes);
        setTickerLive(true);
        setLastUpdated(new Date());
      }
    } catch {
      // silently keep showing previous / fallback data
    }
  }, []);

  useEffect(() => {
    setTickerItems(FALLBACK_TICKER);
    setTickerLive(false);
    fetchQuotes(selectedCountry);
    clearInterval(tickerIntervalRef.current);
    tickerIntervalRef.current = setInterval(() => fetchQuotes(selectedCountry), 30_000);
    return () => clearInterval(tickerIntervalRef.current);
  }, [fetchQuotes, selectedCountry]);

  // ── Analyze handler ────────────────────────────────────────────────────
  const analyze = useCallback(async (inputText) => {
    const trimmed = (inputText ?? text).trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setRipple(true);
    setTimeout(() => setRipple(false), 500);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err.message || "Unknown error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [text]);

  const handleChip = useCallback((example) => {
    setText(example.text);
    analyze(example.text);
  }, [analyze]);

  const charClass =
    text.length > MAX_CHARS ? "error" : text.length > MAX_CHARS * 0.85 ? "warn" : "";

  const sentiment = result?.sentiment ?? null;
  const probabilities = result?.probabilities ?? {};
  const lexTerms = result?.matched_lexicon_terms ?? [];
  const CLASS_ORDER = ["positive", "neutral", "negative"];
  const probRows = CLASS_ORDER.filter((c) => c in probabilities);

  // ── Entrance animation variants ────────────────────────────────────────
  const heroVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1, y: 0,
      transition: {
        type: "spring",
        stiffness: 280,
        damping: 26,
        delay: shouldReduce ? 0 : i * 0.08,
      },
    }),
  };

  const chipVariants = {
    hidden: { opacity: 0, scale: 0.88 },
    visible: (i) => ({
      opacity: 1, scale: 1,
      transition: {
        type: "spring",
        stiffness: 320,
        damping: 22,
        delay: shouldReduce ? 0 : 0.3 + i * 0.06,
      },
    }),
  };

  const tagVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i) => ({
      opacity: 1, scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 22,
        delay: shouldReduce ? 0 : i * 0.04,
      },
    }),
  };

  const tabContentVariants = {
    hidden: { opacity: 0, x: shouldReduce ? 0 : 16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit:   { opacity: 0, x: shouldReduce ? 0 : -16, transition: { duration: 0.18 } },
  };

  return (
    <>
      {/* ── Ticker Tape ─────────────────────────────────────────────────── */}
      <div className="ticker-wrapper" aria-label="Live market prices">
        <span style={{
          position: "absolute", left: 8, zIndex: 3,
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "var(--font-mono)", fontSize: 9,
          fontWeight: 700, letterSpacing: "0.06em",
          color: tickerLive ? "var(--accent-green)" : "var(--text-muted)",
          background: "var(--bg-surface)", padding: "0 6px",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: tickerLive ? "var(--accent-green)" : "var(--text-muted)",
            animation: tickerLive ? "pulse-dot 2s ease-in-out infinite" : "none",
            flexShrink: 0,
          }} />
          {tickerLive ? "LIVE" : "..."}
        </span>

        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="ticker-item">
              <span className="ticker-symbol">{item.symbol}</span>
              <span>{item.price}</span>
              <span className={item.up ? "ticker-up" : "ticker-down"}>
                {item.up ? "▲" : "▼"} {item.change}
              </span>
            </span>
          ))}
        </div>

        {lastUpdated && (
          <span style={{
            position: "absolute", right: 8, zIndex: 3,
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: "var(--text-muted)",
            background: "var(--bg-surface)", padding: "0 6px",
          }}>
            {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">📈</div>
          <span>FinSentiment</span>
        </div>
        <div className="navbar-right">
          <span className="navbar-badge">ML · LR · F1 0.64</span>
          <CountrySelector
            countries={COUNTRIES}
            selected={selectedCountry}
            open={countryOpen}
            onToggle={() => setCountryOpen((o) => !o)}
            onSelect={(code) => { setSelectedCountry(code); setCountryOpen(false); }}
            onClose={() => setCountryOpen(false)}
          />
        </div>
      </nav>

      {/* ── Tab Navigation ────────────────────────────────────────────── */}
      <div className="tab-nav" role="tablist" aria-label="App sections">
        <button
          id="tab-sentiment"
          role="tab"
          aria-selected={activeTab === "sentiment"}
          className={`tab-btn ${activeTab === "sentiment" ? "active" : ""}`}
          onClick={() => setActiveTab("sentiment")}
        >
          <span className="tab-btn-icon">🧠</span>
          Sentiment Analysis
        </button>
        <button
          id="tab-stock"
          role="tab"
          aria-selected={activeTab === "stock"}
          className={`tab-btn ${activeTab === "stock" ? "active" : ""}`}
          onClick={() => setActiveTab("stock")}
        >
          <span className="tab-btn-icon">📊</span>
          Stock Explorer
        </button>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── SENTIMENT TAB ─────────────────────────────────────────── */}
        {activeTab === "sentiment" && (
          <motion.div
            key="sentiment"
            className="tab-content"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <main className="page-wrapper">
              {/* ── Hero ───────────────────────────────────────────── */}
              <section className="hero">
                <motion.div
                  className="hero-eyebrow"
                  variants={heroVariants}
                  initial="hidden"
                  animate="visible"
                  custom={0}
                >
                  <div className="hero-eyebrow-dot" />
                  NLP · Financial Sentiment
                </motion.div>

                <motion.h1
                  variants={heroVariants}
                  initial="hidden"
                  animate="visible"
                  custom={1}
                >
                  Decode the Market <span>Sentiment</span>
                </motion.h1>

                <motion.p
                  className="hero-sub"
                  variants={heroVariants}
                  initial="hidden"
                  animate="visible"
                  custom={2}
                >
                  A Logistic Regression model trained on TF-IDF features and a 900+ term financial
                  lexicon classifies financial text as positive, neutral, or negative in real time.
                </motion.p>

                <motion.div
                  className="hero-stats"
                  variants={heroVariants}
                  initial="hidden"
                  animate="visible"
                  custom={3}
                >
                  <div className="hero-stat">
                    <span className="hero-stat-value">0.6408</span>
                    <span className="hero-stat-label">Macro F1</span>
                  </div>
                  <div className="hero-stat-divider" />
                  <div className="hero-stat">
                    <span className="hero-stat-value">3,005</span>
                    <span className="hero-stat-label">Features</span>
                  </div>
                  <div className="hero-stat-divider" />
                  <div className="hero-stat">
                    <span className="hero-stat-value">900+</span>
                    <span className="hero-stat-label">Lexicon Terms</span>
                  </div>
                  <div className="hero-stat-divider" />
                  <div className="hero-stat">
                    <span className="hero-stat-value">3</span>
                    <span className="hero-stat-label">Classes</span>
                  </div>
                </motion.div>
              </section>

              {/* ── Input Card ────────────────────────────────────── */}
              <motion.div
                className="input-card"
                variants={heroVariants}
                initial="hidden"
                animate="visible"
                custom={4}
              >
                <div className="input-label">
                  <span className="input-label-text">Financial Text</span>
                  <span className={`char-count ${charClass}`}>
                    {text.length} / {MAX_CHARS}
                  </span>
                </div>

                <textarea
                  id="sentiment-input"
                  rows={4}
                  value={text}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter a financial headline, earnings report excerpt, or market commentary…"
                  aria-label="Financial text to analyze"
                />

                {/* ── Example Chips ─────────────────────────────── */}
                <div className="chips-section">
                  <div className="chips-label">Try an example</div>
                  <div className="chips-row">
                    {EXAMPLES.map((ex, i) => (
                      <motion.button
                        key={i}
                        id={`example-chip-${i}`}
                        className="chip"
                        onClick={() => handleChip(ex)}
                        title={ex.text}
                        aria-label={`Example: ${ex.label} sentiment`}
                        variants={chipVariants}
                        initial="hidden"
                        animate="visible"
                        custom={i}
                        whileHover={shouldReduce ? {} : {
                          scale: 1.03,
                          boxShadow: "0 0 14px rgba(52,211,153,0.25)",
                          transition: { type: "spring", stiffness: 400, damping: 18 },
                        }}
                      >
                        <span className={`chip-dot ${ex.type}`} />
                        {ex.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* ── Analyze Button ────────────────────────────── */}
                <motion.button
                  id="analyze-btn"
                  className={`analyze-btn ${loading ? "loading" : ""}`}
                  onClick={() => analyze()}
                  disabled={loading || !text.trim()}
                  aria-label="Analyze sentiment"
                  animate={
                    ripple && !shouldReduce
                      ? { scale: [1, 0.97, 1.02, 1] }
                      : {}
                  }
                  transition={{ duration: 0.35 }}
                >
                  {loading ? (
                    <span className="dot-pulse" aria-label="Analyzing">
                      Analyzing <span /><span /><span />
                    </span>
                  ) : (
                    <>⚡ Analyze Sentiment</>
                  )}
                </motion.button>

                {/* ── Error ─────────────────────────────────────── */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="error-banner"
                      role="alert"
                      id="error-message"
                      initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      ⚠️ {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* ── Result Card ───────────────────────────────────── */}
              <AnimatePresence>
                {result && sentiment && (
                  <motion.div
                    className="result-card"
                    id="result-card"
                    aria-live="polite"
                    initial={shouldReduce ? {} : { opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ type: "spring", stiffness: 240, damping: 26 }}
                  >
                    <div className={`result-header ${sentiment}`}>
                      <div className="result-label-row">
                        <span className={`result-arrow ${sentiment}`}>
                          {ARROW[sentiment] ?? "●"}
                        </span>
                        <span className={`result-label-text ${sentiment}`}>
                          {sentiment}
                        </span>
                      </div>
                      <span className={`result-confidence-badge ${sentiment}`}>
                        {toPercent(probabilities[sentiment] ?? 0)} confidence
                      </span>
                    </div>

                    {/* Probability Bars — animated count-up + staggered */}
                    <div className="proba-section">
                      <div className="proba-section-title">Class Probabilities</div>
                      {probRows.map((cls, idx) => (
                        <AnimatedBar
                          key={cls}
                          cls={cls}
                          value={probabilities[cls]}
                          delay={shouldReduce ? 0 : idx * 100}
                          shouldReduce={shouldReduce}
                        />
                      ))}
                    </div>

                    {/* Matched Lexicon Terms — staggered pop-in */}
                    <div className="lex-section">
                      <div className="lex-section-title">
                        🔍 Matched Financial Lexicon Terms
                        {lexTerms.length > 0 && (
                          <span style={{ color: "var(--accent-blue)", marginLeft: 4 }}>
                            ({lexTerms.length})
                          </span>
                        )}
                      </div>
                      {lexTerms.length === 0 ? (
                        <div className="lex-empty">No lexicon terms matched in this text.</div>
                      ) : (
                        <div className="lex-terms">
                          {lexTerms.map((term, i) => (
                            <motion.span
                              key={i}
                              className="lex-term"
                              variants={tagVariants}
                              initial="hidden"
                              animate="visible"
                              custom={i}
                            >
                              {term}
                            </motion.span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* ── Footer ──────────────────────────────────────────── */}
            <footer className="footer">
              <div>FinSentiment · Financial Sentiment Analysis · School Project</div>
              <div style={{ marginTop: 6 }}>
                Model: Logistic Regression · TF-IDF (3 000 features) + Financial Lexicon (900+ terms) ·
                Macro F1: 0.6408
              </div>
            </footer>
          </motion.div>
        )}

        {/* ── STOCK EXPLORER TAB ────────────────────────────────────── */}
        {activeTab === "stock" && (
          <motion.div
            key="stock"
            className="tab-content"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="stock-page-wrapper">
              <StockExplorer />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </>
  );
}
