"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import dynamic from "next/dynamic";
import { appendHistory } from "./components/HistoryPanel";
import ShareButton from "./components/ShareButton";

const ThemeToggle = dynamic(() => import("./components/ThemeToggle"), {
  ssr: false,
});

// Lazy-load StockExplorer so lightweight-charts only loads on demand
const StockExplorer = dynamic(() => import("./components/StockExplorer"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)" }}>
      Loading Stock Explorer…
    </div>
  ),
});

const CandleTransition = dynamic(() => import("./components/CandleTransition"), {
  ssr: false,
});

const OnboardingOverlay = dynamic(() => import("./components/OnboardingOverlay"), {
  ssr: false,
});

const HistoryPanel = dynamic(() => import("./components/HistoryPanel"), {
  ssr: false,
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


// ── CountUpStat — animates from 0 to a numeric target ───────────────────────
function CountUpStat({ rawValue, display, active, shouldReduce }) {
  // rawValue: numeric to count up to. display: formatted string to show at end.
  // active: boolean — start counting when true
  const [shown, setShown] = useState(shouldReduce ? display : "0");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current || shouldReduce) {
      if (shouldReduce) setShown(display);
      return;
    }
    startedRef.current = true;
    const duration = 700;
    let startTs = null;
    const step = (ts) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(ease * rawValue);
      // Format with commas if rawValue >= 1000
      if (rawValue >= 1000) {
        setShown(current.toLocaleString());
      } else if (rawValue < 10) {
        // Keep decimal for small floats like 0.6408
        setShown((ease * rawValue).toFixed(4));
      } else {
        setShown(String(current));
      }
      if (progress < 1) requestAnimationFrame(step);
      else setShown(display);
    };
    requestAnimationFrame(step);
  }, [active, rawValue, display, shouldReduce]);

  return <span className="hero-stat-value">{shown}</span>;
}


// ── Main Page Component ──────────────────────────────────────────────────────
export default function HomePage() {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab]           = useState("sentiment");
  const [showTransition, setShowTransition] = useState(false);
  const [transitionDir, setTransitionDir]   = useState("toStock");

  const switchTab = (tab) => {
    if (tab === activeTab || shouldReduce) { setActiveTab(tab); return; }
    const dir = tab === "stock" ? "toStock" : "toSentiment";
    setTransitionDir(dir);
    setShowTransition(true);
    // After candle animation plays (~550ms), switch tab and fade out overlay
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => setShowTransition(false), 220);
    }, 500);
  };

  // ── Onboarding state ────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("hasSeenOnboarding")) setShowOnboarding(true);
  }, []);
  const dismissOnboarding = () => {
    localStorage.setItem("hasSeenOnboarding", "1");
    setShowOnboarding(false);
  };

  // ── Batch mode state ─────────────────────────────────────────────────────
  const [mode, setMode]             = useState("single"); // "single" | "batch"
  const [batchText, setBatchText]   = useState("");
  const [batchResults, setBatchResults] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // ── Result export ref ────────────────────────────────────────────────────
  const resultCardRef = useRef(null);

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
      // Append to localStorage history
      try {
        const conf = data.probabilities?.[data.sentiment];
        appendHistory({
          text: trimmed,
          sentiment: data.sentiment,
          confidence: conf != null ? Math.round(conf * 1000) / 10 : 0,
        });
        window.dispatchEvent(new Event("sentiment-history-updated"));
      } catch {}
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

  // ── Batch analyze handler ─────────────────────────────────────────────────
  const analyzeBatch = useCallback(async () => {
    const lines = batchText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    if (lines.length > 50) { alert("Maximum 50 headlines per batch. Please trim your input."); return; }
    setBatchLoading(true);
    setBatchResults([]);
    try {
      const res  = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: lines }),
      });
      const data = await res.json();
      const scores = data.scores || [];
      setBatchResults(lines.map((line, i) => ({
        text: line,
        sentiment:  scores[i]?.sentiment  || "neutral",
        confidence: scores[i]?.confidence || 0,
      })));
    } catch {
      alert("Batch scoring failed. Please try again.");
    } finally {
      setBatchLoading(false);
    }
  }, [batchText]);

  // ── CSV download ──────────────────────────────────────────────────────────
  const downloadCSV = () => {
    if (!batchResults.length) return;
    const header = "Headline,Sentiment,Confidence %";
    const rows   = batchResults.map((r) =>
      `"${r.text.replace(/"/g, '""')}",${r.sentiment},${r.confidence.toFixed(1)}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sentiment-batch.csv";
    a.click();
  };

  // ── Export result card ────────────────────────────────────────────────────
  const exportResultCard = async () => {
    if (!resultCardRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(resultCardRef.current, { backgroundColor: "#0a0f1c", pixelRatio: 2 });
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        alert("✓ Copied to clipboard!");
      } catch {
        const a = document.createElement("a");
        a.href = dataUrl; a.download = "sentiment-result.png"; a.click();
      }
    } catch { alert("Export failed. Please try again."); }
  };

  const charClass =
    text.length > MAX_CHARS ? "error" : text.length > MAX_CHARS * 0.85 ? "warn" : "";

  const sentiment = result?.sentiment ?? null;
  const probabilities = result?.probabilities ?? {};
  const lexTerms = result?.matched_lexicon_terms ?? [];
  const CLASS_ORDER = ["positive", "neutral", "negative"];
  const probRows = CLASS_ORDER.filter((c) => c in probabilities);

  // ── Hero entrance state (Part F) ──────────────────────────────────────
  // heroStage: 0 = not started, 1-5 = stages revealed sequentially.
  // Gated by sessionStorage so it only plays once per browser session.
  // Tab switches use tabContentVariants only — heroStage is NOT reset on tab change.
  const [heroStage, setHeroStage] = useState(0);
  const heroTimersRef = useRef([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("heroPlayed")) { setHeroStage(5); return; }
    if (shouldReduce) { setHeroStage(5); sessionStorage.setItem("heroPlayed", "1"); return; }
    // Stage delays: 0 / 300 / 600 / 900 / 1200ms
    [0, 300, 600, 900, 1200].forEach((delay, idx) => {
      const t = setTimeout(() => setHeroStage(idx + 1), delay);
      heroTimersRef.current.push(t);
    });
    const done = setTimeout(() => sessionStorage.setItem("heroPlayed", "1"), 1600);
    heroTimersRef.current.push(done);
    return () => heroTimersRef.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nudge hero stage forward (used by scroll-jack)
  const nudgeHeroStage = useCallback(() => {
    setHeroStage((prev) => {
      if (prev >= 5) return 5;
      heroTimersRef.current.forEach(clearTimeout);
      heroTimersRef.current = [];
      const next = prev + 1;
      for (let i = next; i <= 5; i++) {
        const t = setTimeout(() => setHeroStage(i), (i - next) * 80);
        heroTimersRef.current.push(t);
      }
      const done = setTimeout(() => sessionStorage.setItem("heroPlayed", "1"), (5 - next) * 80 + 100);
      heroTimersRef.current.push(done);
      return prev;
    });
  }, []);

  // ── Scroll-jack (Part H) ────────────────────────────────────────────────
  // Only fires on first page load per session, desktop non-touch only.
  // Max 2 wheel events intercepted, then fully releases.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("scrollJackDone")) return;
    if (sessionStorage.getItem("heroPlayed")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.innerWidth <= 640) return;

    let interceptCount = 0;
    let debounceTimer  = null;
    let released       = false;

    const release = () => {
      if (released) return;
      released = true;
      window.removeEventListener("wheel", onWheel);
      sessionStorage.setItem("scrollJackDone", "1");
    };
    // Auto-release after 2s regardless
    const autoRelease = setTimeout(release, 2000);

    const onWheel = (e) => {
      if (released) return;
      // 120ms debounce: trackpad fires rapid micro-events — treat burst as one input
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => { debounceTimer = null; }, 120);
      interceptCount++;
      e.preventDefault();
      nudgeHeroStage();
      if (interceptCount >= 2) { clearTimeout(autoRelease); release(); }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => { clearTimeout(autoRelease); clearTimeout(debounceTimer); release(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeHeroStage]);

  // ── Stage helpers ───────────────────────────────────────────────────────
  const sv = (n) => heroStage >= n; // stageVisible(n)
  const springBase = { type: "spring", stiffness: 260, damping: 28 };

  const stageVariant = () => ({
    hidden:  { opacity: 0, y: shouldReduce ? 0 : 22 },
    visible: { opacity: 1, y: 0, transition: shouldReduce ? { duration: 0.01 } : springBase },
  });

  // Word-reveal for h1 (Stage 2) — each word clips in from below
  const H1_WORDS  = ["Decode", "the", "Market"];
  const SPAN_WORD = "Sentiment";
  const wordReveal = (wordIdx) => ({
    hidden:  { opacity: 0, y: shouldReduce ? 0 : 18, clipPath: "inset(0 0 100% 0)" },
    visible: {
      opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)",
      transition: shouldReduce ? { duration: 0.01 } : { ...springBase, delay: wordIdx * 0.06 },
    },
  });

  const chipVariants = {
    hidden: { opacity: 0, scale: 0.88 },
    visible: (i) => ({
      opacity: 1, scale: 1,
      transition: { type: "spring", stiffness: 320, damping: 22, delay: shouldReduce ? 0 : i * 0.06 },
    }),
  };

  const tagVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (i) => ({
      opacity: 1, scale: 1,
      transition: { type: "spring", stiffness: 400, damping: 22, delay: shouldReduce ? 0 : i * 0.04 },
    }),
  };

  const tabContentVariants = {
    hidden:  { opacity: 0, x: shouldReduce ? 0 : 16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
    exit:    { opacity: 0, x: shouldReduce ? 0 : -16, transition: { duration: 0.18 } },
  };



  return (
    <>
      {/* ── Onboarding overlay (first visit only) ──────────────── */}
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingOverlay key="onboarding" onDismiss={dismissOnboarding} />
        )}
      </AnimatePresence>

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
          <ThemeToggle />
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
          onClick={() => switchTab("sentiment")}
        >
          <span className="tab-btn-icon">🧠</span>
          Sentiment Analysis
        </button>
        <button
          id="tab-stock"
          role="tab"
          aria-selected={activeTab === "stock"}
          className={`tab-btn ${activeTab === "stock" ? "active" : ""}`}
          onClick={() => switchTab("stock")}
        >
          <span className="tab-btn-icon">📊</span>
          Stock Explorer
        </button>
      </div>

      {/* ── Candlestick transition overlay ──────────────────────────── */}
      <AnimatePresence>
        {showTransition && !shouldReduce && (
          <CandleTransition key="candle-overlay" direction={transitionDir} />
        )}
      </AnimatePresence>

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
              {/* Stage 1-2: eyebrow + title */}
              <section className="hero">

                <motion.div
                  className="hero-eyebrow"
                  variants={stageVariant()}
                  initial="hidden"
                  animate={sv(2) ? "visible" : "hidden"}
                >
                  <div className="hero-eyebrow-dot" />
                  NLP · Financial Sentiment
                </motion.div>

                {/* h1: hover-reveal title (Part I) */}
                <motion.h1 
                  className="title-hover"
                  data-text="Decode the Market Sentiment"
                  variants={stageVariant(2)}
                  initial="hidden"
                  animate={sv(2) ? "visible" : "hidden"}
                >
                  <span className="actual-text">Decode the Market Sentiment</span>
                  <span aria-hidden="true" className="hover-text">Decode the Market Sentiment</span>
                </motion.h1>

                {/* Stage 3: subtitle */}
                <motion.p
                  className="hero-sub"
                  variants={stageVariant()}
                  initial="hidden"
                  animate={sv(3) ? "visible" : "hidden"}
                >
                  A Logistic Regression model trained on TF-IDF features and a 900+ term financial
                  lexicon classifies financial text as positive, neutral, or negative in real time.
                </motion.p>

                {/* Stage 4: stats row with count-up */}
                <motion.div
                  className="hero-stats"
                  variants={stageVariant()}
                  initial="hidden"
                  animate={sv(4) ? "visible" : "hidden"}
                >
                  <div className="hero-stat">
                    <CountUpStat rawValue={0.6408} display="0.6408" active={sv(4)} shouldReduce={shouldReduce} />
                    <span className="hero-stat-label">Macro F1</span>
                  </div>
                  <div className="hero-stat-divider" />
                  <div className="hero-stat">
                    <CountUpStat rawValue={3005} display="3,005" active={sv(4)} shouldReduce={shouldReduce} />
                    <span className="hero-stat-label">Features</span>
                  </div>
                  <div className="hero-stat-divider" />
                  <div className="hero-stat">
                    <CountUpStat rawValue={900} display="900+" active={sv(4)} shouldReduce={shouldReduce} />
                    <span className="hero-stat-label">Lexicon Terms</span>
                  </div>
                  <div className="hero-stat-divider" />
                  <div className="hero-stat">
                    <CountUpStat rawValue={3} display="3" active={sv(4)} shouldReduce={shouldReduce} />
                    <span className="hero-stat-label">Classes</span>
                  </div>
                </motion.div>
              </section>


              {/* ── Mode toggle: Single | Batch ──────────────────── */}
              <div className="mode-toggle" role="group" aria-label="Analysis mode">
                <button
                  id="mode-single"
                  className={`mode-btn ${mode === "single" ? "active" : ""}`}
                  onClick={() => { setMode("single"); setBatchResults([]); }}
                >
                  Single
                </button>
                <button
                  id="mode-batch"
                  className={`mode-btn ${mode === "batch" ? "active" : ""}`}
                  onClick={() => setMode("batch")}
                >
                  Batch
                </button>
              </div>

              {/* Stage 5: input card rises last (1200ms) */}
              <motion.div
                className="input-card"
                variants={stageVariant()}
                initial="hidden"
                animate={sv(5) ? "visible" : "hidden"}
              >

                <div className="input-label">
                  <span className="input-label-text">Financial Text</span>
                  <span className={`char-count ${charClass}`}>
                    {text.length} / {MAX_CHARS}
                  </span>
                </div>

                {mode === "single" ? (
                  <textarea
                    id="sentiment-input"
                    rows={4}
                    value={text}
                    maxLength={MAX_CHARS}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter a financial headline, earnings report excerpt, or market commentary…"
                    aria-label="Financial text to analyze"
                  />
                ) : (
                  <textarea
                    id="batch-input"
                    rows={8}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={`Paste multiple headlines — one per line (max 50):\n\nApple reports record quarterly revenue…\nFed signals rate hike amid inflation…\nCompany files for bankruptcy protection…`}
                    aria-label="Batch headlines to analyze"
                  />
                )}

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
                  className={`analyze-btn ${loading || batchLoading ? "loading" : ""}`}
                  onClick={() => mode === "batch" ? analyzeBatch() : analyze()}
                  disabled={
                    mode === "single"
                      ? (loading || !text.trim())
                      : (batchLoading || !batchText.trim())
                  }
                  aria-label={mode === "batch" ? "Analyze batch headlines" : "Analyze sentiment"}
                  animate={
                    ripple && !shouldReduce
                      ? { scale: [1, 0.97, 1.02, 1] }
                      : {}
                  }
                  transition={{ duration: 0.35 }}
                >
                  {loading || batchLoading ? (
                    <span className="dot-pulse" aria-label="Analyzing">
                      Analyzing <span /><span /><span />
                    </span>
                  ) : mode === "batch" ? (
                    <>⚡ Analyze Batch</>
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

              {/* ── Analyze / Batch Analyze Button section is below */}

              {/* ── Result Card ───────────────────────────────────── */}
              <AnimatePresence>
                {result && sentiment && mode === "single" && (
                  <motion.div
                    ref={resultCardRef}
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`result-confidence-badge ${sentiment}`}>
                          {toPercent(probabilities[sentiment] ?? 0)} confidence
                        </span>
                        <ShareButton />
                        <button
                          className="export-btn"
                          onClick={exportResultCard}
                          title="Export result as image"
                          aria-label="Export result as image"
                        >
                          ⬇ Export
                        </button>
                      </div>
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


              {/* ── Batch results table ──────────────────────────── */}
              {mode === "batch" && batchResults.length > 0 && (
                <div className="batch-results">
                  <div className="batch-results-header">
                    <span>Batch Results ({batchResults.length} headlines)</span>
                    <button className="batch-csv-btn" onClick={downloadCSV}>⬇ Download CSV</button>
                  </div>
                  <div className="batch-table-wrap">
                    <table className="batch-table">
                      <thead>
                        <tr><th>Headline</th><th>Sentiment</th><th>Confidence</th></tr>
                      </thead>
                      <tbody>
                        {batchResults.map((r, i) => (
                          <tr key={i}>
                            <td className="batch-text">{r.text.length > 80 ? r.text.slice(0, 80) + "…" : r.text}</td>
                            <td><span className={`result-confidence-badge ${r.sentiment}`}>{r.sentiment}</span></td>
                            <td className="batch-conf">{r.confidence.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── History Panel ────────────────────────────────── */}
              <HistoryPanel />
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
