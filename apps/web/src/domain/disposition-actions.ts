// apps/web/src/domain/disposition-actions.ts
//
// The per-verdict permitted-action map (PRD §10.3's control list) and the
// minimum-reason-length rule (this phase's locked decision: a minimum-length
// check only, no stop-list — AC-23's stop-list half is Phase 6's). Pure and
// lives under src/domain/ for the same reason verdict-order.ts does: both
// disposition-controls.tsx (which decides which buttons to render) and
// apps/web/src/server/data/assessments.ts's dispositionLine (which decides
// whether a submitted action is even legal for the line's verdict) need the
// SAME answer, or the UI could offer a control the server always refuses.
//
// Not named in this plan's frontmatter alongside verdict-order.ts and
// review-tallies.ts — added as a small, necessary domain module once Task 2
// needed a single shared source for this map rather than letting the
// client and server each invent their own copy.

import type { Verdict } from "@dsar/schemas/assessment";
import { REASON_STOP_LIST } from "@dsar/schemas/constants";

export type DispositionAction = "ACCEPT" | "REDUCE" | "STRIKE" | "ALLOW_WITH_AMOUNT" | "ALLOW_ANYWAY";

// PRD §10.3: "ALLOW lines get Accept / Reduce / Strike; FLAG lines get
// Allow-with-amount / Strike / Ask HR ...; DISALLOW lines get Accept /
// Allow-anyway." "Ask HR" is a real control (rendered by
// disposition-controls.tsx) but is not one of these five actions — it moves
// the matter to INFO_REQUEST rather than dispositioning a line, and this
// plan's own assumptions record that transition as Plan 04's, not this
// plan's, to build.
export const VERDICT_ACTIONS: Record<Verdict, readonly DispositionAction[]> = {
  ALLOW: ["ACCEPT", "REDUCE", "STRIKE"],
  ALLOW_CAPPED: ["ACCEPT", "REDUCE", "STRIKE"],
  FLAG: ["ALLOW_WITH_AMOUNT", "STRIKE"],
  DISALLOW: ["ACCEPT", "ALLOW_ANYWAY"],
};

export function isActionPermitted(verdict: Verdict, action: DispositionAction): boolean {
  return VERDICT_ACTIONS[verdict].includes(action);
}

export const ACTIONS_TAKING_AMOUNT: ReadonlySet<DispositionAction> = new Set<DispositionAction>([
  "REDUCE",
  "ALLOW_WITH_AMOUNT",
  "ALLOW_ANYWAY",
]);

// PRD §6.3 is silent on a zero amount; the product owner decided (2026-09-25)
// that charging nothing must be recorded as the action that means it, never
// as a reduction or allowance of 0.00. On a DISALLOW line that is Accept.
export function nothingChargedAction(action: DispositionAction): "Strike" | "Accept" {
  return action === "ALLOW_ANYWAY" ? "Accept" : "Strike";
}

// The mockup's own counter ("0 / 10 characters minimum") — the length half
// of AC-23 this phase implements; the stop-list half is Phase 6's.
export const MIN_REASON_NON_WHITESPACE_CHARS = 10;

export function countNonWhitespaceChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function hasSufficientReason(text: string): boolean {
  return countNonWhitespaceChars(text) >= MIN_REASON_NON_WHITESPACE_CHARS;
}

// AC-23's stop-list half. A WHOLE-REASON comparison (trim + case-fold),
// never a substring scan — "Noted the vendor's invoice number and it
// matches the claim" must NOT match on "noted", or a lawyer who genuinely
// writes a real sentence containing a stop-list word would be wrongly
// blocked. Returns the matched stop-list entry (its own canonical,
// lower-cased form) or null.
export function matchesReasonStopList(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  return REASON_STOP_LIST.find((entry) => entry === normalized) ?? null;
}

// The combined check every call site (server-authoritative
// assertSufficientReason in src/server/data/assessments.ts, and both
// client, UX-only, reason-gating call sites in disposition-controls.tsx and
// bulk-accept-bar.tsx — IN-01, 06-REVIEW-ADDENDUM.md) uses so length and
// stop-list are checked together, never independently reimplemented and
// left to drift at one call site.
export function hasSufficientAndGenuineReason(text: string): boolean {
  return hasSufficientReason(text) && matchesReasonStopList(text) === null;
}
