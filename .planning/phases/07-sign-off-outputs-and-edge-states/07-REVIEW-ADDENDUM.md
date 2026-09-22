---
phase: 07-sign-off-outputs-and-edge-states
reviewed: 2026-09-22T00:00:00Z
depth: fix-pass
status: partially_resolved
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
  resolved: 4
  deferred: 2
---

# Phase 07: Review Addendum — Fix Pass on 07-REVIEW.md's Findings

**Reviewed:** 2026-09-22
**Do not edit `07-REVIEW.md`** — it remains the historical record of the original code-review pass. This addendum documents what was fixed afterward, following the `05-REVIEW-ADDENDUM.md` / `06-REVIEW-ADDENDUM.md` precedent.

## Scope

Per instruction, this pass fixed the Critical finding and all three Warnings from `07-REVIEW.md`. The two Info findings (IN-01: unused `@dsar/engine` dependency in `packages/documents/package.json`; IN-02: `notice-outputs.test.ts`'s test helper diverges from production's disposition-aware amount derivation) were explicitly out of scope for this pass and remain open/deferred — neither is a correctness or security defect in shipped behavior, both are workable follow-ups.

## Findings and Fixes

### CR-01 (Critical) — Content-Disposition header built from an unescaped, unbounded HR-controlled field

**Issue:** `apps/web/app/api/assessments/[id]/internal-record/route.ts` interpolated `matter.reference` (HR-controlled free text, no length/character restriction) directly into the `Content-Disposition` header's quoted `filename` parameter. A `"` in `reference` broke out of the quoted parameter and let a lower-privileged `HR_PREPARER` append an arbitrary `filename*` (RFC 5987) parameter, controlling what filename a `LEGAL_REVIEWER`'s browser would save the evidentiary PDF under.

**Fix:** Added `buildInternalRecordContentDisposition()`, which builds an ASCII-only fallback `filename` (every character outside `[A-Za-z0-9._-]` replaced with `_`, so no quote/semicolon/control character can reach the header raw) plus a correctly percent-encoded `filename*=UTF-8''...` parameter carrying the real reference, per RFC 6266.

**Regression tests:** `tests/routes/internal-record.test.ts` — a unit-level test against the exported helper proving a quote/semicolon-bearing reference produces exactly one `filename*` parameter (the full percent-encoded reference, never an attacker-appended one) and a fallback filename with no raw `"`/`;`; and a route-level test creating a real matter with a quote-bearing reference, signing it off, and asserting the actual response header carries no injected parameter.

**Commit:** `bdadc1c`

---

### WR-01 (Warning) — `String.prototype.replace` with a lawyer-typed value silently corrupts the internal-record footer

**Issue:** `renderInternalRecordFooter` (`packages/documents/src/internal-record-view.ts`) chained `String.prototype.replace(literal, value)` six times. `replace`'s special replacement patterns (`$&`, `` $` ``, `$'`, `$$`, `$<name>`) are interpreted in the replacement argument even when the search argument is a plain string, so a lawyer-typed `qualification` (or any other footer field) containing e.g. `$&` silently substituted matched placeholder text, or a literal `$$` collapsed to a single `$`, in the rendered evidentiary footer — with no error raised.

**Fix:** Replaced the `.replace()` chain with `split(placeholder).join(value)`, which inserts every value literally with no special-pattern interpretation.

**Regression tests:** `packages/documents/src/internal-record-view.test.ts` — three new cases: a `$&`-bearing qualification, a `$$`-bearing qualification, and a `` $` ``-bearing lawyerName, each asserting the value is inserted literally and neighboring placeholders are unaffected.

**Commit:** `aefdd70`

---

### WR-02 (Warning) — `SignOff.qualification` is the only sign-off free-text field with no length cap

**Issue:** `FREE_TEXT_LIMITS` (`packages/schemas/src/constants.ts`) capped `description`, `hrNote`, `identityVerifiedNote`, and `lawyerReason`, but not `qualification` — neither in the constant nor in `SignOffSchema` nor in the generated JSON Schema. Combined with WR-01, an arbitrarily long qualification string flowed unbounded into the sign-off record, the audit log, and the internal-record PDF footer.

**Fix:** Added `FREE_TEXT_LIMITS.qualification = 200` (matching `identityVerifiedNote`'s magnitude). Enforced at two layers, mirroring `lawyerReason`'s existing precedent: `SignOffSchema.qualification` now carries `.max(FREE_TEXT_LIMITS.qualification)`, and `signOff()` in `apps/web/src/server/data/assessments.ts` throws a `ValidationError` alongside its existing empty-string check. Regenerated the committed JSON Schema artifact (`pnpm schema:json`).

**Regression tests:** `tests/routes/signoff.test.ts` — a 201-character qualification is refused (400, nothing stored); a 200-character qualification (the boundary) is accepted and stored verbatim.

**Commit:** `2848660`

---

### WR-03 (Warning) — no live-routing regression test for the internal-record route's percent-encoded/colon-bearing id

**Issue:** `tests/routes/live-routing.test.ts`'s "colon-bearing ids decode correctly" suite (this project's own recorded regression suite for the colon-bearing-id 404 bug class) covered `bulk-accept`, `disposition`, and `signoff`, but not `internal-record` — the one route this phase added that performs the identical `decodeURIComponent(rawId)` step for the same reason. Nothing in the suite would have caught a regression in this route's own decode step.

**Fix:** Added a case driving a percent-encoded assessment id through disposition, signoff, and internal-record in sequence, asserting the final `GET` returns 200 with the PDF content type rather than a 404/500.

**Commit:** `8b84735`

---

## Final Verified State

4 of 6 findings resolved this pass (the Critical and all 3 Warnings); the 2 Info findings remain open by explicit scope decision, not oversight.

| Finding | Severity | Status | Commit |
|---------|----------|--------|--------|
| CR-01 | Critical | Fixed | `bdadc1c` |
| WR-01 | Warning | Fixed | `aefdd70` |
| WR-02 | Warning | Fixed | `2848660` |
| WR-03 | Warning | Fixed | `8b84735` |
| IN-01 | Info | Deferred (out of scope this pass) | — |
| IN-02 | Info | Deferred (out of scope this pass) | — |

**Test suite:** 1058/1058 at baseline (start of this pass) → 1066/1066 after all fixes (8 new tests: 2 for CR-01, 3 for WR-01, 2 for WR-02, 1 for WR-03). `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, and `pnpm run depcruise` all clean after the final commit.

---

_Reviewed: 2026-09-22_
_Fixes applied by: Claude (gsd-code-fixer), verified against the full test/typecheck/lint/depcruise suite_
