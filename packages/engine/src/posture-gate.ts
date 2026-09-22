// packages/engine/src/posture-gate.ts
//
// PRD §8.1 step 2 — the posture gate. Three of the seven `FeePosture`
// values force a terminal outcome for every line in the matter, bypassing
// the per-line treatment table entirely; the other four permit it to run.
// The switch below is exhaustive over all seven values with no `default`
// branch: a later addition to `FeePostureSchema` becomes a compile error
// here (a missing `return` on some code path conflicts with the declared
// return type) rather than silently falling through into the permitting
// branch — the dangerous direction to fail in, since that would let a fee
// be computed where a regime allows none (T-2-16).

import type { FeePosture } from "@dsar/schemas/rule-pack";

export type PostureGateOutcome =
  | { forced: false }
  | { forced: true; verdict: "DISALLOW" }
  | { forced: true; verdict: "FLAG"; flagReasonCode: "NO_FEE_AUTHORITY" };

export function applyPostureGate(posture: FeePosture): PostureGateOutcome {
  switch (posture) {
    // PROHIBITED and PERMITTED_NARROW_EXCEPTION both force every line to
    // DISALLOW (AC-14). PERMITTED_NARROW_EXCEPTION reads as if it should
    // permit *something*, but PRD §8.1 step 2 names only PROHIBITED and
    // NO_EXPRESS_AUTHORITY as terminal, and does not describe a narrow
    // per-line exception mechanism for it — until a pack actually
    // authors one, treating it as a DISALLOW-everything posture, exactly
    // like PROHIBITED, is the "engine flags/refuses rather than decides"
    // reading (PRD §0 non-negotiable #4): a regime with no express general
    // permission and only a narrow, unmodelled exception must not resolve
    // silently to ALLOW.
    case "PROHIBITED":
    case "PERMITTED_NARROW_EXCEPTION":
      return { forced: true, verdict: "DISALLOW" };
    case "NO_EXPRESS_AUTHORITY":
      return { forced: true, verdict: "FLAG", flagReasonCode: "NO_FEE_AUTHORITY" };
    case "PERMITTED_REASONABLE":
    case "PERMITTED_NOT_EXCESSIVE":
    case "PERMITTED_ACTUAL_COST":
    case "PERMITTED_PRESCRIBED_CAP":
      return { forced: false };
  }
}
