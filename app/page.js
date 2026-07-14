"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ── Fallback static data (shown until live data loads or on error) ─────────
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

// ── Country config ────────────────────────────────────────────────────────
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

// ── Example sentences ─────────────────────────────────────────────────────
const EXAMPLES = [
  { text: "Shares surged after strong earnings beat analyst estimates.", type: "pos", label: "Positive" },
  { text: "The firm is facing bankruptcy and a massive credit crisis.", type: "neg", label: "Negative" },
  { text: "The quarterly report showed revenue in line with forecasts.", type: "neu", label: "Neutral"  },
  { text: "Market volatility increased amid rising inflation and rate hike fears.", type: "neg", label: "Negative" },
];

// ── Helpers ───────────────────────────────────────────────────────────────
const ARROW = { positive: "▲", neutral: "▬", negative: "▼" };
const MAX_CHARS = 2000;

function toPercent(val) {
  return `${(val * 100).toFixed(1)}%`;
}

// ── CountrySelector Component ─────────────────────────────────────────────
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

// ── Main Page Component ───────────────────────────────────────────────────
export default function HomePage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ── Country + Ticker state ────────────────────────────────────────────
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

  // ── Analyze handler ───────────────────────────────────────────────────
  const analyze = useCallback(async (inputText) => {
    const trimmed = (inputText ?? text).trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);
    setError(null);

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

  return (
    <>
      {/* ── Ticker Tape ──────────────────────────────────────────────── */}
      <div className="ticker-wrapper" aria-label="Live market prices">
        {/* Live indicator */}
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

        {/* Last updated timestamp */}
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

      {/* ── Navbar ───────────────────────────────────────────────────── */}
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

      {/* ── Page body ────────────────────────────────────────────────── */}
      <main className="page-wrapper">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-dot" />
            NLP · Financial Sentiment
          </div>

          <h1>
            Decode the Market <span>Sentiment</span>
          </h1>

          <p className="hero-sub">
            A Logistic Regression model trained on TF-IDF features and a 900+ term financial
            lexicon classifies financial text as positive, neutral, or negative in real time.
          </p>

          <div className="hero-stats">
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
          </div>
        </section>

        {/* ── Input Card ───────────────────────────────────────────── */}
        <div className="input-card">
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

          {/* ── Example Chips ──────────────────────────────────────── */}
          <div className="chips-section">
            <div className="chips-label">Try an example</div>
            <div className="chips-row">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  id={`example-chip-${i}`}
                  className="chip"
                  onClick={() => handleChip(ex)}
                  title={ex.text}
                  aria-label={`Example: ${ex.label} sentiment`}
                >
                  <span className={`chip-dot ${ex.type}`} />
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Analyze Button ─────────────────────────────────────── */}
          <button
            id="analyze-btn"
            className={`analyze-btn ${loading ? "loading" : ""}`}
            onClick={() => analyze()}
            disabled={loading || !text.trim()}
            aria-label="Analyze sentiment"
          >
            {loading ? (
              <>
                <div className="spinner" />
                Analyzing…
              </>
            ) : (
              <>⚡ Analyze Sentiment</>
            )}
          </button>

          {/* ── Error ──────────────────────────────────────────────── */}
          {error && (
            <div className="error-banner" role="alert" id="error-message">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Result Card ──────────────────────────────────────────── */}
        {result && sentiment && (
          <div className="result-card" id="result-card" aria-live="polite">
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

            {/* Probability Bars */}
            <div className="proba-section">
              <div className="proba-section-title">Class Probabilities</div>
              {probRows.map((cls) => (
                <div key={cls} className="proba-row">
                  <span className={`proba-class ${cls}`}>{cls}</span>
                  <div className="proba-track">
                    <div
                      className={`proba-fill ${cls}`}
                      style={{ width: toPercent(probabilities[cls]) }}
                    />
                  </div>
                  <span className="proba-value">{toPercent(probabilities[cls])}</span>
                </div>
              ))}
            </div>

            {/* Matched Lexicon Terms */}
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
                    <span key={i} className="lex-term">{term}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="footer">
        <div>FinSentiment · Financial Sentiment Analysis · School Project</div>
        <div style={{ marginTop: 6 }}>
          Model: Logistic Regression · TF-IDF (3 000 features) + Financial Lexicon (900+ terms) ·
          Macro F1: 0.6408
        </div>
      </footer>
    </>
  );
}
