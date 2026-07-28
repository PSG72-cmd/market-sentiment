/**
 * app/api/news/route.js
 *
 * GET /api/news?ticker=AAPL
 *
 * Orchestrates:
 *  1. Fetch raw headlines from /api/news (Python serverless)
 *  2. Score each headline via /api/score (which calls /api/predict)
 *  3. Return combined result: { items: [{title, publisher, link, timestamp, sentiment, confidence}] }
 *
 * predict.py is called indirectly through /api/score — never imported directly.
 */

import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();

    if (!ticker) {
      return NextResponse.json({ error: "Missing ticker parameter." }, { status: 400 });
    }

    const host   = request.headers.get("host") || "localhost:3000";
    const proto  = host.startsWith("localhost") ? "http" : "https";
    const base   = `${proto}://${host}`;

    // Step 1 — fetch raw headlines from Python function
    const newsRes = await fetch(`${base}/api/news?ticker=${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(12_000),
    });
    const newsData = await newsRes.json();
    const rawItems = newsData.items || [];

    if (rawItems.length === 0) {
      return NextResponse.json({ ticker, items: [] });
    }

    // Step 2 — batch score all titles
    const titles = rawItems.map((i) => i.title);
    let scores = [];
    try {
      const scoreRes = await fetch(`${base}/api/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: titles }),
        signal: AbortSignal.timeout(20_000),
      });
      const scoreData = await scoreRes.json();
      scores = scoreData.scores || [];
    } catch {
      // If scoring fails, return headlines without scores
      scores = rawItems.map(() => ({ sentiment: null, confidence: null }));
    }

    // Step 3 — merge
    const items = rawItems.map((item, i) => ({
      ...item,
      sentiment:  scores[i]?.sentiment  ?? null,
      confidence: scores[i]?.confidence ?? null,
    }));

    return NextResponse.json({ ticker, items });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch news. Please try again." },
      { status: 500 }
    );
  }
}
