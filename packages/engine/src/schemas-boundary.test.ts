import { describe, expect, it } from "vitest";
import type { Matter } from "@dsar/schemas/matter";
import type { Assessment, AssessmentLine } from "@dsar/schemas/assessment";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { RulePack } from "@dsar/schemas/rule-pack";
import type { AuditEvent } from "@dsar/schemas/audit-event";
import { MATTER_STATUSES } from "@dsar/schemas/matter-status";

// Regression test for the Phase 1 verification gap (ROADMAP Phase 1 Success
// Criterion 1: "a downstream package can import ... and compile").
// packages/engine exists specifically to be the freeze's first downstream
// consumer, but nothing in the phase 1 suite exercised a REAL cross-package
// import until this test — every gate (173 tests, ESLint, dependency-cruiser,
// tsc --build) passed while packages/engine could not actually import
// @dsar/schemas (TS5097 on the missing allowImportingTsExtensions flag,
// plus a missing workspace dependency).
//
// Imports below go through @dsar/schemas's published subpath-exports-to-source
// map ("./*": "./src/*.ts" in packages/schemas/package.json) — deliberately
// NOT a relative "../../schemas/src/..." path, which would sidestep the
// exports map and hide a regression in it.
//
// If any of the following regress, `pnpm run typecheck` (tsc --build) fails
// to compile this very file:
//   - tsconfig.base.json's `allowImportingTsExtensions` (TS5097)
//   - packages/engine/package.json's `@dsar/schemas` workspace dependency
//     (TS2307, module not found)
//   - packages/schemas's subpath exports map itself
type FrozenTypesCompile = [Matter, Assessment, AssessmentLine, ExpenseLine, RulePack, AuditEvent];

describe("packages/schemas cross-package import boundary (packages/engine consumer)", () => {
  it("resolves a real runtime value from @dsar/schemas through its package exports map", () => {
    expect(MATTER_STATUSES).toHaveLength(7);
    expect(MATTER_STATUSES).toContain("DRAFT");
    expect(MATTER_STATUSES).toContain("SIGNED_OFF");
  });

  it("typechecks the six frozen entity types across the package boundary (compile-time gate)", () => {
    // This value only exists so the FrozenTypesCompile alias above is a real,
    // used type position — tsc rejects the whole file if any imported type
    // fails to resolve. The runtime assertion is trivial by design; the
    // load-bearing check is `pnpm run typecheck` compiling this file at all.
    const typeCheckWitness: FrozenTypesCompile | undefined = undefined;
    expect(typeCheckWitness).toBeUndefined();
  });
});
