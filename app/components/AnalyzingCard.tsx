"use client";

import { useEffect, useRef, useState } from "react";

// Honest, plain-language phases for a non-technical owner. These rotate as
// ambient narration — NOT a progress bar. We deliberately avoid a percentage/
// countdown: the real analysis takes ~25-60s, so any number would lie (and a bar
// that races to 85% then stalls is the #1 trust-killer in loading UX). Each phase
// gets a morphing emoji + the text "flips" into place like a train-station board.
const PHASES = [
  { emoji: "🌐", text: "READING EVERY PAGE" },
  { emoji: "🎨", text: "PULLING YOUR COLORS" },
  { emoji: "🗣️", text: "LEARNING YOUR VOICE" },
  { emoji: "🧰", text: "FINDING YOUR SERVICES" },
  { emoji: "💡", text: "SPOTTING OPPORTUNITIES" },
  { emoji: "✉️", text: "WRITING YOUR FIRST EMAIL" },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*?/";

export default function AnalyzingCard() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [display, setDisplay] = useState(PHASES[0].text);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance through phases on a loop (ambient narration, not progress).
  useEffect(() => {
    const id = setInterval(() => setPhaseIdx((i) => (i + 1) % PHASES.length), 2800);
    return () => clearInterval(id);
  }, []);

  // Split-flap: scramble each character through random glyphs, resolving the
  // target text left-to-right whenever the phase changes.
  useEffect(() => {
    const target = PHASES[phaseIdx].text;
    let frame = 0;
    if (scrambleRef.current) clearInterval(scrambleRef.current);
    scrambleRef.current = setInterval(() => {
      frame++;
      const resolved = Math.floor(frame / 2); // ~2 frames per settled char
      setDisplay(
        target
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " ";
            if (i < resolved) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );
      if (resolved >= target.length && scrambleRef.current) {
        clearInterval(scrambleRef.current);
        scrambleRef.current = null;
      }
    }, 28);
    return () => {
      if (scrambleRef.current) clearInterval(scrambleRef.current);
    };
  }, [phaseIdx]);

  return (
    <div className="max-w-2xl w-full mx-auto rounded-2xl bg-gray-900 p-10 text-center shadow-xl">
      <div className="text-5xl mb-5 leading-none" aria-hidden>
        {PHASES[phaseIdx].emoji}
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-mint-400 mb-4">
        Reading your website
      </div>

      {/* Split-flap departure board. Each WORD is a no-wrap group so words never
          break mid-word; rows wrap between words only. min-height reserves space
          for up to two rows so the card never changes shape as phases swap. */}
      <div
        className="flex flex-wrap justify-center items-center content-center gap-x-3 gap-y-2 mb-6 min-h-[4.75rem]"
        aria-label={PHASES[phaseIdx].text}
      >
        {display.split(" ").map((word, wi) => (
          <span key={wi} className="inline-flex gap-1 whitespace-nowrap">
            {word.split("").map((ch, ci) => (
              <span
                key={ci}
                className="inline-flex items-center justify-center w-7 h-9 rounded bg-gray-800 text-mint-300 font-mono font-bold text-base border-b-2 border-black/50 shadow-inner"
              >
                {ch}
              </span>
            ))}
          </span>
        ))}
      </div>

      {/* Constant "working" motion */}
      <div className="flex justify-center gap-1.5 mb-5" aria-hidden>
        <span className="w-2 h-2 bg-mint-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 bg-mint-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 bg-mint-400 rounded-full animate-bounce"></span>
      </div>

      <p className="text-sm text-gray-400">
        This usually takes 25&ndash;60 seconds. We&apos;re reading your whole website, not just the homepage.
      </p>
    </div>
  );
}
