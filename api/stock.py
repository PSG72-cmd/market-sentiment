"""
api/stock.py — Vercel Python serverless function
GET /api/stock?ticker=AAPL&country=US&range=1M

Returns live stock data via yfinance (no API key needed).
Completely separate from api/predict.py — no shared state or imports.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import time

# ── In-memory cache (resets on cold start, acceptable for Vercel) ──────────
_CACHE: dict = {}
_CACHE_TTL = 60  # seconds

# ── Country → yfinance ticker suffix ──────────────────────────────────────
COUNTRY_SUFFIX = {
    "US": "",
    "IN": ".NS",
    "UK": ".L",
    "JP": ".T",
    "DE": ".DE",
    "CA": ".TO",
    "HK": ".HK",
    "AU": ".AX",
}

# ── Range → yfinance period + interval params ──────────────────────────────
RANGE_PARAMS = {
    "1D":  {"period": "1d",  "interval": "5m"},
    "5D":  {"period": "5d",  "interval": "15m"},
    "1M":  {"period": "1mo", "interval": "1d"},
    "6M":  {"period": "6mo", "interval": "1d"},
    "1Y":  {"period": "1y",  "interval": "1wk"},
    "5Y":  {"period": "5y",  "interval": "1mo"},
    "MAX": {"period": "max", "interval": "1mo"},
}


def _get_cached(key):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None


def _set_cache(key, data):
    _CACHE[key] = {"ts": time.time(), "data": data}


def _fmt_large(n):
    """Format large numbers: 1.23T, 456.7B, 12.3M, etc."""
    if n is None:
        return "—"
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "—"
    if n >= 1e12:
        return f"${n/1e12:.2f}T"
    if n >= 1e9:
        return f"${n/1e9:.2f}B"
    if n >= 1e6:
        return f"${n/1e6:.2f}M"
    return f"${n:,.0f}"


def _fmt_volume(n):
    if n is None:
        return "—"
    try:
        n = int(n)
    except (TypeError, ValueError):
        return "—"
    if n >= 1_000_000_000:
        return f"{n/1_000_000_000:.2f}B"
    if n >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}K"
    return str(n)


def _safe(val, fmt=".2f"):
    try:
        return format(float(val), fmt) if val is not None else "—"
    except (TypeError, ValueError):
        return "—"


def fetch_stock_data(ticker_symbol: str, range_key: str) -> dict:
    """Fetch data from yfinance and return a clean JSON-serialisable dict."""
    import yfinance as yf  # import here so cold-start errors are surfaced cleanly

    cache_key = f"{ticker_symbol}:{range_key}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    params = RANGE_PARAMS.get(range_key.upper(), RANGE_PARAMS["1M"])
    tk = yf.Ticker(ticker_symbol)

    # ── Fetch historical prices ──────────────────────────────────────────
    hist = tk.history(period=params["period"], interval=params["interval"])
    if hist.empty:
        raise ValueError(f"No data found for ticker '{ticker_symbol}'. "
                         "Check the symbol and selected country/exchange.")

    # ── Build history array ──────────────────────────────────────────────
    history = []
    for ts, row in hist.iterrows():
        try:
            close_val = float(row["Close"])
            open_val  = float(row["Open"])
            high_val  = float(row["High"])
            low_val   = float(row["Low"])
            # lightweight-charts expects Unix seconds for time
            if hasattr(ts, "timestamp"):
                t = int(ts.timestamp())
            else:
                t = int(ts)
            history.append({
                "time":  t,
                "close": round(close_val, 4),
                "open":  round(open_val, 4),
                "high":  round(high_val, 4),
                "low":   round(low_val, 4),
            })
        except Exception:
            continue

    if not history:
        raise ValueError(f"Could not parse price history for '{ticker_symbol}'.")

    # ── Quote info ───────────────────────────────────────────────────────
    info = tk.fast_info  # faster than tk.info for basic fields
    try:
        info_full = tk.info
    except Exception:
        info_full = {}

    price      = getattr(info, "last_price", None) or info_full.get("regularMarketPrice")
    prev_close = getattr(info, "previous_close", None) or info_full.get("previousClose")
    open_p     = getattr(info, "open", None) or info_full.get("open")
    day_high   = getattr(info, "day_high", None) or info_full.get("dayHigh")
    day_low    = getattr(info, "day_low", None) or info_full.get("dayLow")
    volume     = getattr(info, "three_month_average_volume", None) or info_full.get("volume")
    mkt_cap    = getattr(info, "market_cap", None) or info_full.get("marketCap")
    wk52_high  = getattr(info, "year_high", None) or info_full.get("fiftyTwoWeekHigh")
    wk52_low   = getattr(info, "year_low",  None) or info_full.get("fiftyTwoWeekLow")
    currency   = getattr(info, "currency", None) or info_full.get("currency", "USD")
    name       = info_full.get("longName") or info_full.get("shortName") or ticker_symbol
    exchange   = info_full.get("exchange", "")

    # Fallback price from last history bar
    if price is None and history:
        price = history[-1]["close"]
    if prev_close is None and len(history) >= 2:
        prev_close = history[-2]["close"]

    change     = (float(price) - float(prev_close)) if price and prev_close else 0
    change_pct = (change / float(prev_close) * 100) if prev_close else 0

    result = {
        "ticker":      ticker_symbol,
        "name":        name,
        "exchange":    exchange,
        "currency":    currency,
        "price":       _safe(price),
        "change":      _safe(change),
        "changePct":   _safe(change_pct),
        "open":        _safe(open_p),
        "high":        _safe(day_high),
        "low":         _safe(day_low),
        "prevClose":   _safe(prev_close),
        "volume":      _fmt_volume(volume),
        "marketCap":   _fmt_large(mkt_cap),
        "week52High":  _safe(wk52_high),
        "week52Low":   _safe(wk52_low),
        "isUp":        change >= 0,
        "history":     history,
        "range":       range_key,
        "cachedAt":    int(time.time()),
    }

    _set_cache(cache_key, result)
    return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed  = urlparse(self.path)
        params  = parse_qs(parsed.query)

        raw_ticker = (params.get("ticker", [""])[0]).strip().upper()
        country    = (params.get("country", ["US"])[0]).strip().upper()
        range_key  = (params.get("range",   ["1M"])[0]).strip().upper()

        if not raw_ticker:
            self._send(400, {"error": "Missing required parameter: ticker"})
            return

        # Build the full yfinance symbol by appending country suffix
        suffix = COUNTRY_SUFFIX.get(country, "")
        # Don't double-append if user already typed the suffix
        if suffix and not raw_ticker.endswith(suffix):
            full_symbol = raw_ticker + suffix
        else:
            full_symbol = raw_ticker

        if range_key not in RANGE_PARAMS:
            range_key = "1M"

        try:
            data = fetch_stock_data(full_symbol, range_key)
            self._send(200, data)
        except ValueError as exc:
            self._send(404, {"error": str(exc)})
        except Exception as exc:
            # Never expose raw tracebacks
            msg = str(exc)
            if "No data" in msg or "symbol" in msg.lower():
                self._send(404, {"error": f"Ticker '{full_symbol}' not found or has no data."})
            else:
                self._send(500, {"error": "Failed to fetch stock data. Please try again."})

    def _send(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # suppress default request logs
