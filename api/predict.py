"""
Vercel Python Serverless Function — /api/predict
Financial Sentiment Analysis using Logistic Regression + TF-IDF + Lexicon features.

Loads all 6 model artifacts once at module level (warm-invocation reuse).
Implements the EXACT same preprocessing as training time.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import urllib.parse

import joblib 
import numpy as np
import scipy.sparse

# ---------------------------------------------------------------------------
# Paths — artifacts live next to this file in model_artifacts/
# ---------------------------------------------------------------------------
_ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "model_artifacts")


def _load(filename):
    return joblib.load(os.path.join(_ARTIFACTS_DIR, filename))


def _load_json(filename):
    with open(os.path.join(_ARTIFACTS_DIR, filename), "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Load artifacts once at module level (reused across warm invocations)
# ---------------------------------------------------------------------------
try:
    TFIDF = _load("tfidf_vectorizer.joblib")
    SCALER = _load("lexicon_scaler.joblib")
    ENCODER = _load("label_encoder.joblib")
    MODEL = _load("sentiment_model.joblib")
    LEXICON = _load_json("financial_lexicon.json")
    LEX_COLS = _load_json("lex_cols.json")  # ["lex_sum","lex_mean","lex_pos_hits","lex_neg_hits","lex_hit_count"]
    _ARTIFACTS_LOADED = True
    _LOAD_ERROR = None
except Exception as exc:  # noqa: BLE001
    _ARTIFACTS_LOADED = False
    _LOAD_ERROR = str(exc)


# ---------------------------------------------------------------------------
# Preprocessing — must EXACTLY match training-time code
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Remove URLs, keep only lowercase a-z and spaces."""
    text = str(text).lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def lexicon_score_sentence(text: str, lexicon: dict):
    """
    Greedy, longest-phrase-first matching on RAW lowercased text (not cleaned).
    Returns a 5-tuple: (lex_sum, lex_mean, lex_pos_hits, lex_neg_hits, lex_hit_count)
    Also returns the list of matched phrases for display.
    """
    text_l = str(text).lower()
    hits = []
    matched_phrases = []
    remaining = text_l

    for phrase in sorted(lexicon, key=len, reverse=True):
        if phrase in remaining:
            hits.append(lexicon[phrase])
            matched_phrases.append(phrase)
            remaining = remaining.replace(phrase, " ")

    if not hits:
        return (0.0, 0.0, 0, 0, 0), []

    pos_hits = sum(1 for h in hits if h > 0.1)
    neg_hits = sum(1 for h in hits if h < -0.1)
    return (sum(hits), float(np.mean(hits)), pos_hits, neg_hits, len(hits)), matched_phrases


def predict_sentiment(raw_text: str) -> dict:
    """
    Full inference pipeline matching training-time flow:
      1. clean_text() → TF-IDF
      2. lexicon_score_sentence(raw_text) → scaler
      3. hstack([X_tfidf, X_lex]) → model.predict / predict_proba
      4. label_encoder.inverse_transform()
    """
    # 1. TF-IDF on cleaned text
    cleaned = clean_text(raw_text)
    X_tfidf = TFIDF.transform([cleaned])

    # 2. Lexicon features on RAW text
    lex_tuple, matched_phrases = lexicon_score_sentence(raw_text, LEXICON)
    X_lex_raw = np.array([list(lex_tuple)], dtype=float)
    X_lex = SCALER.transform(X_lex_raw)

    # 3. Horizontal stack (sparse + dense → sparse)
    X_combined = scipy.sparse.hstack([X_tfidf, scipy.sparse.csr_matrix(X_lex)])

    # 4. Predict
    pred_encoded = MODEL.predict(X_combined)
    proba = MODEL.predict_proba(X_combined)[0]

    label = str(ENCODER.inverse_transform(pred_encoded)[0])
    classes = [str(c) for c in ENCODER.classes_]
    probabilities = {cls: round(float(p), 4) for cls, p in zip(classes, proba)}

    return {
        "sentiment": label,
        "probabilities": probabilities,
        "matched_lexicon_terms": matched_phrases,
    }


# ---------------------------------------------------------------------------
# Vercel HTTP handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless function handler."""

    def log_message(self, format, *args):  # noqa: A002
        # Suppress default stderr logging in Vercel environment
        pass

    # ------------------------------------------------------------------
    # CORS pre-flight
    # ------------------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ------------------------------------------------------------------
    # Prediction endpoint
    # ------------------------------------------------------------------
    def do_POST(self):
        if not _ARTIFACTS_LOADED:
            self._json_response(
                500,
                {"error": f"Model artifacts failed to load: {_LOAD_ERROR}"},
            )
            return

        # Read body
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)

        try:
            body = json.loads(raw_body)
        except json.JSONDecodeError:
            self._json_response(400, {"error": "Invalid JSON body"})
            return

        text = body.get("text", "").strip()
        if not text:
            self._json_response(400, {"error": "Field 'text' is required and must not be empty"})
            return

        if len(text) > 2000:
            self._json_response(400, {"error": "Text exceeds 2000 character limit"})
            return

        try:
            result = predict_sentiment(text)
        except Exception as exc:  # noqa: BLE001
            self._json_response(500, {"error": f"Prediction failed: {str(exc)}"})
            return

        self._json_response(200, result)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, status_code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
