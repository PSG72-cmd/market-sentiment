"""
api/news.py — Vercel Python serverless function
GET /api/news?ticker=AAPL

Fetches recent news headlines for a ticker via yfinance's .news property.
Returns raw headline metadata (title, publisher, link, timestamp).
Sentiment scoring is handled separately by the Next.js /api/score route
which calls /api/predict — so predict.py is NEVER imported or edited here.
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import time

# ── In-memory cache (5 min TTL for news) ──────────────────────────────────
_NEWS_CACHE: dict = {}
_NEWS_TTL = 300  # 5 minutes


def _get_cached(key):
    entry = _NEWS_CACHE.get(key)
    if entry and (time.time() - entry["ts"]) < _NEWS_TTL:
        return entry["data"]
    return None


def _set_cache(key, data):
    _NEWS_CACHE[key] = {"ts": time.time(), "data": data}


def fetch_news(ticker_symbol: str) -> list:
    """
    Fetch recent news for a ticker using yfinance.
    Returns up to 8 items: {title, publisher, link, timestamp}.
    Sentiment scoring is NOT done here — handled by Next.js /api/score.
    """
    import yfinance as yf

    cache_key = f"news:{ticker_symbol.upper()}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    try:
        tk = yf.Ticker(ticker_symbol)
        raw_news = tk.news or []
    except Exception:
        _set_cache(cache_key, [])
        return []

    items = []
    for article in raw_news[:8]:
        # yfinance news structure varies slightly — handle both formats
        content = article.get("content", article)
        title = (
            content.get("title")
            or article.get("title")
            or ""
        ).strip()
        if not title:
            continue

        # Publisher
        provider = content.get("provider", {}) or {}
        publisher = (
            provider.get("displayName")
            or content.get("provider_display_name")
            or article.get("publisher")
            or ""
        )

        # Link
        link = (
            content.get("canonicalUrl", {}).get("url")
            or content.get("clickThroughUrl", {}).get("url")
            or article.get("link")
            or ""
        )

        # Timestamp (Unix seconds)
        pub_date = (
            content.get("pubDate")
            or article.get("providerPublishTime")
            or 0
        )
        if isinstance(pub_date, str):
            # ISO format — convert to timestamp
            try:
                from datetime import datetime, timezone
                pub_date = int(
                    datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                    .timestamp()
                )
            except Exception:
                pub_date = 0

        items.append({
            "title":     title,
            "publisher": publisher,
            "link":      link,
            "timestamp": int(pub_date) if pub_date else 0,
        })

    _set_cache(cache_key, items)
    return items


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        ticker = (params.get("ticker", [""])[0]).strip().upper()
        if not ticker:
            self._send(400, {"error": "Missing required parameter: ticker"})
            return

        try:
            items = fetch_news(ticker)
            self._send(200, {"ticker": ticker, "items": items})
        except Exception:
            self._send(200, {"ticker": ticker, "items": []})

    def _send(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
