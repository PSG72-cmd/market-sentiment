"""
api/stock.py — Vercel Python serverless function

GET /api/stock?ticker=AAPL&country=US&range=1M
GET /api/stock?action=search&q=apple&country=US

Returns live stock data via yfinance (no API key needed).
Completely separate from api/predict.py — no shared state or imports.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote as urlquote
import json
import time
import urllib.request

# ── In-memory cache (resets on cold start, acceptable for Vercel) ──────────
_CACHE: dict = {}
_CACHE_TTL = 60        # seconds for quote/history data
_SEARCH_TTL = 60       # seconds for search results

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


def _get_cached(key, ttl=None):
    entry = _CACHE.get(key)
    effective_ttl = ttl if ttl is not None else _CACHE_TTL
    if entry and (time.time() - entry["ts"]) < effective_ttl:
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


# ── Country → Yahoo Finance region/lang for search API ────────────────────
COUNTRY_YAHOO_REGION = {
    "US": ("US", "en-US"),
    "IN": ("IN", "en-IN"),
    "UK": ("GB", "en-GB"),
    "JP": ("JP", "ja-JP"),
    "DE": ("DE", "de-DE"),
    "CA": ("CA", "en-CA"),
    "HK": ("HK", "zh-HK"),
    "AU": ("AU", "en-AU"),
}

# ── Search endpoint ────────────────────────────────────────────────────────

def search_tickers(query: str, country: str) -> list:
    """
    Query Yahoo Finance's public search API and return a STRICTLY FILTERED
    list of {symbol, name, exchange} dicts matching the selected country's
    exchange suffix.

    STRICT FILTERING: Only symbols that match the selected country's suffix
    are returned. Foreign stocks are completely excluded so the UI never
    shows e.g. AAPL when India is selected.

    Strategy:
      1. Primary search: augment query with suffix hint (e.g. "reliance .NS")
         and filter results strictly to suffix-matching symbols.
      2. If primary yields 0 results, retry with bare query (same strict filter).
      3. For US (no suffix): only return symbols with no exchange dot-suffix.
    """
    cache_key = f"search2:{query.lower().strip()}:{country}"
    cached = _get_cached(cache_key, ttl=_SEARCH_TTL)
    if cached is not None:
        return cached

    suffix   = COUNTRY_SUFFIX.get(country, "")
    region, lang = COUNTRY_YAHOO_REGION.get(country, ("US", "en-US"))

    # Primary: augment query with suffix hint for non-US countries
    augmented_query = query
    if suffix and not query.upper().endswith(suffix.upper()):
        augmented_query = f"{query} {suffix}"

    results = _yahoo_search_strict(augmented_query, suffix, region, lang)

    # Fallback: if augmented query yielded nothing, try bare query with same strict filter
    if not results and augmented_query != query:
        results = _yahoo_search_strict(query, suffix, region, lang)

    # Second fallback for non-US: try query1 endpoint too
    if not results and suffix:
        results = _yahoo_search_strict(augmented_query, suffix, region, lang, host="query1")

    results = results[:10]
    _set_cache(cache_key, results)
    return results


def _yahoo_search_strict(query: str, suffix: str, region: str, lang: str,
                         host: str = "query2") -> list:
    """
    Hit Yahoo search API and return ONLY results matching the country suffix.
    - Non-US (suffix != ""): only symbols ending with that suffix are kept.
    - US (suffix == ""): only symbols with no dot-exchange suffix are kept.
    All other results are discarded — no secondary/fallback bleed-through.
    """
    url = (
        f"https://{host}.finance.yahoo.com/v1/finance/search"
        f"?q={urlquote(query)}&quotesCount=20&newsCount=0"
        f"&enableFuzzyQuery=true&lang={lang}&region={region}"
    )
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Accept-Language": f"{lang},en;q=0.8",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []

    quotes  = data.get("quotes", [])
    matched = []

    for q in quotes:
        symbol = (q.get("symbol") or "").strip()
        if not symbol:
            continue
        name     = q.get("longname") or q.get("shortname") or symbol
        exchange = q.get("exchDisp") or q.get("exchange") or ""
        q_type   = q.get("quoteType", "")

        # Skip mutual funds, indices, currencies
        if q_type in ("MUTUALFUND", "INDEX", "CURRENCY"):
            continue

        # ── STRICT FILTER ────────────────────────────────────────────────
        # Only keep symbols that match the selected country's suffix.
        if suffix:
            # Non-US: symbol must end with the country suffix (e.g. ".NS")
            if not symbol.endswith(suffix):
                continue
        else:
            # US: symbol must NOT contain any exchange dot-suffix
            if "." in symbol:
                continue
        # ─────────────────────────────────────────────────────────────────

        matched.append({"symbol": symbol, "name": name, "exchange": exchange})

    return matched


# ── Stock data endpoint ────────────────────────────────────────────────────

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

    # ── Build history array (full OHLC + volume) ─────────────────────────
    history = []
    for ts, row in hist.iterrows():
        try:
            close_val  = float(row["Close"])
            open_val   = float(row["Open"])
            high_val   = float(row["High"])
            low_val    = float(row["Low"])
            volume_val = int(row.get("Volume", 0) or 0)
            # lightweight-charts expects Unix seconds for time
            if hasattr(ts, "timestamp"):
                t = int(ts.timestamp())
            else:
                t = int(ts)
            history.append({
                "time":   t,
                "open":   round(open_val,  4),
                "high":   round(high_val,  4),
                "low":    round(low_val,   4),
                "close":  round(close_val, 4),
                "volume": volume_val,
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
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        action = (params.get("action", [""])[0]).strip().lower()

        # ── Search action ────────────────────────────────────────────────
        if action == "search":
            query   = (params.get("q",       [""])[0]).strip()
            country = (params.get("country", ["US"])[0]).strip().upper()

            if not query:
                self._send(400, {"error": "Missing required parameter: q"})
                return
            if len(query) < 1 or len(query) > 80:
                self._send(400, {"error": "Query must be 1–80 characters."})
                return

            try:
                results = search_tickers(query, country)
                self._send(200, {"results": results})
            except Exception:
                self._send(200, {"results": []})
            return

        # ── Quote + history action (default) ─────────────────────────────
        raw_ticker = (params.get("ticker", [""])[0]).strip().upper()
        country    = (params.get("country", ["US"])[0]).strip().upper()
        range_key  = (params.get("range",   ["1M"])[0]).strip().upper()

        if not raw_ticker:
            self._send(400, {"error": "Missing required parameter: ticker"})
            return

        # Build the full yfinance symbol by appending country suffix
        suffix = COUNTRY_SUFFIX.get(country, "")
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
