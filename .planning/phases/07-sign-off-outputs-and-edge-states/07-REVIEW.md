---
phase: 07-sign-off-outputs-and-edge-states
reviewed: 2026-09-22T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - apps/web/AGENTS.md
  - apps/web/CLAUDE.md
  - apps/web/app/api/assessments/[id]/internal-record/route.ts
  - apps/web/app/legal/assessments/[id]/page.tsx
  - apps/web/next-env.d.ts
  - apps/web/next.config.ts
  - apps/web/package.json
  - apps/web/src/domain/notice-draft.test.tsx
  - apps/web/src/domain/notice-draft.ts
  - apps/web/src/domain/stale-pack-notice.test.ts
  - apps/web/src/domain/stale-pack-notice.ts
  - apps/web/src/server/data/assessments.ts
  - apps/web/src/ui/hr/notice-block.test.tsx
  - apps/web/src/ui/hr/notice-block.tsx
  - apps/web/src/ui/hr/result-view.test.tsx
  - apps/web/src/ui/review/assessment-view.test.tsx
  - apps/web/src/ui/review/assessment-view.tsx
  - apps/web/src/ui/review/internal-record-download.test.tsx
  - apps/web/src/ui/review/internal-record-download.tsx
  - apps/web/src/ui/review/stale-pack-notice.test.tsx
  - apps/web/src/ui/review/stale-pack-notice.tsx
  - package.json
  - packages/documents/package.json
  - packages/documents/src/internal-record-document.test.tsx
  - packages/documents/src/internal-record-document.tsx
  - packages/documents/src/internal-record-view.test.ts
  - packages/documents/src/internal-record-view.ts
  - packages/documents/tsconfig.json
  - scripts/smoke-internal-record.mjs
  - tests/boundary/hr-internal-record-absent.test.ts
  - tests/routes/audit-trail.test.ts
  - tests/routes/edge-state-table.test.ts
  - tests/routes/internal-record.test.ts
  - tests/routes/live-routing.test.ts
  - tests/routes/notice-outputs.test.ts
  - tests/routes/pack-lifecycle-signoff.test.ts
  - tests/routes/signoff.test.ts
  - tests/tsconfig.json
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-09-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Reviewed the sign-off gate, the internal-record PDF pipeline (route, pure view, PDF renderer), the HR notice draft/notice-block, the stale-pack notice, and the associated route/unit tests for Phase 07. The authorization posture is strong and consistent with the rest of the codebase: every new data-layer function (`getAssessmentForLegalReview`, `getMatterForLegalReview`, `getExpenseLinesForLegalReview`) calls `requireRole()` first, the internal-record route refuses with 409 before building anything when `assessment.signOff` is null (PRD §0 non-negotiable #3), and `tests/boundary/hr-internal-record-absent.test.ts` proves — by reachability scan, payload scan, and a non-vacuity canary — that no HR-reachable surface offers the download trigger or leaks a lawyer's own rationale (ACCESS-05). The sign-off gate's refusal ordering (pending lines → unacknowledged flags → unknown flags → attestation → qualification → same-actor pack-activation block → structural guard) is unchanged in a way that writes nothing on any refusal, matching the codebase's established discipline.

Two classes of defect were found in the code that is new this phase, both in the internal-record PDF path: an HTTP response-header injection opportunity via an unsanitized HR-supplied field reaching `Content-Disposition` unescaped (CR-01), and a silent text-corruption bug in the PDF footer's placeholder substitution triggered by certain lawyer-typed `qualification` values (WR-01), compounded by `qualification` being the one sign-off free-text field with no length cap at all (WR-02). A test-coverage gap specific to this project's own recorded history of percent-encoding bugs is also called out (WR-03).

## Critical Issues

### CR-01: Content-Disposition header built from an unescaped, unbounded HR-controlled field — filename/parameter injection

**File:** `apps/web/app/api/assessments/[id]/internal-record/route.ts:90`
**Issue:** The internal-record route sets:
```ts
"content-disposition": `attachment; filename="${matter.reference}-internal-record.pdf"`,
```
`matter.reference` is `z.string()` with no length limit and no character restriction (`packages/schemas/src/matter.ts:28`), and `POST /api/matters` (`apps/web/app/api/matters/route.ts`) casts the request body directly to `CreateMatterInput` with no route-level validation before it reaches `createMatter()`'s `MatterSchema.parse()` — so any `HR_PREPARER` can set `reference` to an arbitrary string, including a double quote.

A `reference` value containing `"` breaks out of the quoted `filename` parameter and lets an attacker append arbitrary `Content-Disposition` parameters — verified directly:
```
node -e "const h = new Headers(); h.set('content-disposition', 'attachment; filename=\"weird\\\"; filename*=UTF-8\\'\\'evil.pdf\"'); console.log(h.get('content-disposition'))"
→ attachment; filename="weird"; filename*=UTF-8''evil.pdf"
```
The runtime's `Headers` implementation blocks literal CR/LF (so full HTTP response splitting is not reachable), but the quote-breakout still lets a lower-privileged `HR_PREPARER` control the `filename*` (RFC 5987) parameter a `LEGAL_REVIEWER`'s browser will prefer when saving this evidentiary PDF — i.e. an HR actor can make a legal reviewer's browser save the internal fee-assessment record under an attacker-chosen filename. For a product whose entire value proposition is a defensible audit trail, a cross-role-trust-boundary manipulation of the record's own filename is a real defect, not merely cosmetic.

**Fix:** Sanitize/encode `matter.reference` before it is interpolated into the header value — at minimum strip `"`, `;`, and control characters, or (better) use the standard RFC 6266 pattern of a plain ASCII fallback `filename` plus a percent-encoded `filename*`:
```ts
const safeReference = matter.reference.replace(/[^A-Za-z0-9._-]/g, "_");
const encodedReference = encodeURIComponent(matter.reference);
headers: {
  "content-type": "application/pdf",
  "content-disposition":
    `attachment; filename="${safeReference}-internal-record.pdf"; ` +
    `filename*=UTF-8''${encodedReference}-internal-record.pdf`,
}
```
Consider also adding a length/charset constraint to `Matter.reference` in `packages/schemas/src/matter.ts` (it currently has none), since this is the first place in the codebase that embeds it unescaped into an HTTP header.

## Warnings

### WR-01: `String.prototype.replace` with a lawyer-typed value silently corrupts the internal-record footer

**File:** `packages/documents/src/internal-record-view.ts:62-69` (`renderInternalRecordFooter`)
**Issue:**
```ts
export function renderInternalRecordFooter(footer: InternalRecordFooter): string {
  return INTERNAL_RECORD_FOOTER_TEMPLATE.replace("{packId}", footer.packId)
    .replace("{packVersion}", footer.packVersion)
    .replace("{engineVersion}", footer.engineVersion)
    .replace("{lawyerName}", footer.lawyerName)
    .replace("{qualification}", footer.qualification)
    .replace("{date}", footer.date);
}
```
`String.prototype.replace`'s special replacement patterns (`$&`, `` $` ``, `$'`, `$$`, `$<name>`) are interpreted in the **replacement** argument even when the **search** argument is a plain string, not a RegExp. `footer.qualification` is the lawyer's own free-text input at sign-off time (`SignOffInput.qualification`, `apps/web/src/server/data/assessments.ts`), so a qualification value containing e.g. `$&` or `$$` will silently substitute the matched placeholder text or a literal `$` into the rendered footer — verified directly:
```
node -e "console.log('Prepared {qualification} end'.replace('{qualification}', 'Advocate & Solicitor \$& test'))"
→ Prepared Advocate & Solicitor {qualification} test end
```
This corrupts the disclosure footer of the internal (evidentiary) PDF record with no error raised anywhere — the exact class of silent-defect this product's audit-defensibility premise cannot tolerate.

**Fix:** Escape `$` in every interpolated value before substitution, or avoid `String.replace`'s magic-pattern semantics entirely by using a function replacer or manual `split("{x}").join(value)`:
```ts
function escapeReplacement(value: string): string {
  return value.replace(/\$/g, "$$$$");
}
// ...
.replace("{qualification}", escapeReplacement(footer.qualification))
```

### WR-02: `SignOff.qualification` is the only sign-off free-text field with no length cap

**File:** `apps/web/src/server/data/assessments.ts:461-464` (`signOff`); `packages/schemas/src/constants.ts:28-33` (`FREE_TEXT_LIMITS`)
**Issue:** `FREE_TEXT_LIMITS` caps `description` (300), `hrNote` (500), `identityVerifiedNote` (200) and `lawyerReason` (1000), and `assertSufficientReason()` enforces the `lawyerReason` cap. `signOff()`'s own qualification check is:
```ts
const qualification = input.qualification.trim();
if (qualification.length === 0) {
  throw new ValidationError("Qualification is required before sign-off");
}
```
— no upper bound at all, and none exists in `packages/schemas/schema/assessment.schema.json`'s `qualification` field either (`"type": "string"`, no `maxLength`). Combined with WR-01, an arbitrarily long or `$`-bearing qualification string flows unbounded into the sign-off record, the audit log, and the internal-record PDF footer.
**Fix:** Add a `qualification` entry to `FREE_TEXT_LIMITS` (e.g. 200 characters, matching a realistic professional-qualification string) and enforce it in `signOff()` alongside the existing empty-string check, the same way `assertSufficientReason` enforces `FREE_TEXT_LIMITS.lawyerReason`.

### WR-03: No live-routing regression test for the internal-record route's percent-encoded/colon-bearing id

**File:** `tests/routes/live-routing.test.ts`; `apps/web/app/api/assessments/[id]/internal-record/route.ts:43-44`
**Issue:** This project's own recorded history (documented in the internal-record route's own header comment, and the basis for `tests/routes/live-routing.test.ts` existing at all) is that a colon-bearing assessment id 404s under Next's real router unless the route handler does `decodeURIComponent(rawId)` — a bug class this phase's task explicitly calls out as previously caught only by post-hoc review, not self-review. The internal-record route does perform `decodeURIComponent(rawId)` and its own header comment says it "copies the sign-off route's control flow" for exactly this reason — but `live-routing.test.ts`'s "colon-bearing ids decode correctly" suite covers `bulk-accept`, `disposition`, and `signoff` only; it has no case driving a percent-encoded id through the internal-record route. Every assertion in `tests/routes/internal-record.test.ts` passes the raw (unencoded) id directly to the handler, the same way most other route tests deliberately do — so nothing in the test suite would catch a regression in this route's own decode step the way `live-routing.test.ts` catches it for the three other routes.
**Fix:** Add one case to `tests/routes/live-routing.test.ts`'s "colon-bearing ids decode correctly" block driving a percent-encoded assessment id through the internal-record route (expect 200/PDF, or at minimum not-404), mirroring the existing bulk-accept/disposition/signoff cases.

## Info

### IN-01: `packages/documents` declares an unused `@dsar/engine` dependency

**File:** `packages/documents/package.json:12`
**Issue:** `packages/documents/package.json` lists `"@dsar/engine": "workspace:*"` as a dependency, but nothing under `packages/documents/src` imports `@dsar/engine` (confirmed by search — zero matches). `packages/documents` is designed as a "pure module + thin renderer" consuming only the already-computed `InternalRecordView` (per `internal-record-view.ts`'s own header note that it depends on nothing but `@dsar/schemas`); the unused manifest entry is dead weight that could mask a future, real purity violation being added without anyone noticing the dependency was already "allowed."
**Fix:** Remove the unused `@dsar/engine` entry from `packages/documents/package.json`.

### IN-02: Test helper in `notice-outputs.test.ts` diverges from production's disposition-aware amount derivation

**File:** `tests/routes/notice-outputs.test.ts:256-261` (`buildRealNoticeForMatter`)
**Issue:** The production HR page (`apps/web/app/hr/matters/[id]/page.tsx`) derives each allowed line's notice amount from the disposition-aware `ResultViewLine.amount` (`engineAmount` for `ACCEPTED`, `lawyerAmount` for `REDUCED`/`ALLOWED_BY_LAWYER`, `0` for `STRUCK`). The test helper instead uses `line.engineAmount` directly for every non-struck line:
```ts
const allowedLinesForNotice = assessment.lines
  .filter((line) => line.disposition !== "STRUCK")
  .map((line) => ({ description: expenseLine?.description ?? "", amount: line.engineAmount }));
```
Every scenario this file exercises only ever uses `ACCEPT`/`STRIKE`, so the divergence is currently unobservable — but the helper would silently validate the wrong amount if a future test in this file exercised a `REDUCE` or `ALLOW_WITH_AMOUNT`/`ALLOW_ANYWAY` disposition.
**Fix:** Derive `amount` the same disposition-aware way the production page does (or import/reuse the page's own derivation logic) so the helper cannot drift from what HR actually receives.

---

_Reviewed: 2026-09-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
