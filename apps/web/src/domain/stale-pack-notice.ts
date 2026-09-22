// apps/web/src/domain/stale-pack-notice.ts
//
// AC-39's in-flight-review half. `packIsStale` is already computed inside
// signOff() (apps/web/src/domain/attestation.ts's own caller) so the
// sign-off attestation can carry the extended §9.5 wording — but nothing
// ever renders it as a banner before sign-off, so a lawyer reviewing under
// a pack past its review date is never told before they commit. This
// function reuses packages/rulepacks/src/stale.ts's deriveEffectiveStatus
// rather than recomputing staleness from dates itself, so the banner and
// the attestation's own stale flag can never disagree about the boundary.
//
// No "use client" directive and no React import: this function's only
// production caller is apps/web/app/legal/assessments/[id]/page.tsx, a
// Server Component, which is the specific fix for the defect class
// STATE.md records twice already — Phase 05's humanizePackDisplayStatus,
// Phase 06's shouldRenderRecomputeBanner
// (apps/web/src/domain/recompute-banner.ts) — a function called from a
// Server Component cannot live in a "use client" module.

import { deriveEffectiveStatus } from "@dsar/rulepacks/stale";
import type { LoadableRulePack } from "@dsar/schemas/rule-pack";

export function shouldRenderStalePackNotice(pack: LoadableRulePack, now: string): boolean {
  return deriveEffectiveStatus(pack, now) === "STALE";
}
