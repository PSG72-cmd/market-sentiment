/**
 * Next.js App Router API route — /api/quotes?country=US
 * Returns live stock quotes for the selected country's top stocks.
 * Uses Yahoo Finance v8/chart endpoint (works server-side with browser headers).
 *
 * Supported country codes: US, IN, UK, DE, JP, CN, AU, BR
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
    { display: "PETRO",   yahoo: "PETR4.SA" },
    { display: "VALE",    yahoo: "VALE3.SA" },
    { display: "ITAÚ",    yahoo: "ITUB4.SA" },
    { display: "BRADESCO",yahoo: "BBDC4.SA" },
    { display: "B3",      yahoo: "B3SA3.SA" },
    { display: "AMBEV",   yahoo: "ABEV3.SA" },
    { display: "WEG",     yahoo: "WEGE3.SA" },
    { display: "RENNER",  yahoo: "LREN3.SA" },
    { display: "EMBRAER", yahoo: "EMBR3.SA" },
    { display: "TOTVS",   yahoo: "TOTS3.SA" },
  ],
  CN: [
    { display: "ALIBABA", yahoo: "BABA"   },
    { display: "TENCENT", yahoo: "TCEHY"  },
    { display: "JD.COM",  yahoo: "JD"     },
    { display: "BAIDU",   yahoo: "BIDU"   },
    { display: "NIO",     yahoo: "NIO"    },
    { display: "BIDU",    yahoo: "BIDU"   },
    { display: "PDD",     yahoo: "PDD"    },
    { display: "XPENG",   yahoo: "XPEV"   },
    { display: "LI AUTO", yahoo: "LI"     },
    { display: "NETEASE", yahoo: "NTES"   },
  ],
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://finance.yahoo.com/",
  "Origin": "https://finance.yahoo.com",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const country = (searchParams.get("country") ?? "US").toUpperCase();
  const symbols = COUNTRY_SYMBOLS[country] ?? COUNTRY_SYMBOLS["US"];

  const results = await Promise.allSettled(
    symbols.map(({ display, yahoo }) => fetchChart(display, yahoo))
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

async function fetchChart(display, yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;

  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(7000),
    next: { revalidate: 25 },
  });

  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${display}`);

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`no meta for ${display}`);

  const price = meta.regularMarketPrice ?? meta.previousClose;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;

  if (!price) throw new Error(`no price for ${display}`);

  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const up = changePct >= 0;

  // Format currency symbol per exchange
  const currency = meta.currency ?? "USD";
  const symbol = getCurrencySymbol(currency);

  return {
    symbol: display,
    price: `${symbol}${formatPrice(price)}`,
    change: `${up ? "+" : ""}${changePct.toFixed(2)}%`,
    up,
  };
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
