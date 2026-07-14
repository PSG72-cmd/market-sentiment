# FinSentiment — Financial Sentiment Analysis App

> Logistic Regression · TF-IDF (3 000 features) · 900+ term financial lexicon · Macro-F1 0.6408  
> Next.js 14 frontend + Vercel Python serverless backend

---

## Project Structure

```
sentiment-app/
├── package.json              # Next.js 14.2.35, React 18.3.1
├── requirements.txt          # Python deps pinned to Colab training env
├── next.config.js
├── vercel.json               # Python function: 1 GB RAM, 15 s timeout
├── .gitignore
├── app/
│   ├── layout.js             # Root layout (fonts via <link> tag)
│   ├── globals.css           # Dark fintech-terminal design system
│   └── page.js               # "use client" main UI
└── api/
    ├── predict.py            # Vercel Python serverless handler
    └── model_artifacts/      # ← DROP THE 6 FILES HERE
        ├── tfidf_vectorizer.joblib
        ├── lexicon_scaler.joblib
        ├── label_encoder.joblib
        ├── sentiment_model.joblib
        ├── financial_lexicon.json
        └── lex_cols.json
```

---

## 1 · Model Artifact Files

The 6 artifact files exported from Colab must live at:

```
sentiment-app/api/model_artifacts/
```

They are **already copied there** in this project. If you ever need to re-export from Colab:

```python
import joblib, json
joblib.dump(tfidf, "tfidf_vectorizer.joblib")
joblib.dump(scaler, "lexicon_scaler.joblib")
joblib.dump(le, "label_encoder.joblib")
joblib.dump(model, "sentiment_model.joblib")
with open("financial_lexicon.json", "w") as f: json.dump(lexicon, f)
with open("lex_cols.json", "w") as f: json.dump(lex_cols, f)
```

> **⚠️ Important:** Make sure these files are **not** in `.gitignore`. The `.gitignore` in this project deliberately does NOT exclude `.joblib` or `.json` files, so they will be committed and available to Vercel at deploy time.

---

## 2 · Local Development

### Prerequisites
- Node.js 18+ (for the Next.js frontend)
- Python 3.9–3.11 + packages in `requirements.txt` (only needed to run `vercel dev`)

### Install & Build
```bash
cd sentiment-app
npm install
npm run build    # must complete with ✓ Compiled successfully
```

### Run locally (frontend only — /api/predict won't work without Vercel runtime)
```bash
npm run dev
# open http://localhost:3000
```

### Run locally WITH the Python function (requires Vercel CLI)
```bash
npm install -g vercel
vercel dev
# open http://localhost:3000
# /api/predict now works — Vercel CLI spins up the Python runtime locally
```

---

## 3 · Deploying to Vercel

### Option A — GitHub Import (Recommended, easiest)

1. **Push to GitHub:**
   ```bash
   cd sentiment-app
   git init
   git add .
   git commit -m "Financial sentiment analysis app"
   # Create an empty repo on github.com first, then:
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

2. **Import on Vercel:**
   - Go to [vercel.com](https://vercel.com) → **Add New → Project**
   - Select your GitHub repo
   - Vercel auto-detects Next.js — **leave all settings as default**
   - Click **Deploy**

3. **Wait ~1–2 minutes.** Vercel will:
   - Build the Next.js frontend
   - Bundle the Python serverless function in `api/predict.py`
   - Install Python packages from `requirements.txt` automatically
   - Give you a live URL like `https://your-repo-name.vercel.app`

---

### Option B — Vercel CLI (no GitHub needed)

```bash
npm install -g vercel
cd sentiment-app
vercel           # prompts: link/create project, confirm settings
vercel --prod    # promote to production URL
```

---

## 4 · How Vercel Picks Up `requirements.txt`

Vercel's Python runtime looks for a `requirements.txt` at the **project root** (same level as `package.json`). This project already has one there:

```
scikit-learn==1.6.1
scipy==1.13.1
numpy==1.26.4
joblib==1.4.2
```

Versions are pinned to **exactly match the Colab training environment**, ensuring the `joblib` format of the saved artifacts is compatible.

> **Verify in Vercel dashboard:** After deploying, go to your project → **Deployments** → click your latest deployment → **Build Logs**. You should see lines like:
> ```
> Installing dependencies from requirements.txt
> Successfully installed scikit-learn-1.6.1 scipy-1.13.1 numpy-1.26.4 joblib-1.4.2
> ```

---

## 5 · Confirming the Deployment Works

After your live URL is up, test it with curl or the browser UI:

```bash
# Replace with your actual Vercel URL
curl -X POST https://YOUR_APP.vercel.app/api/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "Shares surged after strong earnings beat analyst estimates."}'
```

Expected response:
```json
{
  "sentiment": "positive",
  "probabilities": {"negative": 0.02, "neutral": 0.05, "positive": 0.93},
  "matched_lexicon_terms": ["earnings", "surged"]
}
```

---

## 6 · Inference Pipeline (for reference)

```
raw_text
  │
  ├─→ clean_text()           →  tfidf.transform([cleaned])     →  X_tfidf (sparse, 3000 cols)
  │
  └─→ lexicon_score(raw)     →  scaler.transform([lex_feats])  →  X_lex   (dense→sparse, 5 cols)
                                                                          │
                                              scipy.sparse.hstack([X_tfidf, X_lex])
                                                                          │
                                              model.predict / predict_proba
                                                                          │
                                              label_encoder.inverse_transform()
```

Key rule: **lexicon scoring runs on RAW lowercased text** (not cleaned), so URL/punctuation removal doesn't strip financial phrases before matching.

---

## 7 · Model Details

| Item | Value |
|---|---|
| Algorithm | Logistic Regression (`class_weight="balanced"`) |
| Text features | TF-IDF, unigrams+bigrams, max 3 000 features |
| Lexicon features | `lex_sum`, `lex_mean`, `lex_pos_hits`, `lex_neg_hits`, `lex_hit_count` |
| Lexicon size | 900+ terms (phrases scored −1 to +1) |
| Classes | negative · neutral · positive |
| Test Macro-F1 | **0.6408** (best of 5 models: KNN, LR, RF, NB, MLP) |

---

## 8 · Troubleshooting

| Problem | Fix |
|---|---|
| Build fails with `Cannot find module 'next/font/google'` | `layout.js` already uses `<link>` tags — don't import from `next/font/google` |
| `/api/predict` returns 500 "artifacts failed to load" | Confirm all 6 files are in `api/model_artifacts/` and committed to git |
| `vercel dev` can't find Python | Install Python 3.9–3.11 and run `pip install -r requirements.txt` first |
| `sklearn` version mismatch warning | The `requirements.txt` pins to `1.6.1` to match Colab — don't change it |
| Vercel function times out | Already set to 15 s in `vercel.json`; cold start with 1 GB RAM is normally 3–5 s |
