"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createChart, ColorType, AreaData } from "lightweight-charts";

// ── Popular tickers per country (autocomplete seed + trending view) ────────
const POPULAR = {
  US: [
    { symbol: "AAPL",  name: "Apple Inc." },
    { symbol: "MSFT",  name: "Microsoft Corporation" },
    { symbol: "NVDA",  name: "NVIDIA Corporation" },
    { symbol: "GOOGL", name: "Alphabet Inc." },
    { symbol: "AMZN",  name: "Amazon.com Inc." },
    { symbol: "TSLA",  name: "Tesla Inc." },
    { symbol: "META",  name: "Meta Platforms" },
    { symbol: "JPM",   name: "JPMorgan Chase" },
    { symbol: "V",     name: "Visa Inc." },
    { symbol: "BRK-B", name: "Berkshire Hathaway" },
    { symbol: "UNH",   name: "UnitedHealth Group" },
    { symbol: "JNJ",   name: "Johnson & Johnson" },
    { symbol: "XOM",   name: "Exxon Mobil" },
    { symbol: "WMT",   name: "Walmart Inc." },
    { symbol: "GS",    name: "Goldman Sachs" },
    { symbol: "BAC",   name: "Bank of America" },
  ],
  IN: [
    { symbol: "RELIANCE",    name: "Reliance Industries" },
    { symbol: "TCS",         name: "Tata Consultancy Services" },
    { symbol: "INFY",        name: "Infosys" },
    { symbol: "HDFCBANK",    name: "HDFC Bank" },
    { symbol: "ICICIBANK",   name: "ICICI Bank" },
    { symbol: "WIPRO",       name: "Wipro" },
    { symbol: "BHARTIARTL",  name: "Bharti Airtel" },
    { symbol: "LT",          name: "Larsen & Toubro" },
    { symbol: "SBIN",        name: "State Bank of India" },
    { symbol: "ITC",         name: "ITC Limited" },
    { symbol: "HINDUNILVR",  name: "Hindustan Unilever" },
    { symbol: "BAJFINANCE",  name: "Bajaj Finance" },
  ],
  UK: [
    { symbol: "HSBA",  name: "HSBC Holdings" },
    { symbol: "BP",    name: "BP plc" },
    { symbol: "GSK",   name: "GSK plc" },
    { symbol: "SHEL",  name: "Shell plc" },
    { symbol: "AZN",   name: "AstraZeneca" },
    { symbol: "ULVR",  name: "Unilever" },
    { symbol: "LLOY",  name: "Lloyds Banking Group" },
    { symbol: "RIO",   name: "Rio Tinto" },
    { symbol: "VOD",   name: "Vodafone Group" },
  ],
  JP: [
    { symbol: "7203",  name: "Toyota Motor" },
    { symbol: "6758",  name: "Sony Group" },
    { symbol: "9984",  name: "SoftBank Group" },
    { symbol: "7267",  name: "Honda Motor" },
    { symbol: "6861",  name: "Keyence" },
    { symbol: "8306",  name: "Mitsubishi UFJ" },
    { symbol: "9432",  name: "NTT" },
  ],
  DE: [
    { symbol: "SAP",   name: "SAP SE" },
    { symbol: "BMW",   name: "BMW AG" },
    { symbol: "SIE",   name: "Siemens AG" },
    { symbol: "ALV",   name: "Allianz SE" },
    { symbol: "BAYN",  name: "Bayer AG" },
    { symbol: "BAS",   name: "BASF SE" },
    { symbol: "VOW3",  name: "Volkswagen AG" },
    { symbol: "ADS",   name: "Adidas AG" },
  ],
  CA: [
    { symbol: "SHOP",  name: "Shopify Inc." },
    { symbol: "RY",    name: "Royal Bank of Canada" },
    { symbol: "TD",    name: "Toronto-Dominion Bank" },
    { symbol: "CNR",   name: "Canadian National Railway" },
    { symbol: "ENB",   name: "Enbridge Inc." },
    { symbol: "BCE",   name: "BCE Inc." },
  ],
  HK: [
    { symbol: "0700",  name: "Tencent Holdings" },
    { symbol: "0005",  name: "HSBC Holdings" },
    { symbol: "1299",  name: "AIA Group" },
    { symbol: "0941",  name: "China Mobile" },
    { symbol: "0388",  name: "HK Exchanges" },
  ],
  AU: [
    { symbol: "BHP",   name: "BHP Group" },
    { symbol: "CBA",   name: "Commonwealth Bank" },
    { symbol: "CSL",   name: "CSL Limited" },
    { symbol: "NAB",   name: "National Australia Bank" },
    { symbol: "WES",   name: "Wesfarmers" },
    { symbol: "ANZ",   name: "ANZ Banking Group" },
    { symbol: "MQG",   name: "Macquarie Group" },
  ],
};

const COUNTRIES = [
  { code: "US", flag: "🇺🇸", name: "United States",  suffix: ""    },
  { code: "IN", flag: "🇮🇳", name: "India",           suffix: ".NS" },
  { code: "UK", flag: "🇬🇧", name: "United Kingdom",  suffix: ".L"  },
  { code: "JP", flag: "🇯🇵", name: "Japan",           suffix: ".T"  },
  { code: "DE", flag: "🇩🇪", name: "Germany",         suffix: ".DE" },
  { code: "CA", flag: "🇨🇦", name: "Canada",          suffix: ".TO" },
  { code: "HK", flag: "🇭🇰", name: "Hong Kong",       suffix: ".HK" },
  { code: "AU", flag: "🇦🇺", name: "Australia",       suffix: ".AX" },
];

const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y", "MAX"];
const TRENDING_COUNT = 6;

// ── Animation variants ─────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24, delay: i * 0.06 },
  }),
};

const popIn = {
  hidden: { opacity: 0, scale: 0.82 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 22, delay: i * 0.04 },
  }),
};

// ── Skeleton shimmer ───────────────────────────────────────────────────────
function Skeleton({ width = "100%", height = "16px", style = {} }) {
  return (
    <div
      className="stock-skeleton"
      style={{ width, height, borderRadius: 6, ...style }}
    />
  );
}

// ── Lightweight Charts wrapper ─────────────────────────────────────────────
function PriceChart({ history, isUp, range }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !history?.length) return;

    // Destroy old chart if re-rendering
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const upColor   = "#34d399";
    const downColor = "#fb7185";
    const lineColor = isUp ? upColor : downColor;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(255,255,255,0.2)", width: 1 },
        horzLine: { color: "rgba(255,255,255,0.2)", width: 1 },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: range === "1D" || range === "5D",
        secondsVisible: false,
      },
      handleScale: { axisPressedMouseMove: true },
      width: containerRef.current.clientWidth,
      height: 280,
    });

    const series = chart.addAreaSeries({
      lineColor,
      topColor:    isUp ? "rgba(52,211,153,0.18)"  : "rgba(251,113,133,0.18)",
      bottomColor: isUp ? "rgba(52,211,153,0.01)"  : "rgba(251,113,133,0.01)",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: lineColor,
      crosshairMarkerBackgroundColor: "#121a2b",
    });

    const chartData = history.map((h) => ({ time: h.time, value: h.close }));
    series.setData(chartData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [history, isUp, range]);

  return <div ref={containerRef} className="stock-chart-container" />;
}

// ── Stat cell ──────────────────────────────────────────────────────────────
function StatCell({ label, value }) {
  return (
    <div className="stock-stat-cell">
      <span className="stock-stat-label">{label}</span>
      <span className="stock-stat-value">{value || "—"}</span>
    </div>
  );
}

// ── CountUp hook ───────────────────────────────────────────────────────────
function useCountUp(target, duration = 900, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(target); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      setVal(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
      else setVal(target);
    };
    requestAnimationFrame(step);
  }, [target, active, duration]);
  return val;
}

// ── Main StockExplorer component ───────────────────────────────────────────
export default function StockExplorer() {
  const shouldReduce = useReducedMotion();

  const [country, setCountry] = useState("US");
  const [countryOpen, setCountryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedStock, setSelectedStock] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRange, setActiveRange] = useState("1M");

  const [trendingData, setTrendingData] = useState({});
  const [trendingLoading, setTrendingLoading] = useState(false);

  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);

  const countryObj = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0];
  const popularList = POPULAR[country] || POPULAR["US"];
  const trending = popularList.slice(0, TRENDING_COUNT);

  // ── Autocomplete ─────────────────────────────────────────────────────
  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return; }

    debounceRef.current = setTimeout(() => {
      const lower = q.toLowerCase();
      const matches = popularList.filter(
        (t) =>
          t.symbol.toLowerCase().includes(lower) ||
          t.name.toLowerCase().includes(lower)
      ).slice(0, 8);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }, 300);
  };

  // ── Fetch stock detail ─────────────────────────────────────────────
  const fetchStock = useCallback(async (symbol, rangeKey = activeRange) => {
    setLoading(true);
    setError(null);
    setStockData(null);
    setSelectedStock(symbol);
    setShowSuggestions(false);
    setQuery("");

    try {
      const res = await fetch(
        `/api/stock?ticker=${encodeURIComponent(symbol)}&country=${country}&range=${rangeKey}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setStockData(data);
      setActiveRange(rangeKey);
    } catch (err) {
      setError(err.message || "Failed to load stock data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [country, activeRange]);

  // ── Change range ───────────────────────────────────────────────────
  const handleRangeChange = (r) => {
    if (selectedStock) fetchStock(selectedStock, r);
  };

  // ── Fetch trending preview prices ──────────────────────────────────
  useEffect(() => {
    setTrendingData({});
    setTrendingLoading(true);
    let cancelled = false;

    async function loadTrending() {
      const results = {};
      await Promise.allSettled(
        trending.map(async ({ symbol }) => {
          try {
            const res = await fetch(
              `/api/stock?ticker=${encodeURIComponent(symbol)}&country=${country}&range=1M`,
              { cache: "no-store" }
            );
            const data = await res.json();
            if (!data.error) results[symbol] = data;
          } catch {}
        })
      );
      if (!cancelled) { setTrendingData(results); setTrendingLoading(false); }
    }

    loadTrending();
    return () => { cancelled = true; };
  }, [country]);

  // ── Reset on country change ────────────────────────────────────────
  useEffect(() => {
    setSelectedStock(null);
    setStockData(null);
    setError(null);
    setQuery("");
    setSuggestions([]);
  }, [country]);

  const animProps = (variant, custom) =>
    shouldReduce
      ? {}
      : { variants: variant, initial: "hidden", animate: "visible", custom };

  return (
    <div className="stock-explorer" style={{ position: "relative", zIndex: 1 }}>

      {/* ── Search row ──────────────────────────────────────────────── */}
      <motion.div
        className="stock-search-row"
        {...(shouldReduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } })}
      >
        {/* Country picker */}
        <div className="country-selector" style={{ position: "relative" }}>
          {countryOpen && (
            <div className="dropdown-overlay" onClick={() => setCountryOpen(false)} aria-hidden="true" />
          )}
          <button
            id="stock-country-btn"
            className={`country-btn ${countryOpen ? "open" : ""}`}
            onClick={() => setCountryOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={countryOpen}
          >
            <span className="country-btn-flag">{countryObj.flag}</span>
            <span>{countryObj.code}</span>
            <span className="country-btn-chevron">▼</span>
          </button>
          {countryOpen && (
            <div className="country-dropdown" role="listbox">
              <div className="country-dropdown-header">Select Exchange</div>
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  id={`stock-country-${c.code}`}
                  className={`country-option ${c.code === country ? "active" : ""}`}
                  role="option"
                  aria-selected={c.code === country}
                  onClick={() => { setCountry(c.code); setCountryOpen(false); }}
                >
                  <span className="country-option-flag">{c.flag}</span>
                  <span className="country-option-info">
                    <span className="country-option-name">{c.name}</span>
                    <span className="country-option-exchange">{c.suffix || "No suffix"}</span>
                  </span>
                  <span className="country-option-check">✓</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="stock-search-wrap" style={{ position: "relative", flex: 1 }}>
          <span className="stock-search-icon">🔍</span>
          <input
            ref={searchInputRef}
            id="stock-search-input"
            className="stock-search-input"
            type="text"
            placeholder={`Search ticker or company… (e.g. ${popularList[0]?.symbol})`}
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query && setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
            spellCheck={false}
          />
          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                className="stock-autocomplete"
                initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{ transformOrigin: "top" }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.symbol}
                    id={`stock-suggestion-${s.symbol}`}
                    className="stock-suggestion-item"
                    onMouseDown={() => fetchStock(s.symbol)}
                  >
                    <span className="stock-suggestion-symbol">{s.symbol}</span>
                    <span className="stock-suggestion-name">{s.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Trending grid (when no stock selected) ────────────────────── */}
      <AnimatePresence mode="wait">
        {!selectedStock && !loading && (
          <motion.div
            key="trending"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="stock-section-label">
              <span className="stock-section-dot" />
              Popular in {countryObj.name}
            </div>
            <div className="stock-trending-grid">
              {trending.map((t, i) => {
                const d = trendingData[t.symbol];
                const isUp = d ? d.isUp : true;
                return (
                  <motion.button
                    key={t.symbol}
                    id={`trending-${t.symbol}`}
                    className={`stock-trending-card ${d ? (isUp ? "up" : "down") : ""}`}
                    onClick={() => fetchStock(t.symbol)}
                    {...(shouldReduce ? {} : {
                      variants: popIn,
                      initial: "hidden",
                      animate: "visible",
                      custom: i,
                      whileHover: { scale: 1.03, transition: { type: "spring", stiffness: 400, damping: 20 } },
                    })}
                  >
                    <div className="stock-trending-header">
                      <span className="stock-trending-symbol">{t.symbol}</span>
                      {trendingLoading && !d && (
                        <Skeleton width="48px" height="12px" />
                      )}
                      {d && (
                        <span className={`stock-trending-change ${isUp ? "up" : "down"}`}>
                          {isUp ? "▲" : "▼"} {d.changePct}%
                        </span>
                      )}
                    </div>
                    <div className="stock-trending-name">{t.name}</div>
                    {d ? (
                      <div className="stock-trending-price">{d.price}</div>
                    ) : (
                      <Skeleton width="60px" height="18px" style={{ marginTop: 6 }} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Loading state ──────────────────────────────────────────── */}
        {loading && (
          <motion.div
            key="loading"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="stock-loading-state"
          >
            <div className="stock-quote-skeleton">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <Skeleton width="60px" height="28px" />
                <div>
                  <Skeleton width="180px" height="14px" style={{ marginBottom: 8 }} />
                  <Skeleton width="100px" height="32px" />
                </div>
              </div>
              <div className="stock-stats-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="stock-stat-cell">
                    <Skeleton width="60%" height="11px" style={{ marginBottom: 6 }} />
                    <Skeleton width="80%" height="15px" />
                  </div>
                ))}
              </div>
              <Skeleton width="100%" height="280px" style={{ marginTop: 16, borderRadius: 12 }} />
            </div>
          </motion.div>
        )}

        {/* ── Error state ────────────────────────────────────────────── */}
        {error && !loading && (
          <motion.div
            key="error"
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="stock-error-state"
          >
            <div className="stock-error-icon">⚠️</div>
            <div className="stock-error-title">Ticker Not Found</div>
            <div className="stock-error-msg">{error}</div>
            <button
              className="stock-error-reset"
              onClick={() => { setSelectedStock(null); setError(null); }}
            >
              ← Back to Popular
            </button>
          </motion.div>
        )}

        {/* ── Stock detail ───────────────────────────────────────────── */}
        {stockData && !loading && (
          <motion.div
            key={`stock-${selectedStock}-${activeRange}`}
            initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
          >
            {/* Back button */}
            <button
              className="stock-back-btn"
              onClick={() => { setSelectedStock(null); setStockData(null); setError(null); }}
            >
              ← Popular
            </button>

            {/* Quote header */}
            <div className={`stock-quote-header ${stockData.isUp ? "up" : "down"}`}>
              <div className="stock-quote-left">
                <div className="stock-quote-ticker-badge">{stockData.ticker}</div>
                <div className="stock-quote-name">{stockData.name}</div>
                <div className="stock-quote-price-row">
                  <span className="stock-quote-price">
                    {stockData.currency !== "USD" ? stockData.currency + " " : "$"}
                    {stockData.price}
                  </span>
                  <span className={`stock-quote-change ${stockData.isUp ? "up" : "down"}`}>
                    {stockData.isUp ? "▲" : "▼"} {stockData.isUp ? "+" : ""}{stockData.change}{" "}
                    ({stockData.isUp ? "+" : ""}{stockData.changePct}%)
                  </span>
                </div>
              </div>
              {stockData.exchange && (
                <div className="stock-quote-exchange">{stockData.exchange}</div>
              )}
            </div>

            {/* Stats grid */}
            <div className="stock-stats-grid">
              <StatCell label="Open"          value={stockData.open} />
              <StatCell label="Day High"      value={stockData.high} />
              <StatCell label="Day Low"       value={stockData.low} />
              <StatCell label="Prev. Close"   value={stockData.prevClose} />
              <StatCell label="Volume"        value={stockData.volume} />
              <StatCell label="Market Cap"    value={stockData.marketCap} />
              <StatCell label="52W High"      value={stockData.week52High} />
              <StatCell label="52W Low"       value={stockData.week52Low} />
            </div>

            {/* Range selector */}
            <div className="stock-range-row">
              {RANGES.map((r) => (
                <button
                  key={r}
                  id={`range-btn-${r}`}
                  className={`stock-range-btn ${activeRange === r ? "active" : ""}`}
                  onClick={() => handleRangeChange(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div className="stock-chart-card">
              {stockData.history?.length > 0 ? (
                <PriceChart
                  history={stockData.history}
                  isUp={stockData.isUp}
                  range={activeRange}
                />
              ) : (
                <div className="stock-chart-empty">No chart data available for this range.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
