/**
 * app/api/score/route.js
 *
 * POST /api/score
 * Body: { texts: string[] }
 *
 * Batch sentiment scorer — calls /api/predict once per text and returns
 * an array of { sentiment, confidence, probabilities } in the same order.
 *
 * This is a Next.js server-side route, so it can make internal HTTP calls
 * to the Vercel Python function (/api/predict) without CORS issues.
 * predict.py is NEVER imported or edited — only called via HTTP.
 */

import { NextResponse } from "next/server";

const PREDICT_TIMEOUT_MS = 12_000;

async function scoreSingle(text, baseUrl) {
  const res = await fetch(`${baseUrl}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(PREDICT_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { sentiment: "neutral", confidence: 0, probabilities: {} };
  }
  const data = await res.json();
  const probs = data.probabilities || {};
  const sent  = data.sentiment || "neutral";
  const conf  = probs[sent] != null ? Math.round(probs[sent] * 1000) / 10 : 0;
  return {
    sentiment:     sent,
    confidence:    conf,
    probabilities: probs,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const texts = Array.isArray(body.texts) ? body.texts : [];

    if (texts.length === 0) {
      return NextResponse.json({ scores: [] });
    }
    if (texts.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 texts per batch request." },
        { status: 400 }
      );
    }

    // Determine base URL for internal fetch
    const host = request.headers.get("host") || "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const baseUrl = `${proto}://${host}`;

    // Score all texts in parallel (allSettled so one failure doesn't kill the batch)
    const settled = await Promise.allSettled(
      texts.map((t) => scoreSingle(String(t).trim(), baseUrl))
    );

    const scores = settled.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { sentiment: "neutral", confidence: 0, probabilities: {} }
    );

    return NextResponse.json({ scores });
  } catch (err) {
    return NextResponse.json(
      { error: "Scoring failed. Please try again." },
      { status: 500 }
    );
  }
}
