---
phase: 04-workflow-and-audit-backbone
reviewed: 2026-09-19T00:00:00Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - .dependency-cruiser.cjs
  - apps/web/app/(hr)/matters/[id]/page.tsx
  - apps/web/app/api/assessments/[id]/recompute/route.ts
  - apps/web/app/api/assessments/[id]/supersede/route.ts
  - apps/web/package.json
  - apps/web/src/server/audit-trail.ts
  - apps/web/src/server/data/assessments.ts
  - apps/web/src/server/data/audit.ts
  - apps/web/src/server/data/auth.ts
  - apps/web/src/server/data/matters.ts
  - apps/web/src/server/guard-input.ts
  - apps/web/src/server/recompute.ts
  - apps/web/src/server/repositories/interface.ts
  - apps/web/src/server/repositories/memory/assessment-repository.ts
  - apps/web/src/server/repositories/memory/store.ts
  - eslint.config.js
  - package.json
  - packages/audit/package.json
  - packages/audit/src/interface.ts
  - packages/audit/src/memory/audit-event-writer.test.ts
  - packages/audit/src/memory/audit-event-writer.ts
  - packages/audit/src/memory/pack-lifecycle-event-writer.test.ts
  - packages/audit/src/memory/pack-lifecycle-event-writer.ts
  - packages/audit/src/memory/store.ts
  - packages/audit/src/payload-builders.ts
  - packages/audit/src/review-session.test.ts
  - packages/audit/src/review-session.ts
  - packages/audit/tsconfig.json
  - packages/workflow/package.json
  - packages/workflow/src/evaluate-transition.test.ts
  - packages/workflow/src/evaluate-transition.ts
  - packages/workflow/src/guards.ts
  - packages/workflow/src/transitions.test.ts
  - packages/workflow/src/transitions.ts
  - packages/workflow/tsconfig.json
  - tests/fixtures/status-write-violation.fixture.ts
  - tests/fixtures/workflow-determinism-violation.fixture.ts
  - tests/fixtures/workflow-io-violation/impure.ts
  - tests/routes/audit-export.test.ts
  - tests/routes/audit-trail.test.ts
  - tests/routes/correction.test.ts
  - tests/routes/lifecycle.test.ts
  - tests/routes/recompute.test.ts
  - tests/routes/workflow-tracer.test.ts
  - tests/toolchain/lint-status-write.test.ts
  - tests/toolchain/lint-workflow-determinism.test.ts
  - tests/toolchain/purity-gate.test.ts
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-09-19
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

The phase's headline safety property — a signed-off `Assessment` is read but never rewritten by `raiseCorrection()`, with the correction saved under a freshly generated ULID rather than the engine's own input-derived id — is implemented correctly and is exercised by a genuinely convincing test (`tests/routes/correction.test.ts`'s deep-equal-snapshot-before-and-after assertion). The guarded-transition table (`packages/workflow`), its purity enforcement (`.dependency-cruiser.cjs`, `eslint.config.js`), and the append-only audit writers (`packages/audit`) are all solid and well tested for the paths their own test suites exercise.

The problems are concentrated in the two in-place recompute call sites in `apps/web/src/server/data/matters.ts` — `resubmitAfterInfoRequest()` and `recomputeAgainstCurrentPack()`. Both mutate the matter's status to `COMPUTING` and then call the engine with no error handling, unlike their sibling `submitForAssessment()`, which carefully rolls back to `DRAFT` and records a `COMPUTE_FAILED` audit event if the engine throws. I traced a concrete, dated trigger for this gap: the committed SG-PDPA pack's `reviewDueOn` is `2027-03-12`, `packages/engine`'s own `checkPreconditions()` independently re-checks that date against the live wall clock every time `assess()` runs, and neither `RESUBMIT` nor `RECOMPUTE`'s workflow guard can catch this in advance because the demo's `coercePackForDemoEngine()` unconditionally forces `pack.status` to `"ACTIVE"` for guard purposes (only `submitForAssessment()` happens to be protected by its own try/catch). `recomputeAgainstCurrentPack()` also never writes an audit record for the `RECOMPUTE` transition itself, unlike `resubmitAfterInfoRequest()`'s equivalent `RESUBMIT` transition, which does.

## Critical Issues

### CR-01: `resubmitAfterInfoRequest` and `recomputeAgainstCurrentPack` have no rollback if the engine throws — the matter is left permanently stuck in COMPUTING, and this is a dated, provable failure mode

**File:** `apps/web/src/server/data/matters.ts:408-424` (resubmitAfterInfoRequest) and `apps/web/src/server/data/matters.ts:482-489` (recomputeAgainstCurrentPack)

**Issue:** Compare the three status-mutating call sites in this file:

- `submitForAssessment` (lines 308-369) writes the matter to `COMPUTING`, then wraps the `assessMatter()` call in `try { ... } catch (error) { ... }`. If the engine throws, it asks the executor for `COMPUTE_FAILED`, rolls the matter back to `DRAFT`, and records a `COMPUTE_FAILED` audit event carrying the failure reason before rethrowing.
- `resubmitAfterInfoRequest` (lines 386-444) writes the matter to `COMPUTING` at line 409, then calls `recomputeAssessment({ matter, lines, existing })` at line 423 with **no try/catch at all**.
- `recomputeAgainstCurrentPack` (lines 464-507) writes the matter to `COMPUTING` at line 482, then calls `recomputeAssessment({ matter, lines, existing })` at line 488, again with **no try/catch**.

`recomputeAssessment()` (`apps/web/src/server/recompute.ts:46-51`) calls `assessMatter()`, which calls `packages/engine`'s `assess()`, whose first step (`checkPreconditions`, `packages/engine/src/preconditions.ts:59-64`) throws `AssessPreconditionFailure` if `daysUntil(now, pack.reviewDueOn) < 0` — i.e. once the pack's review-due date is in the past relative to the live wall clock (`assessMatter` uses `new Date().toISOString()` as `now`, confirmed in `apps/web/src/server/engine-invocation.ts:63`).

The committed SG-PDPA pack's `reviewDueOn` is `2027-03-12` (the value used throughout this phase's own test fixtures, e.g. `packages/workflow/src/evaluate-transition.test.ts:27`). Neither the `RESUBMIT` guard (`checkPackUsable`, which does check `pack.status === "STALE"`) nor the `RECOMPUTE` guard (`checkPackAvailable`, which does not check staleness at all) can catch this in advance in the demo build, because `coercePackForDemoEngine()` (`apps/web/src/server/engine-invocation.ts:44-50`) unconditionally overrides `status` to `"ACTIVE"` on the copy fed to `buildGuardInput()` — the guard can never observe `"STALE"`. The *engine's own* precondition check is unaffected by that coercion (it re-reads the real `reviewDueOn`), so it is the only thing that will ever catch this, and only `submitForAssessment` is wired to catch what it throws.

Concretely: once the wall clock passes 2027-03-12, any lawyer clicking "resubmit after an information request" or "recompute against the current pack" on an in-flight matter will cause an uncaught `AssessPreconditionFailure` to propagate out of the data-layer function, after the matter has already been persisted with `status: "COMPUTING"`. No code path exists that will ever move that matter out of `COMPUTING` again (the only guard row that accepts `COMPUTING` as an origin is `COMPUTE_SUCCEEDED`/`COMPUTE_FAILED`, and nothing calls either for these two paths). The matter is now permanently unreachable by any legal reviewer or HR preparer action, with no audit record explaining what happened — a `500` is returned to the caller, and that is the only trace.

This is not a purely hypothetical edge case: it is a scheduled, dated regression against a value already committed to the repository and asserted against in tests, roughly six months out from today.

**Fix:** Wrap both `recomputeAssessment()` calls in the same try/catch/rollback shape `submitForAssessment` already uses:

```ts
// resubmitAfterInfoRequest and recomputeAgainstCurrentPack
try {
  const updatedAssessment = recomputeAssessment({ matter, lines, existing });
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);
  const computeGuardInput = buildGuardInput({ matter, lines, assessment: updatedAssessment, pack, actor });
  const computeOutcome = evaluateTransition(resubmitOutcome.to, "COMPUTE_SUCCEEDED", computeGuardInput);
  if (!computeOutcome.allowed) throw new ConflictError(computeOutcome.reason);
  await memoryMatterRepository.updateMatter({ ...matter, status: computeOutcome.to });
  await recordAuditEvent({ /* COMPUTED, as today */ });
  // ...
} catch (error) {
  const failOutcome = evaluateTransition(resubmitOutcome.to, "COMPUTE_FAILED", guardInput);
  if (!failOutcome.allowed) throw new Error(`Internal error: rollback transition refused (${failOutcome.reason})`);
  await memoryMatterRepository.updateMatter({ ...matter, status: failOutcome.to });
  const reason = error instanceof Error ? error.message : String(error);
  await recordAuditEvent({ /* COMPUTE_FAILED, carrying reason */ });
  throw error;
}
```
Note `COMPUTE_FAILED`'s only declared origin is `COMPUTING` (`packages/workflow/src/transitions.ts:108-117`), which both of these paths reach — so the same rollback row `submitForAssessment` already relies on is directly reusable here. This is also a good moment to extract the shared try/catch/rollback shape into one helper in `recompute.ts` rather than triplicating it a third time.

---

### CR-02: `recomputeAgainstCurrentPack` never records an audit event for the RECOMPUTE transition itself

**File:** `apps/web/src/server/data/matters.ts:482-489`

**Issue:** `resubmitAfterInfoRequest` records a `SUBMITTED` audit event for its own `RESUBMIT` transition (`transitionPayload(statusBeforeResubmit, resubmitOutcome.to)`, lines 410-417) before performing the recompute, in addition to the `COMPUTED` event it writes afterward. `recomputeAgainstCurrentPack` performs the exact same shape of transition (`LEGAL_REVIEW -> COMPUTING`, guarded, lawyer-initiated) but writes **no audit event at all** for it — only the subsequent `COMPUTED` event (`COMPUTING -> LEGAL_REVIEW`) is recorded. There is nothing in the audit log distinguishing "a lawyer deliberately discarded every existing disposition on this assessment and recomputed it against the current pack" from any other path that happens to produce a `COMPUTED` event with `before: "COMPUTING"`.

This directly undercuts CLAUDE.md's non-negotiable #3 ("No output leaves the system without a named lawyer's sign-off, recorded in the audit log") and the phase's own stated success criterion of a complete, provenance-carrying audit trail for every guarded transition — this is the one guarded, lawyer-only, disposition-destroying transition in the whole table that leaves no direct trace of itself, and no test in `tests/routes/recompute.test.ts` checks for one (it only asserts the `COMPUTED` count increments), so the gap is currently unguarded by any test either.

**Fix:** Record an event for the `RECOMPUTE` transition itself, mirroring `resubmitAfterInfoRequest`'s pattern:

```ts
const statusBeforeRecompute = matter.status;
await memoryMatterRepository.updateMatter({ ...matter, status: recomputeOutcome.to });
await recordAuditEvent({
  matterId: matter.id,
  actor,
  type: "SUBMITTED", // or a dedicated event type, if one is judged worth adding
  payload: transitionPayload(statusBeforeRecompute, recomputeOutcome.to),
  rulePackVersion: pack.version,
  engineVersion: ENGINE_VERSION,
});
```

## Warnings

### WR-01: A COMPUTE_SUCCEEDED guard refusal inside `submitForAssessment`'s try block leaves an already-saved assessment orphaned in the repository

**File:** `apps/web/src/server/data/matters.ts:319-331`

**Issue:** Inside `submitForAssessment`'s try block, `assessMatter()` runs and its result is saved via `memoryAssessmentRepository.saveAssessment(assessment)` (line 321) *before* the `COMPUTE_SUCCEEDED` guard is evaluated (lines 327-331). If that guard ever refuses (`computeOutcome.allowed === false`), the code throws a `ConflictError`, which is caught by the same catch block that handles a thrown engine error — the matter correctly rolls back to `DRAFT` with a `COMPUTE_FAILED` audit record, but the assessment that was already written at line 321 is never deleted or otherwise marked invalid; it simply sits in `memoryAssessmentRepository`'s store attached to a matter that is now back in `DRAFT`.

Given the engine's invariant that every submitted expense line produces exactly one `PENDING` assessment line (confirmed in `packages/engine/src/assess.ts`), this specific guard can't currently fail in practice when `assessMatter()` itself succeeds — but the code does not rely on or document that invariant at this call site, and the moment it stops holding (e.g. a future engine change that can legitimately produce a partial line set) this becomes a live orphaned-record bug, silently inconsistent with the "a refusal writes nothing at all" discipline the rest of this file states as a design principle for every other action.

**Fix:** Either delete the just-saved assessment before rethrowing in this specific branch, or move the `COMPUTE_SUCCEEDED` guard check to before `saveAssessment` is called (compute the assessment, evaluate the guard against its result without persisting it yet, and only call `saveAssessment` once the guard has already passed).

### WR-02: The HR result page reads expense lines directly from the repository instead of through a role-checked data-layer function

**File:** `apps/web/app/(hr)/matters/[id]/page.tsx:65`

**Issue:** `const expenseLines = await memoryMatterRepository.listExpenseLines(id);` calls the repository directly rather than going through a `requireRole()`-gated function in `apps/web/src/server/data/*`. Every other read and write in this codebase follows the stated convention that `requireRole()` is "called as the first statement of every function in `src/server/data/`... never only at the page level" (`apps/web/src/server/data/auth.ts:65-68`), and this exact anti-pattern — a page calling a memory repository directly, with no role check anywhere on that specific call — was previously found and fixed for the legal worklist page (03.1-REVIEW.md UNREG-1, now `listReviewableMatters()` in this same file).

In this specific case it is not currently exploitable, because the two preceding calls on the same request path (`getHrMatterStatus`, `getSignedOffAssessmentForHr`) already call `requireRole(actor, "HR_PREPARER")` and throw before this line is reached for any other role. But the safety here depends entirely on statement order in a page component rather than on the read itself being gated — a future edit that reorders these calls, or that adds a new early-return branch before the assessment read but after this line, would silently reintroduce exactly the class of bug UNREG-1 already required a fix for.

**Fix:** Add a small role-checked wrapper in `apps/web/src/server/data/matters.ts` (e.g. `getExpenseLinesForHr(actor, matterId)`, calling `requireRole(actor, "HR_PREPARER")` first) and have the page call that instead of the repository directly.

### WR-03: The T-04-19 status-write ESLint gate has two known bypasses: `.tsx` files, and member-expression assignment

**File:** `eslint.config.js:196-215`

**Issue:** The rule banning a literal `MatterStatus` value written as an object property is scoped to `files: ["apps/web/src/server/**/*.ts", "apps/web/app/**/*.ts"]`. This glob does not match `.tsx` files at all — a server component under `apps/web/app/**/*.tsx` (like the page reviewed in WR-02) that constructed `{ ...matter, status: "SIGNED_OFF" }` directly would never be linted by this rule. Separately, the rule's selector (`Property[key.name='status'][value.type='Literal']...`) only matches object-literal properties; a member-expression assignment such as `matter.status = "SIGNED_OFF";` is an `AssignmentExpression`/`MemberExpression`, not a `Property` node, and would not be reported either, even inside a covered `.ts` file. Neither gap is currently exploited anywhere in the codebase (verified by grep), but both are silent, complete bypasses of a control this phase treats as load-bearing for CLAUDE.md's state-machine discipline, and dependency-cruiser (the other purity gate in this phase) cannot see either construct.

**Fix:** Widen the `files` glob to include `.tsx` (`apps/web/app/**/*.{ts,tsx}`), and add a second selector covering `AssignmentExpression[left.property.name='status'][right.type='Literal'][right.value=...]` alongside the existing `Property` selector, using the same shared `MATTER_STATUS_LITERAL_PATTERN`.

---

_Reviewed: 2026-09-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
