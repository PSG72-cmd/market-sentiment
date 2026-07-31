/**
 * Next.js App Router API route — /api/quotes?country=US
 * Returns live stock quotes for the selected country's top stocks.
 *
 * Yahoo Finance now requires crumb+cookie auth for server-side requests.
 * Strategy:
 *   1. Fetch a Yahoo Finance crumb once per cold start (cached in module scope)
 *   2. Use crumb + cookie in all subsequent chart requests
 *   3. Try query1 first, fall back to query2 on failure
 *   4. Individual symbol failures return "—" without killing the whole batch
 */

const COUNTRY_SYMBOLS = {
  US: [
    { display: "AAPL",  yahoo: "AAPL"     },
    { display: "NVDA",  yahoo: "NVDA"     },
    { display: "MSFT",  yahoo: "MSFT"     },
    { display: "AMZN",  yahoo: "AMZN"     },
    { display: "TSLA",  yahoo: "TSLA"     },
    { display: "GOOG",  yahoo: "GOOG"     },
    { display: "JPM",   yahoo: "JPM"      },
    { display: "GS",    yahoo: "GS"       },
    { display: "BAC",   yahoo: "BAC"      },
    { display: "BTC",   yahoo: "BTC-USD"  },
  ],
  IN: [
    { display: "RELIANCE",  yahoo: "RELIANCE.NS"   },
    { display: "TCS",       yahoo: "TCS.NS"        },
    { display: "INFY",      yahoo: "INFY.NS"       },
    { display: "HDFC",      yahoo: "HDFCBANK.NS"   },
    { display: "WIPRO",     yahoo: "WIPRO.NS"      },
    { display: "ICICI",     yahoo: "ICICIBANK.NS"  },
    { display: "AIRTEL",    yahoo: "BHARTIARTL.NS" },
    { display: "L&T",       yahoo: "LT.NS"         },
    { display: "SBIN",      yahoo: "SBIN.NS"       },
    { display: "ITC",       yahoo: "ITC.NS"        },
  ],
  UK: [
    { display: "HSBC",  yahoo: "HSBA.L" },
    { display: "BP",    yahoo: "BP.L"   },
    { display: "GSK",   yahoo: "GSK.L"  },
    { display: "SHELL", yahoo: "SHEL.L" },
    { display: "AZN",   yahoo: "AZN.L"  },
    { display: "ULVR",  yahoo: "ULVR.L" },
    { display: "LLOY",  yahoo: "LLOY.L" },
    { display: "RIO",   yahoo: "RIO.L"  },
    { display: "BAE",   yahoo: "BA.L"   },
    { display: "VOD",   yahoo: "VOD.L"  },
  ],
  DE: [
    { display: "SAP",     yahoo: "SAP.DE"   },
    { display: "BMW",     yahoo: "BMW.DE"   },
    { display: "SIEMENS", yahoo: "SIE.DE"   },
    { display: "DEUT",    yahoo: "DTE.DE"   },
    { display: "ALLIANZ", yahoo: "ALV.DE"   },
    { display: "BAYER",   yahoo: "BAYN.DE"  },
    { display: "MERCK",   yahoo: "MBG.DE"   },
    { display: "BASF",    yahoo: "BAS.DE"   },
    { display: "VW",      yahoo: "VOW3.DE"  },
    { display: "ADIDAS",  yahoo: "ADS.DE"   },
  ],
  JP: [
    { display: "TOYOTA",  yahoo: "7203.T"  },
    { display: "SONY",    yahoo: "6758.T"  },
    { display: "SOFTBNK", yahoo: "9984.T"  },
    { display: "HONDA",   yahoo: "7267.T"  },
    { display: "KEYENCE", yahoo: "6861.T"  },
    { display: "MUFG",    yahoo: "8306.T"  },
    { display: "NTT",     yahoo: "9432.T"  },
    { display: "HITACHI", yahoo: "6501.T"  },
    { display: "CANON",   yahoo: "7751.T"  },
    { display: "FANUC",   yahoo: "6954.T"  },
  ],
  AU: [
    { display: "BHP",    yahoo: "BHP.AX"  },
    { display: "CBA",    yahoo: "CBA.AX"  },
    { display: "CSL",    yahoo: "CSL.AX"  },
    { display: "NAB",    yahoo: "NAB.AX"  },
    { display: "WES",    yahoo: "WES.AX"  },
    { display: "ANZ",    yahoo: "ANZ.AX"  },
    { display: "WBC",    yahoo: "WBC.AX"  },
    { display: "MQG",    yahoo: "MQG.AX"  },
    { display: "RIO",    yahoo: "RIO.AX"  },
    { display: "WOW",    yahoo: "WOW.AX"  },
  ],
  BR: [
    { display: "PETRO",    yahoo: "PETR4.SA" },
    { display: "VALE",     yahoo: "VALE3.SA" },
    { display: "ITAÚ",     yahoo: "ITUB4.SA" },
    { display: "BRADESCO", yahoo: "BBDC4.SA" },
    { display: "B3",       yahoo: "B3SA3.SA" },
    { display: "AMBEV",    yahoo: "ABEV3.SA" },
    { display: "WEG",      yahoo: "WEGE3.SA" },
    { display: "RENNER",   yahoo: "LREN3.SA" },
    { display: "EMBRAER",  yahoo: "EMBR3.SA" },
    { display: "TOTVS",    yahoo: "TOTS3.SA" },
  ],
  CN: [
    { display: "ALIBABA", yahoo: "BABA"   },
    { display: "TENCENT", yahoo: "TCEHY"  },
    { display: "JD.COM",  yahoo: "JD"     },
    { display: "BAIDU",   yahoo: "BIDU"   },
    { display: "NIO",     yahoo: "NIO"    },
    { display: "PDD",     yahoo: "PDD"    },
    { display: "XPENG",   yahoo: "XPEV"   },
    { display: "LI AUTO", yahoo: "LI"     },
    { display: "NETEASE", yahoo: "NTES"   },
    { display: "BILIBILI",yahoo: "BILI"   },
  ],
};

// ── Crumb cache (module-scoped, persists across warm invocations) ─────────────
let crumbCache = null; // { crumb, cookie, expiresAt }

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
  "Origin":  "https://finance.yahoo.com",
};

/**
 * Fetch a Yahoo Finance crumb + session cookie.
 * The crumb is required for all API calls from server-side environments.
 * Cached for 50 minutes to avoid extra round-trips on warm Lambda invocations.
 */
async function getCrumb() {
  const now = Date.now();
  if (crumbCache && crumbCache.expiresAt > now) return crumbCache;

  // Step 1: hit the consent / main page to get a cookie
  const consentRes = await fetch("https://fc.yahoo.com", {
    headers: BASE_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  const cookieHeader = consentRes?.headers?.get("set-cookie") ?? "";
  // Extract the A1 or similar session cookie
  const cookie = cookieHeader
    .split(",")
    .map((c) => c.trim().split(";")[0])
    .filter(Boolean)
    .join("; ") || "A1=d=AQABBFi...; A3=d=AQABBFi..."; // safe no-op fallback

  // Step 2: fetch the crumb
  const crumbRes = await fetch(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    {
      headers: { ...BASE_HEADERS, Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!crumbRes.ok) throw new Error(`crumb fetch failed: ${crumbRes.status}`);
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes("<")) throw new Error("invalid crumb response");

  crumbCache = { crumb, cookie, expiresAt: now + 50 * 60 * 1000 };
  return crumbCache;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const country = (searchParams.get("country") ?? "US").toUpperCase();
  const symbols = COUNTRY_SYMBOLS[country] ?? COUNTRY_SYMBOLS["US"];

  // Try to get crumb; if it fails, proceed without (some symbols may still work)
  let auth = null;
  try {
    auth = await getCrumb();
  } catch {
    // continue without crumb — direct fetch may still work for some regions
  }

  const results = await Promise.allSettled(
    symbols.map(({ display, yahoo }) => fetchChart(display, yahoo, auth))
  );

  const quotes = results.map((r, i) =>
    r.status === "fulfilled" && r.value
      ? r.value
      : { symbol: symbols[i].display, price: "—", change: "—", up: true }
  );

  return Response.json(
    { quotes, country, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=25, stale-while-revalidate=30" } }
  );
}

async function fetchChart(display, yahooSymbol, auth) {
  const crumbParam = auth?.crumb ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
  const cookieHeader = auth?.cookie ? { Cookie: auth.cookie } : {};

  // Try query2 first (less blocked on cloud IPs), then query1
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];

  let lastError;
  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d${crumbParam}`;
    try {
      const res = await fetch(url, {
        headers: { ...BASE_HEADERS, ...cookieHeader },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 25 },
      });

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} for ${display} on ${host}`);
        continue;
      }

      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) {
        lastError = new Error(`no meta for ${display}`);
        continue;
      }

      // Prefer regularMarketPrice, fall back through chain
      const price =
        meta.regularMarketPrice ??
        meta.postMarketPrice ??
        meta.preMarketPrice ??
        meta.previousClose ??
        meta.chartPreviousClose;

      const prevClose =
        meta.previousClose ??
        meta.chartPreviousClose ??
        meta.regularMarketPreviousClose;

      if (!price) {
        lastError = new Error(`no price for ${display}`);
        continue;
      }

      const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const up = changePct >= 0;

      const currency = meta.currency ?? "USD";
      const currSym  = getCurrencySymbol(currency);

      return {
        symbol: display,
        price:  `${currSym}${formatPrice(price)}`,
        change: `${up ? "+" : ""}${changePct.toFixed(2)}%`,
        up,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error(`failed for ${display}`);
}

function getCurrencySymbol(currency) {
  const map = {
    USD: "$", INR: "₹", GBP: "£", EUR: "€",
    JPY: "¥", AUD: "A$", BRL: "R$", CNY: "¥", HKD: "HK$",
  };
  return map[currency] ?? "";
}

function formatPrice(price) {
  if (price >= 100000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 10000)  return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1000)   return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return price.toFixed(2);
}
