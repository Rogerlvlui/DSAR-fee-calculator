---
phase: "05"
slug: "hr-intake-and-disclosure-shell"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-20"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser localStorage → capability-statement acknowledgement state | The only persistence layer for DISC-01; a stale or malformed stored value must never crash the gate or silently grant access | `CAPABILITY_ACK_STORAGE_KEY` value |
| pack-authored `reviewedOn`/`reviewDueOn` → rendered strip | Dates the strip displays verbatim or derives a tri-state tone from; must never be mistaken for a legal conclusion about current authorisation | `StatusStrip` props |
| HR keyboard → description / identityVerifiedNote | The two fields most likely to accumulate personal data by habit; the pattern check is advisory friction against that habit, not an enforcement boundary | Free-text field values |
| committed pack files → the resolved per-jurisdiction status | Nine independent files; a missing or malformed one for any jurisdiction must degrade to the defensive "no usable pack" state, never crash the intake screen | `LoadableRulePack[]` |
| HR's jurisdiction selection → the pack posture that gates expense entry | The one control point deciding whether HR is allowed to spend time itemising a claim the pack already indicates cannot be charged | `MatterDetailsJurisdictionPack` |
| `/matters`'s ownership filter | The one place a preparer's own worklist could accidentally show another preparer's matter | `Matter.createdBy.id` vs `actor.user.id` |
| HR-facing status label | Must never let COMPUTING/LEGAL_REVIEW/INFO_REQUEST be distinguished from outside Legal, per AC-02/AC-04 | `MatterStatus` → collapsed label |
| intake form state → browser localStorage (autosave) | Client-local only; this mechanism never reaches the network and never reaches this codebase's audit log | `{matterDetails, attestations, lines}` |
| every rendered HR/disclosure component → the banned-word scan | The last line of defence before a legal-conclusion word could reach a real screen | Rendered plain text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | `capability-statement.tsx` localStorage read | low | mitigate | `Number.parseInt` on an arbitrary stored string can only produce `NaN` or a number strictly compared against `CAPABILITY_STATEMENT_VERSION`; every malformed/legacy value falls through to "not acknowledged" (12 tests, `capability-statement.test.tsx`) | closed |
| T-05-02 | Information Disclosure | `StatusStrip`'s Review-due cell | low | accept | Reports a date having passed in non-legal-conclusion phrasing, matching `stale.ts`'s own convention; asserts nothing about what is or is not permitted — now additionally proven by the DISC-03 render-and-scan gate (T-05-13) | closed |
| T-05-03 | Information Disclosure | free-text fields accumulating personal data | medium | mitigate | Length caps (`FREE_TEXT_LIMITS`, Phase 1) plus the live pattern warning (`detectLikelyPersonalData`) are two of the three independent, complementary layers PRD §12.1 describes; the third (field-name deny-list) already enforced (BOUND-02) | closed |
| T-05-04 | Denial of Service (of the intake workflow) | an overzealous pattern match blocking a legitimate entry | low | mitigate | `detectLikelyPersonalData` is warn-only by construction — no return channel a caller could use to gate submission; `grep -rn "detectLikelyPersonalData" apps/web/src/ui/intake/intake-form.tsx` confirms zero references in the submit-gating module | closed |
| T-05-05 | Tampering | the SG-only hardcoded fallback (removed this phase) | high | mitigate | Every jurisdiction now resolves against its own committed pack file via `resolveJurisdictionPackViews`, proven against a hand-built fixture missing one jurisdiction (defensive branch verified real, not assumed — `jurisdiction-packs.test.ts`) | closed |
| T-05-06 | Information Disclosure | jurisdiction pack status shown to HR | low | accept | The five display-status strings describe pack authoring/review state only; proven zero-banned-word by the DISC-03 gate (T-05-13), which renders `MatterDetailsFields` across all five states | closed |
| T-05-07 | Denial of Service (of the intake workflow) | expense entry withheld incorrectly for a usable jurisdiction | medium | mitigate | `canOfferExpenseEntry` is a single exported predicate with dedicated test coverage across all five display states plus both heads-up postures (`matter-details-fields.test.tsx`, `intake-form.test.tsx`) | closed |
| T-05-08 | Information Disclosure | `listMattersForPreparer`'s ownership filter | medium | mitigate | `requireRole` as the first statement; `createdBy.id` filter proven against two distinct hand-constructed actors (`list-matters-for-preparer.test.ts`), not the single seeded identity alone | closed |
| T-05-09 | Information Disclosure | the collapsed HR status label | medium | mitigate | `matterStatusLabelForHr` is an exhaustive, no-default `Record` lookup — a new `MatterStatus` value is a compile error here before it can silently leak an in-flight status (`hr-matter-status-label.test.ts`) | closed |
| T-05-10 | Information Disclosure | `/matters` reading assessment data | low | mitigate | The page imports nothing from `assessments.ts`; `grep -n "assessment\b" apps/web/app/(hr)/matters/page.tsx` confirms zero references | closed |
| T-05-11 | Information Disclosure | draft data written to localStorage | low | accept | The draft already exists in the same browser tab's memory as visible form state; writing it to localStorage on the same origin adds no new exposure this prototype's threat model treats as material, and no server-side channel is created | closed (accepted) |
| T-05-12 | Denial of Service (of the save-state signal) | a storage write failure going unreported | low | mitigate | `writeDraftToStorage`'s try/catch surfaces failure as the hook's `"error"` status rather than swallowing it; `AutosaveIndicator` renders a distinct, visible sentence for that state (`use-draft-autosave.test.ts`, `autosave-indicator.test.tsx`) | closed |
| T-05-13 | Spoofing (of compliance) | any rendered HR/disclosure string | high | mitigate | The render-and-scan gate (`tests/boundary/ui-banned-words.test.ts`) covers every component this phase touched or added, proven non-vacuous by a >=500-character floor and a canary shown, during this pipeline's own verification, to catch a real, temporarily-injected violation in a production component (reverted before commit) | closed |
| T-05-SC (×6) | Tampering | npm/pip/cargo installs | low | accept | No external package installed across any of the six plans in this phase — only first-party workspace packages and Node/React built-ins (`ulid`/`next`/`react` already present from prior phases) | closed (accepted) |

---

## Notes on this phase's own review-pipeline findings

The code review pass (`05-REVIEW.md`) found one Warning-level code-quality issue (a fragile string-split reconstruction in `matter-rail.tsx`, fixed inline, commit `0d8afbc`) — it was a maintainability defect, not a security-relevant one, and does not correspond to any threat register entry above.

The DISC-03 banned-word gate's own construction (`tests/boundary/ui-banned-words.test.ts`) surfaced a real, pre-existing finding during this phase — `headsUpMessage()`'s PRD §10.2-verbatim text legitimately contains the word "legal" in a non-conclusion sense. This was resolved by correctly scoping the gate to DISC-03's own literal definition (engine-derived strings only) rather than either weakening the scanner's real detections or altering PRD-locked copy to chase a broader-than-required goal. Documented as a dedicated, passing test (`ui-banned-words.test.ts`'s "headsUpMessage — a documented, out-of-scope exception" block) rather than a silently dropped case.

## Verification method

`gsd-tools.cjs` (and therefore the `gsd-security-auditor` subagent dispatch) is unavailable in this worktree — the same recurring gap documented for every prior phase (03-03 onward). This threat register was assembled and verified manually: cross-referencing each of the six plans' own `<threat_model>` STRIDE registers against the actual, final committed code and test suite (not the plan's claims alone), re-running the specific test files named as each mitigation's evidence, and confirming via `grep` the acceptance-criteria assertions each plan's own `<acceptance_criteria>` block specified (e.g., no `detectLikelyPersonalData` reference in `intake-form.tsx`, no `assessment` reference in `apps/web/app/(hr)/matters/page.tsx`). All 13 phase-specific threats plus the 6 supply-chain entries are closed; 0 open.

---

_Reviewed: 2026-09-20_
_Reviewer: Claude (manual review — gsd-tools.cjs / gsd-security-auditor subagent dispatch unavailable in this worktree)_
_ASVS Level: 1 (prototype, matching Phase 04's own recorded level)_
