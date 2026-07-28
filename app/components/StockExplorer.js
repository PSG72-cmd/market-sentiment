"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ── Popular tickers per country (trending grid only — not used for search) ─
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
    { symbol: "XOM",   name: "Exxon Mobil" },
  ],
  IN: [
    { symbol: "RELIANCE",   name: "Reliance Industries" },
    { symbol: "TCS",        name: "Tata Consultancy" },
    { symbol: "INFY",       name: "Infosys" },
    { symbol: "HDFCBANK",   name: "HDFC Bank" },
    { symbol: "ICICIBANK",  name: "ICICI Bank" },
    { symbol: "WIPRO",      name: "Wipro" },
    { symbol: "BHARTIARTL", name: "Bharti Airtel" },
    { symbol: "LT",         name: "Larsen & Toubro" },
    { symbol: "SBIN",       name: "State Bank of India" },
    { symbol: "ITC",        name: "ITC Limited" },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
    { symbol: "BAJFINANCE", name: "Bajaj Finance" },
  ],
  UK: [
    { symbol: "HSBA",  name: "HSBC Holdings" },
    { symbol: "BP",    name: "BP plc" },
    { symbol: "GSK",   name: "GSK plc" },
    { symbol: "SHEL",  name: "Shell plc" },
    { symbol: "AZN",   name: "AstraZeneca" },
    { symbol: "ULVR",  name: "Unilever" },
    { symbol: "LLOY",  name: "Lloyds Banking" },
    { symbol: "RIO",   name: "Rio Tinto" },
    { symbol: "VOD",   name: "Vodafone Group" },
  ],
  JP: [
    { symbol: "7203", name: "Toyota Motor" },
    { symbol: "6758", name: "Sony Group" },
    { symbol: "9984", name: "SoftBank Group" },
    { symbol: "7267", name: "Honda Motor" },
    { symbol: "8306", name: "Mitsubishi UFJ" },
    { symbol: "9432", name: "NTT" },
  ],
  DE: [
    { symbol: "SAP",  name: "SAP SE" },
    { symbol: "BMW",  name: "BMW AG" },
    { symbol: "SIE",  name: "Siemens AG" },
    { symbol: "ALV",  name: "Allianz SE" },
    { symbol: "BAYN", name: "Bayer AG" },
    { symbol: "BAS",  name: "BASF SE" },
    { symbol: "VOW3", name: "Volkswagen AG" },
    { symbol: "ADS",  name: "Adidas AG" },
  ],
  CA: [
    { symbol: "SHOP", name: "Shopify Inc." },
    { symbol: "RY",   name: "Royal Bank of Canada" },
    { symbol: "TD",   name: "Toronto-Dominion Bank" },
    { symbol: "CNR",  name: "Canadian National Railway" },
    { symbol: "ENB",  name: "Enbridge Inc." },
  ],
  HK: [
    { symbol: "0700", name: "Tencent Holdings" },
    { symbol: "0005", name: "HSBC Holdings" },
    { symbol: "1299", name: "AIA Group" },
    { symbol: "0941", name: "China Mobile" },
  ],
  AU: [
    { symbol: "BHP", name: "BHP Group" },
    { symbol: "CBA", name: "Commonwealth Bank" },
    { symbol: "CSL", name: "CSL Limited" },
    { symbol: "NAB", name: "National Australia Bank" },
    { symbol: "WES", name: "Wesfarmers" },
    { symbol: "ANZ", name: "ANZ Banking Group" },
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
const DRAW_TOOLS = [
  { id: "trendline", label: "╱", title: "Trendline" },
  { id: "hline",     label: "—", title: "Horizontal Line" },
  { id: "arrow",     label: "↗", title: "Arrow" },
  { id: "marker",    label: "◉", title: "Marker / Dot" },
  { id: "eraser",    label: "⌫", title: "Eraser" },
];

const SENT_COLOR = { positive: "up", negative: "down", neutral: "neutral-badge" };
const SENT_LABEL = { positive: "▲ POS", negative: "▼ NEG", neutral: "▬ NEU" };

// ── Animation variants ─────────────────────────────────────────────────────
const popIn = {
  hidden: { opacity: 0, scale: 0.82 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 22, delay: i * 0.04 },
  }),
};

// ── Helpers ────────────────────────────────────────────────────────────────
function Skeleton({ width = "100%", height = "16px", style = {} }) {
  return <div className="stock-skeleton" style={{ width, height, borderRadius: 6, ...style }} />;
}

function StatCell({ label, value }) {
  return (
    <div className="stock-stat-cell">
      <span className="stock-stat-label">{label}</span>
      <span className="stock-stat-value">{value || "—"}</span>
    </div>
  );
}

// ── Drawing Toolbar + SVG overlay ──────────────────────────────────────────
function DrawingLayer({ chartRef, seriesRef, isActive, onClearConfirm }) {
  const svgRef        = useRef(null);
  const containerRef  = useRef(null);
  const [activeTool, setActiveTool]   = useState(null);
  const [drawings, setDrawings]       = useState([]);
  const [inProgress, setInProgress]   = useState(null); // {type, pts[]}
  const [dims, setDims]               = useState({ w: 0, h: 0 });

  // Keep SVG sized to chart container
  useEffect(() => {
    const el = chartRef.current?._container || svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartRef]);

  // Convert pixel → { time, price }
  const pxToData = useCallback((x, y) => {
    const chart  = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return null;
    try {
      const time  = chart.timeScale().coordinateToTime(x);
      const price = series.coordinateToPrice(y);
      if (time == null || price == null) return null;
      return { time, price };
    } catch { return null; }
  }, [chartRef, seriesRef]);

  // Convert { time, price } → pixel
  const dataToPixel = useCallback(({ time, price }) => {
    const chart  = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return { x: 0, y: 0 };
    try {
      const x = chart.timeScale().timeToCoordinate(time) || 0;
      const y = series.priceToCoordinate(price) || 0;
      return { x, y };
    } catch { return { x: 0, y: 0 }; }
  }, [chartRef, seriesRef]);

  const getSVGPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    if (!activeTool || activeTool === "eraser") return;
    e.preventDefault();
    const pt = getSVGPoint(e);
    const dp = pxToData(pt.x, pt.y);
    if (!dp) return;
    setInProgress({ type: activeTool, start: dp, startPx: pt, endPx: pt, end: dp });
  };

  const handleMouseMove = (e) => {
    if (!inProgress) return;
    const pt = getSVGPoint(e);
    const dp = pxToData(pt.x, pt.y);
    setInProgress((prev) => ({ ...prev, endPx: pt, end: dp || prev.end }));
  };

  const handleMouseUp = (e) => {
    if (!inProgress) return;
    const pt = getSVGPoint(e);
    const dp = pxToData(pt.x, pt.y);
    const end = dp || inProgress.end;
    const newDrawing = { id: Date.now(), type: inProgress.type, start: inProgress.start, end };
    setDrawings((d) => [...d, newDrawing]);
    setInProgress(null);
  };

  const handleClick = (e) => {
    if (!activeTool) return;
    if (activeTool === "eraser") return; // eraser handled on SVG elements
    // marker: single click
    if (activeTool === "marker" || activeTool === "hline") {
      const pt = getSVGPoint(e);
      const dp = pxToData(pt.x, pt.y);
      if (!dp) return;
      setDrawings((d) => [...d, { id: Date.now(), type: activeTool, start: dp, end: dp }]);
    }
  };

  const eraseDrawing = (id) => {
    if (activeTool === "eraser") setDrawings((d) => d.filter((dr) => dr.id !== id));
  };

  const clearAll = () => {
    if (drawings.length === 0) return;
    if (window.confirm("Clear all drawings on this chart?")) {
      setDrawings([]);
      setInProgress(null);
    }
  };

  // Expose clear method to parent
  useEffect(() => {
    if (onClearConfirm) onClearConfirm.current = clearAll;
  });

  const renderDrawing = (dr, preview = false) => {
    const s = dataToPixel(dr.start);
    const e = dataToPixel(dr.end);
    const key = dr.id || "preview";

    switch (dr.type) {
      case "trendline":
        return (
          <line key={key} x1={s.x} y1={s.y} x2={e.x} y2={e.y}
            stroke="#34d399" strokeWidth={preview ? 1.5 : 2} strokeDasharray={preview ? "4 3" : undefined}
            strokeLinecap="round" onClick={() => eraseDrawing(dr.id)} className={activeTool === "eraser" ? "draw-erasable" : ""} />
        );
      case "hline":
        return (
          <line key={key} x1={0} y1={s.y} x2={dims.w} y2={s.y}
            stroke="#fbbf24" strokeWidth={preview ? 1 : 1.5} strokeDasharray="6 3"
            strokeLinecap="round" onClick={() => eraseDrawing(dr.id)} className={activeTool === "eraser" ? "draw-erasable" : ""} />
        );
      case "arrow": {
        const dx = e.x - s.x, dy = e.y - s.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len, uy = dy / len;
        const hw = 9, hl = 14;
        const ax1 = e.x - hl * ux - hw * uy, ay1 = e.y - hl * uy + hw * ux;
        const ax2 = e.x - hl * ux + hw * uy, ay2 = e.y - hl * uy - hw * ux;
        return (
          <g key={key} onClick={() => eraseDrawing(dr.id)} className={activeTool === "eraser" ? "draw-erasable" : ""}>
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#a78bfa" strokeWidth={preview ? 1.5 : 2} strokeLinecap="round" />
            <polygon points={`${e.x},${e.y} ${ax1},${ay1} ${ax2},${ay2}`} fill="#a78bfa" />
          </g>
        );
      }
      case "marker":
        return (
          <g key={key} onClick={() => eraseDrawing(dr.id)} className={activeTool === "eraser" ? "draw-erasable" : ""}>
            <circle cx={s.x} cy={s.y} r={7} fill="rgba(52,211,153,0.25)" stroke="#34d399" strokeWidth={2} />
            <circle cx={s.x} cy={s.y} r={3} fill="#34d399" />
          </g>
        );
      default:
        return null;
    }
  };

  if (!isActive) return null;

  return (
    <div className="draw-layer" ref={containerRef}>
      {/* Toolbar */}
      <div className="draw-toolbar" role="toolbar" aria-label="Drawing tools">
        {DRAW_TOOLS.map((tool) => (
          <button
            key={tool.id}
            id={`draw-tool-${tool.id}`}
            className={`draw-tool-btn ${activeTool === tool.id ? "active" : ""}`}
            title={tool.title}
            aria-label={tool.title}
            aria-pressed={activeTool === tool.id}
            onClick={() => setActiveTool((t) => (t === tool.id ? null : tool.id))}
          >
            {tool.label}
          </button>
        ))}
        <button
          id="draw-clear-all"
          className="draw-tool-btn draw-clear"
          title="Clear all drawings"
          aria-label="Clear all drawings"
          onClick={clearAll}
          disabled={drawings.length === 0}
        >
          ⊘
        </button>
      </div>

      {/* SVG overlay */}
      <svg
        ref={svgRef}
        className="draw-svg"
        width={dims.w}
        height={dims.h}
        style={{
          pointerEvents: activeTool ? "all" : "none",
          touchAction: activeTool ? "none" : "auto"
        }}
        onPointerDown={activeTool !== "eraser" && activeTool !== "marker" && activeTool !== "hline" ? handleMouseDown : undefined}
        onPointerMove={inProgress ? handleMouseMove : undefined}
        onPointerUp={inProgress ? handleMouseUp : undefined}
        onPointerCancel={inProgress ? handleMouseUp : undefined}
        onClick={activeTool === "marker" || activeTool === "hline" ? handleClick : undefined}
      >
        {drawings.map((dr) => renderDrawing(dr))}
        {inProgress && renderDrawing({ ...inProgress, end: inProgress.end, id: "preview" }, true)}
      </svg>
    </div>
  );
}

// ── Price chart (line + candlestick, v5 API) ───────────────────────────────
function PriceChart({ history, isUp, range, chartType, chartRef: extChartRef, seriesRef: extSeriesRef }) {
  const containerRef = useRef(null);
  const internalChartRef  = extChartRef  || useRef(null);
  const internalSeriesRef = extSeriesRef || useRef(null);

  useEffect(() => {
    if (!containerRef.current || !history?.length) return;
    let destroyed = false;

    (async () => {
      try {
        const lwc = await import("lightweight-charts");
        if (destroyed || !containerRef.current) return;

        if (internalChartRef.current) {
          try { internalChartRef.current.remove(); } catch {}
          internalChartRef.current = null;
          if (internalSeriesRef) internalSeriesRef.current = null;
        }

        const chart = lwc.createChart(containerRef.current, {
          layout: {
            background: { type: lwc.ColorType.Solid, color: "transparent" },
            textColor: "#94a3b8",
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
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
          width:  containerRef.current.clientWidth,
          height: 300,
        });

        let series;
        if (chartType === "candle") {
          series = chart.addSeries(lwc.CandlestickSeries, {
            upColor:          "#34d399",
            downColor:        "#fb7185",
            borderUpColor:    "#34d399",
            borderDownColor:  "#fb7185",
            wickUpColor:      "#34d399",
            wickDownColor:    "#fb7185",
          });
          series.setData(history.map((h) => ({
            time:  h.time,
            open:  h.open,
            high:  h.high,
            low:   h.low,
            close: h.close,
          })));
        } else {
          const lineColor = isUp ? "#34d399" : "#fb7185";
          series = chart.addSeries(lwc.AreaSeries, {
            lineColor,
            topColor:    isUp ? "rgba(52,211,153,0.22)"  : "rgba(251,113,133,0.22)",
            bottomColor: isUp ? "rgba(52,211,153,0.01)"  : "rgba(251,113,133,0.01)",
            lineWidth: 2,
          });
          series.setData(history.map((h) => ({ time: h.time, value: h.close })));
        }

        chart.timeScale().fitContent();
        internalChartRef.current = chart;
        if (internalSeriesRef) internalSeriesRef.current = series;

        // Responsive resize
        const ro = new ResizeObserver(() => {
          if (containerRef.current && internalChartRef.current) {
            internalChartRef.current.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        ro.observe(containerRef.current);
        chart._ro = ro;
      } catch (err) {
        console.error("Chart render error:", err);
      }
    })();

    return () => {
      destroyed = true;
      if (internalChartRef.current) {
        try {
          if (internalChartRef.current._ro) internalChartRef.current._ro.disconnect();
          internalChartRef.current.remove();
        } catch {}
        internalChartRef.current = null;
        if (internalSeriesRef) internalSeriesRef.current = null;
      }
    };
  }, [history, isUp, range, chartType]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} className="stock-chart-container" />
    </div>
  );
}

// ── News Sentiment Panel ───────────────────────────────────────────────────
function NewsSentimentPanel({ ticker }) {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [manualText, setManualText]     = useState("");
  const [manualResult, setManualResult] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const cacheRef = useRef({});

  useEffect(() => {
    if (!ticker) return;
    if (cacheRef.current[ticker]) { setItems(cacheRef.current[ticker]); return; }
    setLoading(true); setError(null); setItems([]);

    fetch(`/api/news?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        const merged = data.items || [];
        cacheRef.current[ticker] = merged;
        setItems(merged);
      })
      .catch(() => setError("Could not fetch news for this ticker."))
      .finally(() => setLoading(false));
  }, [ticker]);

  const scoreManual = async () => {
    const text = manualText.trim();
    if (!text) return;
    setManualLoading(true); setManualResult(null);
    try {
      const res  = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const conf = data.probabilities?.[data.sentiment];
      setManualResult({
        title:      text,
        sentiment:  data.sentiment,
        confidence: conf != null ? Math.round(conf * 1000) / 10 : 0,
      });
    } catch {
      setManualResult({ error: "Scoring failed. Try again." });
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="news-panel">
      <div className="news-panel-title">📰 Recent Sentiment Reads</div>

      {loading && (
        <div className="news-loading">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="news-item-skeleton">
              <Skeleton width="52px" height="18px" style={{ borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <Skeleton width="100%" height="13px" style={{ marginBottom: 5 }} />
                <Skeleton width="60%" height="11px" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="news-error">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="news-empty">No recent news found for {ticker}.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="news-list">
          {items.map((item, i) => (
            <motion.a
              key={i}
              href={item.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="news-item"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              {item.sentiment && (
                <span className={`news-badge ${SENT_COLOR[item.sentiment] || "neutral-badge"}`}>
                  {SENT_LABEL[item.sentiment] || item.sentiment}
                  {item.confidence != null && (
                    <span className="news-conf"> {item.confidence.toFixed(0)}%</span>
                  )}
                </span>
              )}
              <span className="news-title">{item.title}</span>
              <span className="news-meta">
                {item.publisher && <span>{item.publisher}</span>}
                {item.timestamp > 0 && (
                  <span>{new Date(item.timestamp * 1000).toLocaleDateString()}</span>
                )}
              </span>
            </motion.a>
          ))}
        </div>
      )}

      {/* Manual paste input */}
      <div className="news-manual">
        <div className="news-manual-label">Paste your own headline</div>
        <div className="news-manual-row">
          <input
            id="news-manual-input"
            className="news-manual-input"
            type="text"
            placeholder="e.g. Company reports record revenue growth…"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") scoreManual(); }}
          />
          <button
            className="news-manual-btn"
            onClick={scoreManual}
            disabled={manualLoading || !manualText.trim()}
          >
            {manualLoading ? "…" : "Score"}
          </button>
        </div>
        <AnimatePresence>
          {manualResult && (
            <motion.div
              className={`news-manual-result ${manualResult.error ? "error" : SENT_COLOR[manualResult.sentiment] || "neutral-badge"}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              {manualResult.error || (
                <>
                  <span className={`news-badge ${SENT_COLOR[manualResult.sentiment]}`}>
                    {SENT_LABEL[manualResult.sentiment]}
                  </span>
                  <span style={{ marginLeft: 8 }}>{manualResult.confidence?.toFixed(1)}% confidence</span>
                  <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}>{manualResult.title.slice(0, 60)}{manualResult.title.length > 60 ? "…" : ""}</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Export button ──────────────────────────────────────────────────────────
function ExportButton({ targetRef, filename = "stock-quote" }) {
  const [status, setStatus] = useState("idle"); // idle | copying | done | error

  const handleExport = async () => {
    if (!targetRef?.current) return;
    setStatus("copying");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(targetRef.current, {
        backgroundColor: "#0a0f1c",
        pixelRatio: 2,
        cacheBust: true,
      });
      // Try clipboard first, fall back to download
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus("done");
      } catch {
        // Fallback: download
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${filename}.png`;
        a.click();
        setStatus("done");
      }
      setTimeout(() => setStatus("idle"), 2200);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2200);
    }
  };

  return (
    <button
      className={`export-btn ${status !== "idle" ? status : ""}`}
      onClick={handleExport}
      title="Copy chart as image"
      aria-label="Export chart as image"
      disabled={status === "copying"}
    >
      {status === "done" ? "✓ Copied!" : status === "error" ? "✗ Error" : status === "copying" ? "…" : "⬇ Export"}
    </button>
  );
}

// ── Main StockExplorer ─────────────────────────────────────────────────────
export default function StockExplorer() {
  const shouldReduce = useReducedMotion();

  const [country, setCountry]             = useState("US");
  const [countryOpen, setCountryOpen]     = useState(false);
  const [query, setQuery]                 = useState("");
  const [suggestions, setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightIdx, setHighlightIdx]   = useState(-1);

  const [selectedStock, setSelectedStock] = useState(null);
  const [stockData, setStockData]         = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [activeRange, setActiveRange]     = useState("1M");
  const [chartType, setChartType]         = useState("line"); // "line" | "candle"

  const [trendingData, setTrendingData]       = useState({});
  const [trendingLoading, setTrendingLoading] = useState(false);

  const debounceRef     = useRef(null);
  const searchInputRef  = useRef(null);
  const chartRef        = useRef(null);
  const seriesRef       = useRef(null);
  const quoteRef        = useRef(null);
  const clearDrawingsRef = useRef(null);

  const countryObj  = COUNTRIES.find((c) => c.code === country) || COUNTRIES[0];
  const popularList = POPULAR[country] || POPULAR["US"];
  const trending    = popularList.slice(0, TRENDING_COUNT);

  // ── Universal search via /api/stock?action=search ──────────────────────
  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setHighlightIdx(-1);
    clearTimeout(debounceRef.current);

    if (q.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `/api/stock?action=search&q=${encodeURIComponent(q.trim())}&country=${country}`
        );
        const data = await res.json();
        const results = data.results || [];
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        if (results.length === 0) setShowSuggestions(true); // Show "no results" state
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // ── Keyboard navigation in suggestions ────────────────────────────────
  const handleSearchKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        fetchStock(suggestions[highlightIdx].symbol);
      } else if (suggestions.length > 0) {
        fetchStock(suggestions[0].symbol);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightIdx(-1);
    }
  };

  // ── Global keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return; // Don't hijack typing
      if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Fetch stock detail ─────────────────────────────────────────────────
  const fetchStock = useCallback(
    async (symbol, rangeKey) => {
      const rk = rangeKey || activeRange;
      setLoading(true);
      setError(null);
      setStockData(null);
      setSelectedStock(symbol);
      setShowSuggestions(false);
      setQuery("");
      setSuggestions([]);

      try {
        const res  = await fetch(
          `/api/stock?ticker=${encodeURIComponent(symbol)}&country=${country}&range=${rk}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
        setStockData(data);
        setActiveRange(rk);
      } catch (err) {
        setError(err.message || "Failed to load stock data. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [country, activeRange]
  );

  // ── Range change (clears drawings if any) ─────────────────────────────
  const handleRangeChange = (r) => {
    if (r === activeRange) return;
    if (selectedStock) {
      // If drawings exist, confirm before clearing
      if (clearDrawingsRef.current) {
        // Check if we have drawings (clearDrawingsRef.current is the clearAll fn)
        const proceed = () => fetchStock(selectedStock, r);
        // Show confirm only if in candle mode (toolbar visible)
        if (chartType === "candle") {
          const confirmed = window.confirm(
            "Changing time range will clear your drawings. Continue?"
          );
          if (!confirmed) return;
        }
        proceed();
      } else {
        fetchStock(selectedStock, r);
      }
    }
  };

  // ── Trending prices ────────────────────────────────────────────────────
  useEffect(() => {
    setTrendingData({});
    setTrendingLoading(true);
    let cancelled = false;

    async function loadTrending() {
      const results = {};
      await Promise.allSettled(
        trending.map(async ({ symbol }) => {
          try {
            const res  = await fetch(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // ── Reset on country change ────────────────────────────────────────────
  useEffect(() => {
    setSelectedStock(null);
    setStockData(null);
    setError(null);
    setQuery("");
    setSuggestions([]);
  }, [country]);

  return (
    <div className="stock-explorer" style={{ position: "relative", zIndex: 1 }}>

      {/* ── Search row ──────────────────────────────────────────────── */}
      <motion.div
        className="stock-search-row"
        initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
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
            aria-haspopup="listbox" aria-expanded={countryOpen}
          >
            <span className="country-btn-flag">{countryObj.flag}</span>
            <span>{countryObj.code}</span>
            <span className="country-btn-chevron">▼</span>
          </button>
          {countryOpen && (
            <div className="country-dropdown" role="listbox" style={{ left: 0, right: "auto" }}>
              <div className="country-dropdown-header">Select Exchange</div>
              {COUNTRIES.map((c) => (
                <button
                  key={c.code} id={`stock-country-${c.code}`}
                  className={`country-option ${c.code === country ? "active" : ""}`}
                  role="option" aria-selected={c.code === country}
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
          <span className="stock-search-icon">{searchLoading ? "⟳" : "🔍"}</span>
          <input
            ref={searchInputRef}
            id="stock-search-input"
            className="stock-search-input"
            type="text"
            placeholder={`Search any stock… (e.g. ${popularList[0]?.symbol}, Tesla, HDFC)`}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => query && setShowSuggestions(suggestions.length > 0 || true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
            autoComplete="off"
            spellCheck={false}
          />
          {/* Keyboard hint */}
          <span className="stock-search-hint">Press / to search</span>

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
                {suggestions.length === 0 ? (
                  <div className="stock-suggestion-empty">
                    {searchLoading ? "Searching…" : `No results for "${query}"`}
                  </div>
                ) : (
                  suggestions.map((s, i) => (
                    <button
                      key={s.symbol}
                      id={`stock-suggestion-${s.symbol}`}
                      className={`stock-suggestion-item ${i === highlightIdx ? "highlighted" : ""}`}
                      onMouseDown={() => fetchStock(s.symbol)}
                      onMouseEnter={() => setHighlightIdx(i)}
                    >
                      <span className="stock-suggestion-symbol">{s.symbol}</span>
                      <span className="stock-suggestion-name">{s.name}</span>
                      {s.exchange && (
                        <span className="stock-suggestion-exchange">{s.exchange}</span>
                      )}
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Main content area ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* Trending grid */}
        {!selectedStock && !loading && (
          <motion.div key="trending" initial={shouldReduce ? {} : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="stock-section-label">
              <span className="stock-section-dot" />
              Popular in {countryObj.name}
            </div>
            <div className="stock-trending-grid">
              {trending.map((t, i) => {
                const d    = trendingData[t.symbol];
                const isUp = d ? d.isUp : true;
                return (
                  <motion.button
                    key={t.symbol} id={`trending-${t.symbol}`}
                    className={`stock-trending-card ${d ? (isUp ? "up" : "down") : ""}`}
                    onClick={() => fetchStock(t.symbol)}
                    variants={popIn} initial="hidden" animate="visible" custom={i}
                    whileHover={shouldReduce ? {} : { scale: 1.03, transition: { type: "spring", stiffness: 400, damping: 20 } }}
                  >
                    <div className="stock-trending-header">
                      <span className="stock-trending-symbol">{t.symbol}</span>
                      {trendingLoading && !d ? (
                        <Skeleton width="48px" height="12px" />
                      ) : d ? (
                        <span className={`stock-trending-change ${isUp ? "up" : "down"}`}>
                          {isUp ? "▲" : "▼"} {d.changePct}%
                        </span>
                      ) : null}
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

        {/* Loading skeleton */}
        {loading && (
          <motion.div key="loading" initial={shouldReduce ? {} : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="stock-loading-state">
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
              <Skeleton width="100%" height="300px" style={{ marginTop: 16, borderRadius: 12 }} />
            </div>
          </motion.div>
        )}

        {/* Error state */}
        {error && !loading && (
          <motion.div key="error" initial={shouldReduce ? {} : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="stock-error-state">
            <div className="stock-error-icon">⚠️</div>
            <div className="stock-error-title">Ticker Not Found</div>
            <div className="stock-error-msg">{error}</div>
            <button className="stock-error-reset" onClick={() => { setSelectedStock(null); setError(null); }}>
              ← Back to Popular
            </button>
          </motion.div>
        )}

        {/* Stock detail view */}
        {stockData && !loading && (
          <motion.div
            key={`stock-${selectedStock}`}
            initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button
                className="stock-back-btn"
                onClick={() => { setSelectedStock(null); setStockData(null); setError(null); }}
              >
                ← Popular
              </button>
            </div>

            {/* Quote header + export */}
            <div ref={quoteRef}>
              <div className={`stock-quote-header ${stockData.isUp ? "up" : "down"}`}>
                <div className="stock-quote-left">
                  <div className="stock-quote-ticker-badge">{stockData.ticker}</div>
                  <div className="stock-quote-name">{stockData.name}</div>
                  <div className="stock-quote-price-row">
                    <span className="stock-quote-price">
                      {stockData.currency !== "USD" ? stockData.currency + " " : "$"}{stockData.price}
                    </span>
                    <span className={`stock-quote-change ${stockData.isUp ? "up" : "down"}`}>
                      {stockData.isUp ? "▲" : "▼"} {stockData.isUp ? "+" : ""}{stockData.change} ({stockData.isUp ? "+" : ""}{stockData.changePct}%)
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  {stockData.exchange && <div className="stock-quote-exchange">{stockData.exchange}</div>}
                  <ExportButton targetRef={quoteRef} filename={`${stockData.ticker}-quote`} />
                </div>
              </div>

              {/* Stats grid */}
              <div className="stock-stats-grid">
                <StatCell label="Open"        value={stockData.open} />
                <StatCell label="Day High"    value={stockData.high} />
                <StatCell label="Day Low"     value={stockData.low} />
                <StatCell label="Prev. Close" value={stockData.prevClose} />
                <StatCell label="Volume"      value={stockData.volume} />
                <StatCell label="Market Cap"  value={stockData.marketCap} />
                <StatCell label="52W High"    value={stockData.week52High} />
                <StatCell label="52W Low"     value={stockData.week52Low} />
              </div>
            </div>

            {/* Chart type toggle + range selector */}
            <div className="stock-controls-row">
              <div className="chart-type-toggle" role="group" aria-label="Chart type">
                <button
                  id="chart-type-line"
                  className={`chart-type-btn ${chartType === "line" ? "active" : ""}`}
                  onClick={() => setChartType("line")}
                >
                  ∿ Line
                </button>
                <button
                  id="chart-type-candle"
                  className={`chart-type-btn ${chartType === "candle" ? "active" : ""}`}
                  onClick={() => setChartType("candle")}
                >
                  🕯 Candles
                </button>
              </div>
              <div className="stock-range-row">
                {RANGES.map((r) => (
                  <button
                    key={r} id={`range-btn-${r}`}
                    className={`stock-range-btn ${activeRange === r ? "active" : ""}`}
                    onClick={() => handleRangeChange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart + drawing layer */}
            <div className="stock-chart-card" style={{ position: "relative" }}>
              {stockData.history?.length > 0 ? (
                <>
                  <PriceChart
                    history={stockData.history}
                    isUp={stockData.isUp}
                    range={activeRange}
                    chartType={chartType}
                    chartRef={chartRef}
                    seriesRef={seriesRef}
                  />
                  <DrawingLayer
                    chartRef={chartRef}
                    seriesRef={seriesRef}
                    isActive={chartType === "candle"}
                    onClearConfirm={clearDrawingsRef}
                  />
                </>
              ) : (
                <div className="stock-chart-empty">No chart data available for this range.</div>
              )}
            </div>

            {/* News sentiment panel */}
            <NewsSentimentPanel ticker={stockData.ticker} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
