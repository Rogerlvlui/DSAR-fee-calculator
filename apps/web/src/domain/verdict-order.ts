// apps/web/src/domain/verdict-order.ts
//
// PRD §10.3: "Ordered: FLAG first, then ALLOW_CAPPED, then DISALLOW, then
// ALLOW. Flagged items are the work; put them where the eye lands." This is
// the one place that ordering rule is expressed — the card sort in
// assessment-view.tsx imports compareByVerdict rather than re-deriving the
// order from where a line happens to sit in the array.
//
// Lives under src/domain/ (not src/ui or src/server) because both layers
// need the same order: the server could sort before ever handing lines to
// the presentational layer, and the presentational layer needs the same
// answer for a unit assertion on the map itself, independent of any render.
// No dependency-cruiser rule restricts imports INTO this directory — the
// existing no-server-imports-in-ui rule only forbids apps/web/src/ui from
// reaching apps/web/src/server, and this module reaches neither.

import type { Verdict } from "@dsar/schemas/assessment";

export const VERDICT_ORDER: Record<Verdict, number> = {
  FLAG: 0,
  ALLOW_CAPPED: 1,
  DISALLOW: 2,
  ALLOW: 3,
};

export function compareByVerdict(a: { verdict: Verdict }, b: { verdict: Verdict }): number {
  return VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
}
