import "./globals.css";
import AmbientBackground from "./components/AmbientBackground";

export const metadata = {
  title: "FinSentiment — Financial Sentiment Analyzer",
  description:
    "AI-powered financial sentiment analysis using Logistic Regression trained on TF-IDF and a 900+ term financial lexicon. Classify market text as positive, neutral, or negative instantly.",
  keywords: "financial sentiment analysis, NLP, machine learning, stock market, fintech",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AmbientBackground />
        {children}
      </body>
    </html>
  );
}
