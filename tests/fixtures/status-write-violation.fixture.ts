// Deliberately-violating (and deliberately-clean) fixture proving the
// T-04-19 status-write ESLint rule fires on a literal MatterStatus value
// written as an object property OR as a direct member-expression
// assignment (04-REVIEW.md WR-03 widened the rule to cover both shapes),
// and stays silent on the cases that must remain legal. Lives under
// tests/fixtures/, not apps/web/src/server/ or apps/web/app/, so a real
// `pnpm eslint apps/web` run never sees it — it is only ever linted through
// a virtual-path remap inside tests/toolchain/lint-status-write.test.ts
// (the same technique tests/toolchain/lint-money-brand.test.ts already
// uses). See status-write-violation.tsx.fixture.tsx for the companion
// `.tsx`-extension gap the same finding identified.

// --- Positive cases: banned literal status writes, each of which must be
// reported. ---

function draftMatter() {
  return {
    id: "matter-1",
    status: "DRAFT",
  };
}

function signOffMatter() {
  return {
    id: "matter-2",
    status: "SIGNED_OFF",
  };
}

declare const someMatter: { status: string };
function directAssignment() {
  someMatter.status = "COMPUTING";
}

// --- Negative controls ---

// 1. A compliant write: the destination the guarded executor returned,
// never a literal. This is the one construct the rule exists to require,
// and must stay legal — in both the object-literal-property shape and the
// direct member-expression-assignment shape.
declare function evaluateTransition(from: string, event: string, input: unknown): { to: string };
function compliantWrite(matter: { status: string }) {
  const outcome = evaluateTransition(matter.status, "SUBMIT", {});
  return { ...matter, status: outcome.to };
}

function compliantAssignment(matter: { status: string }) {
  const outcome = evaluateTransition(matter.status, "SUBMIT", {});
  matter.status = outcome.to;
}

// 2. A property named `status` carrying a RULE-PACK status value, not a
// matter status. "ACTIVE" is a member of RulePackStatus
// (packages/schemas/src/rule-pack.ts) and is NOT a member of the
// seven-value MatterStatus set this rule bans — a gate that cannot
// distinguish this from the violating case above is a gate that will be
// disabled the first week it is inconvenient.
function coercedRulePack() {
  return {
    packId: "SG-PDPA",
    status: "ACTIVE",
  };
}
