/**
 * Flow library — the "why this flow matters" content that powers the
 * value cards on the results page. Client-safe static data (no server deps).
 *
 * `flow-mappings.ts` owns generation/recommendation logic (ids, emailCount,
 * recommendFlows, playbookFor). This file owns the human-facing pitch for each
 * flow: the goal, what to include, and a defensible ROI line. Keyed by the same
 * flow ids.
 *
 * ROI lines are deliberately phrased as soft ranges, not promises — see
 * FLOW_LIBRARY_FOOTNOTE for the named-source disclaimer rendered once under the
 * cards. Sources: Klaviyo / Omnisend email benchmarks + general industry data.
 */

export interface FlowMeta {
  /** One-line why / the job this flow does. */
  goal: string;
  /** 2-4 short "what to include" bullets. */
  whatToInclude: string[];
  /** Soft, defensible impact line (ranges, not promises). */
  roi?: string;
}

export const FLOW_META: Record<string, FlowMeta> = {
  // --- Service-business playbook ---
  welcome: {
    goal: "Turn a new lead or subscriber into a booked first job.",
    whatToInclude: [
      "A warm intro and what makes you different",
      "What to expect when they work with you",
      "An easy first step: book, call, or get a quote",
    ],
    roi: "Welcome emails average ~50% open rate — among the highest-performing emails you can send.",
  },
  "post-job-followup": {
    goal: "Lock in the good experience right after a job, then turn it into a review and repeat work.",
    whatToInclude: [
      "A genuine thank-you and a quick “everything working?” check",
      "A one-tap ask for a review while it's fresh",
      "A nudge to save your number for next time",
    ],
    roi: "Keeping past customers close is where most service revenue comes from — they're far cheaper to win than new leads.",
  },
  "review-request": {
    goal: "Get more recent 5-star reviews so new customers choose you.",
    whatToInclude: [
      "Ask while the job is fresh in their mind",
      "Make it one click — link straight to Google",
      "Keep it short and gracious",
    ],
    roi: "Most happy customers will leave a review when asked directly, and recent reviews drive more inbound calls.",
  },
  "seasonal-maintenance": {
    goal: "Bring past customers back on a schedule instead of waiting for something to break.",
    whatToInclude: [
      "Tie it to the season (pre-summer AC, pre-winter heat)",
      "The payoff: fewer breakdowns, lower bills, longer equipment life",
      "Make booking the tune-up effortless",
    ],
    roi: "Re-engaging an existing customer costs a fraction of winning a new one — one of the best uses of your list.",
  },
  "about-to-lapse": {
    goal: "Re-engage customers who haven't booked in a while, before you lose them.",
    whatToInclude: [
      "A friendly “we haven't seen you in a while”",
      "A reason to come back now (seasonal need, a check-up, an offer)",
      "An easy path to rebook",
    ],
    roi: "Win-back emails re-engage roughly 45% of lapsed customers — far cheaper than replacing them.",
  },
  "estimate-followup": {
    goal: "Win back the leads who got a quote but went quiet.",
    whatToInclude: [
      "Recap the value and exactly what's included",
      "Address the common hold-ups: price, timing, financing",
      "Make saying yes and getting scheduled easy",
    ],
    roi: "Most jobs aren't won on the first touch — a short follow-up recovers quotes that would otherwise go cold.",
  },
  referral: {
    goal: "Turn your happiest customers into your best lead source.",
    whatToInclude: [
      "Ask people who just had a great experience",
      "Make sharing your info effortless",
      "Mention any thank-you you offer for a referral",
    ],
    roi: "Referred customers tend to convert better and stick around longer than any other channel.",
  },
  "feedback-survey": {
    goal: "Catch an unhappy customer privately before they post about it publicly.",
    whatToInclude: [
      "A quick 2-3 question check-in",
      "Send unhappy replies straight to you to make it right",
      "Point happy ones toward a public review",
    ],
    roi: "A simple feedback step turns silent churn into a chance to fix things, and protects your rating.",
  },

  // --- E-commerce playbook (lighter copy; used when the brand is a store) ---
  "cart-abandonment": {
    goal: "Recover the sales that almost happened.",
    whatToInclude: [
      "Remind them what they left behind",
      "Handle objections (shipping, returns)",
      "One clear path back to checkout",
    ],
    roi: "Abandoned-cart emails recover a meaningful share of lost sales — among the highest-ROI automations in e-commerce.",
  },
  "checkout-abandonment": {
    goal: "Catch buyers who started checkout but didn't finish.",
    whatToInclude: [
      "A nudge with light urgency",
      "Reassurance on payment and returns",
      "A direct link back to finish",
    ],
    roi: "Checkout abandoners are your warmest buyers — recovering even a slice is high-value.",
  },
  "post-purchase-onboarding": {
    goal: "Help new customers get value fast and come back.",
    whatToInclude: [
      "Thank them and set expectations",
      "Tips to get the most from what they bought",
      "An easy next step (review, accessories, support)",
    ],
    roi: "Strong post-purchase emails lift repeat-purchase rates and reviews.",
  },
  "back-in-stock": {
    goal: "Convert demand the moment a wanted item returns.",
    whatToInclude: [
      "Tell them it's back, fast",
      "A low-stock nudge if true",
      "One tap to buy",
    ],
    roi: "Back-in-stock alerts convert unusually well — the intent is already there.",
  },
  "cross-sell": {
    goal: "Grow order value with the right next product.",
    whatToInclude: [
      "Recommend complements to what they bought",
      "Social proof (“customers also bought…”)",
      "An optional bundle deal",
    ],
    roi: "Cross-sell emails lift average order value with audiences who already trust you.",
  },
};

export const FLOW_LIBRARY_FOOTNOTE =
  "Impact figures are rough industry ranges (Klaviyo / Omnisend email benchmarks and general small-business data), shown to explain why each flow matters. Your results will vary.";

export function getFlowMeta(id: string): FlowMeta | undefined {
  return FLOW_META[id];
}
