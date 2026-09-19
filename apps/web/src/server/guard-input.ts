// apps/web/src/server/guard-input.ts
//
// Assembles the frozen GuardInput from already-fetched values: the matter,
// its expense lines, the optional assessment, the pack, and the acting
// actor. It fetches nothing itself, so it stays directly unit-testable and
// the data layer keeps owning its own reads.
//
// DEMO-ONLY: the pack member is fed apps/web/src/server/engine-invocation.ts's
// demo-coerced pack (coercePackForDemoEngine's output), not the raw loaded
// one. The committed SG-PDPA pack is honestly DRAFT and cannot legitimately
// reach an authored ACTIVE state before Phase 6 (D-16) — feeding the guard
// the raw draft status would refuse every submission and break the demo.
// The pack-status rule itself stays genuinely proven: it is unit-tested
// directly against draft, stale and withdrawn packs in
// packages/workflow/src/evaluate-transition.test.ts. Phase 6 removes this
// coercion once an authored ACTIVE pack exists.

import "./server-only.ts";
import type { GuardInput } from "@dsar/schemas/guard-input";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Assessment } from "@dsar/schemas/assessment";
import type { RulePack } from "@dsar/schemas/rule-pack";
import type { DemoActor } from "./data/auth.ts";

export interface BuildGuardInputArgs {
  matter: Matter;
  lines: readonly ExpenseLine[];
  assessment: Assessment | null;
  pack: RulePack | null;
  actor: DemoActor;
}

export function buildGuardInput(args: BuildGuardInputArgs): GuardInput {
  const { matter, lines, assessment, pack, actor } = args;

  // Derived from the two intake attestations the intake form itself treats
  // as blocking (identity verified and scope clarified). The dispute
  // attestation (isKnownDisputeOrLitigation) is informational by the PRD's
  // own words and must not block anything — it is deliberately absent from
  // this derivation.
  const attestationsAddressed = matter.identityVerified && matter.scopeClarified;

  const pendingLineCount = assessment
    ? assessment.lines.filter((line) => line.disposition === "PENDING").length
    : 0;

  const matterLevelFlagsRequiringAck = assessment
    ? assessment.matterLevelFlags.filter((flag) => flag.requiresAcknowledgement).map((flag) => flag.id)
    : [];

  return {
    matterStatus: matter.status,
    expenseLineCount: lines.length,
    jurisdictionCode: matter.jurisdictionCode,
    currency: matter.currency,
    controllerType: matter.controllerType,
    pack: pack ? { status: pack.status, reviewDueOn: pack.reviewDueOn, appliesTo: pack.appliesTo } : null,
    attestationsAddressed,
    pendingLineCount,
    matterLevelFlagsRequiringAck,
    // No flag-acknowledgement tracking exists yet anywhere in this codebase
    // (that UI lands in a later phase) — always empty until then.
    acknowledgedFlags: [],
    // Server-side only, from the resolved actor — never taken from the
    // request body (T-04-06).
    lawyerIdentity: actor.role === "LEGAL_REVIEWER" ? actor.user : null,
  };
}
