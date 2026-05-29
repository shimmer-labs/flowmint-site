"use client";

import { useEffect, useState } from "react";

// Honest, plain-language phases for a non-technical owner. These rotate as
// ambient narration — they are NOT a progress bar. We deliberately avoid a
// percentage/countdown: the real analysis takes anywhere from ~25 to ~60s, so
// any number would lie (and a bar that races to 85% then stalls is the single
// most-cited trust-killer in loading UX).
const PHASES = [
  "Reading your website…",
  "Pulling your brand colors…",
  "Listening to your brand voice…",
  "Finding your products & services…",
  "Spotting email opportunities…",
  "Writing your first email…",
];

export default function AnalyzingCard() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % PHASES.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-2xl bg-white rounded-xl border-2 border-mint-600 p-12 text-center shadow-lg">
      <div className="inline-block w-16 h-16 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-6"></div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Analyzing your brand</h2>
      <p className="text-mint-700 font-medium mb-5 min-h-[1.5rem]">{PHASES[i]}</p>
      {/* Bouncing dots = honest "actively working" motion, no fake progress */}
      <div className="flex justify-center gap-1.5 mb-5" aria-hidden>
        <span className="w-2.5 h-2.5 bg-mint-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2.5 h-2.5 bg-mint-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2.5 h-2.5 bg-mint-500 rounded-full animate-bounce"></span>
      </div>
      <p className="text-sm text-gray-500">
        This usually takes 25&ndash;60 seconds &mdash; we&apos;re reading your whole site, not just the homepage.
      </p>
    </div>
  );
}
