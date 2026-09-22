---
phase: "06"
slug: "convergence-and-legal-review"
status: planned
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-20"
populated: "2026-09-20"
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Written at plan time —
> every row below is `⬜ pending` until `/gsd-execute-phase 6` runs; `nyquist_compliant: true` here
> reflects the STRUCTURAL property (every task carries an `<automated>` verify with a `<fails_when>`
> sibling) checkable at plan time, not an execution result — the executor of the last plan (06-09)
> re-confirms every row reads green before flipping `status` to `executed`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm vitest run --project web --project routes --project boundary --project schemas --project rulepacks --project audit` (the six projects this phase's work touches) |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~12-15s (baseline 838/838 per STATE.md at Phase 6's start, plus this phase's new test files) |

---

## Sampling Rate

- **After every task commit:** Run the relevant project filter, scoped by `-t` to the feature tag named in that task's `<verify>` block
- **After every plan wave:** Run `pnpm test` — Wave 1 in particular lands Plan 06-01's pack-resolution generalization, which every later plan and every existing SG-focused test depends on; a full-suite check after Wave 1 is load-bearing, not optional
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 06-01 | 1 | ENGINE-14 (unlock) | T-06-01 | Pack resolution never silently falls back to another jurisdiction's pack | unit + regression | `pnpm vitest run --project web -t "JURISDICTION-PACKS"` · `pnpm test` | ✅ (extends existing files) | ⬜ pending |
| 06-01-T2 | 06-01 | 1 | ENGINE-14 | — | Golden files pass for real HK/SG content and are proven non-vacuous by a mutation test | unit (golden) | `pnpm vitest run --project rulepacks -t "REAL-PACK-GOLDEN"` | ❌ (new file) | ⬜ pending |
| 06-02-T1 | 06-02 | 1 | DISC-04 | T-06-03 | Verdict badge accessible name proven via `toHaveAccessibleName()`, not text content | unit | `pnpm vitest run --project web -t "LINE-CARD"` | ✅ (extends existing file) | ⬜ pending |
| 06-02-T2 | 06-02 | 1 | REVIEW-03 | — | Unverified marker and indented totals rows carry a real colour treatment | unit | `pnpm vitest run --project web -t "LINE-CARD"` · `-t "TOTALS-RAIL"` | ✅ (extends existing files) | ⬜ pending |
| 06-03-T1 | 06-03 | 1 | ACCESS-02, ACCESS-03 | T-06-04 | `GET /api/assessments/{id}` refuses HR_PREPARER with zero leaked body, regardless of matter status | route/integration (tracer) | `pnpm vitest run --project routes -t "ACCESS-CONTROL-REVIEW"` | ❌ (new route + test) | ⬜ pending |
| 06-03-T2 | 06-03 | 1 | ACCESS-07, REVIEW-06 | T-06-05, T-06-06 | No whole privileged object crosses a "use client" boundary; no total renders while any line is pending | unit (source-scan + render) | `pnpm vitest run --project boundary -t "RSC-PAYLOAD-LEAK"` | ❌ (new files) | ⬜ pending |
| 06-04-T1 | 06-04 | 2 | NAV-01 (path) | T-06-07 | Every moved page keeps its `getCurrentActor()`/`requireRole()` call — verified by diff, not assumed | regression (tracer) | `pnpm vitest run --project web -t "INTAKE-FORM"` · `pnpm run typecheck` | ✅ (moved files) | ⬜ pending |
| 06-04-T2 | 06-04 | 2 | NAV-01 (path) | T-06-08 | Stale hardcoded old-path links cannot survive the restructuring unnoticed | regression | `pnpm vitest run --project routes -t "hr-matters-list"` · `-t "LIVE-ROUTING"` · `pnpm test` | ✅ (extends existing files) | ⬜ pending |
| 06-05-T1 | 06-05 | 2 | REVIEW-05 | — | Stop-list is a whole-reason match, never a substring scan | unit (tdd) | `pnpm vitest run --project schemas -t "REASON-STOP-LIST"` · `pnpm vitest run --project web -t "disposition-actions"` | ❌ (new constant + functions) | ⬜ pending |
| 06-05-T2 | 06-05 | 2 | REVIEW-05 | T-06-09 | Server-side stop-list check is authoritative; a stock-phrase reason writes nothing | unit + route | `pnpm vitest run --project web -t "disposition-controls"` · `-t "bulk-accept-bar"` · `--project routes -t "DISPOSITION"` | ✅ (extends existing files) | ⬜ pending |
| 06-06-T1 | 06-06 | 3 | NAV-01 | — | Sort comparator never throws on an unresolvable deadline; falls back to age-ordering | unit (tdd) | `pnpm vitest run --project web -t "queue-sort"` · `--project routes -t "listReviewableMatters"` | ❌ (new domain module) | ⬜ pending |
| 06-06-T2 | 06-06 | 3 | NAV-01 | T-06-10 | Widened queue data read stays behind the same, unduplicated `requireRole` gate | route/integration | `pnpm vitest run --project routes -t "LEGAL-QUEUE"` · `pnpm test` | ❌ (new test, extends page) | ⬜ pending |
| 06-07-T1 | 06-07 | 3 | REVIEW-11 | T-06-12 | A flat-fee choice exceeding itemised cost is refused server-side, never trusted from the client | unit (tdd) + route | `pnpm vitest run --project schemas -t "Assessment"` · `--project routes -t "FEE-CHOICE"` | ❌ (new field, event type, route) | ⬜ pending |
| 06-07-T2 | 06-07 | 3 | REVIEW-11 | — | No `Assessment`/`AssessmentLine` object crosses the new component's "use client" boundary | unit | `pnpm vitest run --project web -t "FLAT-FEE-CHOICE"` · `-t "assessment-view"` | ❌ (new component) | ⬜ pending |
| 06-07-T3 | 06-07 | 3 | REVIEW-10 | T-06-13 | Recompute confirmation is structurally in-place, never a modal; the live gate is honestly false against every real single-version pack today | unit + route | `pnpm vitest run --project web -t "RECOMPUTE-CONFIRM"` · `--project routes -t "recompute"` | ❌ (new component) | ⬜ pending |
| 06-08-T1 | 06-08 | 4 | REVIEW-08, NAV-03 | — | Pure key-to-intent mapping ignores modifier keys; overlay is a real, focusable dialog | unit | `pnpm vitest run --project web -t "keyboard-shortcuts"` · `-t "SHORTCUT-HELP-OVERLAY"` | ❌ (new files) | ⬜ pending |
| 06-08-T2 | 06-08 | 4 | REVIEW-08 | T-06-14, T-06-15 | Keyboard listener never fires while typing in a text field; drives only the existing, already-gated disposition buttons | unit (tdd) | `pnpm vitest run --project web -t "review-keyboard-scope"` · `-t "LINE-CARD"` · `-t "assessment-view"` | ❌ (new component) | ⬜ pending |
| 06-08-T3 | 06-08 | 4 | NAV-03 | — | Queue keyboard nav reuses the SAME shared overlay; native anchor-Enter is relied on, never duplicated | unit (tdd) + route | `pnpm vitest run --project web -t "queue-keyboard-scope"` · `--project routes -t "LEGAL-QUEUE"` · `pnpm test` | ❌ (new component) | ⬜ pending |
| 06-09-T1 | 06-09 | 5 | REVIEW-01, REVIEW-02, REVIEW-04, REVIEW-12 | — | Already-built review-card behavior proven against a real, non-SG jurisdiction for the first time | route/integration | `pnpm vitest run --project routes -t "HK-JURISDICTION-REVIEW"` | ❌ (new test) | ⬜ pending |
| 06-09-T2 | 06-09 | 5 | REVIEW-07, REVIEW-09 | T-06-16 | Bulk-accept eligibility empty against both real packs for the correct, distinct, verified reason per pack | unit + full suite | `pnpm vitest run --project routes -t "BULK-ACCEPT-REAL-PACKS"` · `pnpm test` · `pnpm run lint` · `pnpm run typecheck` · `pnpm run depcruise` | ❌ (new test) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Phase not yet executed.** All 20 task rows across 9 plans are pending. No checkpoint tasks exist in this phase — every task is `autonomous: true` with at least one automated verify.

**Sampling continuity:** no 3 consecutive tasks lack an automated verify — every one of the 20 rows carries at least one `<automated>` command.

**Baseline caveat:** per prior-phase precedent (04-VALIDATION.md, 05-VALIDATION.md), two pre-existing failures are already known and excluded from every `pnpm test` gate in this phase's plans: a CPU-load-sensitive property-test timeout in `packages/engine/src/assess.property.test.ts`, and the line-ending drift failure in the schemas JSON-schema test (WINDOWS.md entry 1). Confirm this set is still current at the start of Plan 06-01 before treating any new `pnpm test` failure as this phase's own regression.

**A third, load-bearing regression check specific to this phase:** Plan 06-01's pack-resolution generalization touches the SG-only code path every prior phase's test suite was built against. The full suite must be run (not merely the filtered project) after Wave 1 lands, before any Wave 2 plan begins — a silent SG-specific regression here would surface as failures scattered across `web`, `routes` and `boundary` projects that a narrower filter would not catch together.

---

## Wave 0 Requirements

Wave 0 gaps concentrate in Plan 06-01 (this phase's own tracer/central-unlock plan) and Plan 06-03 (fully independent of 06-01, also Wave 1), rather than a single dedicated Wave 0 plan — Phase 6's net-new surface splits into independent concerns (pack resolution, access-control proofs, visual/accessibility fixes) with no single artifact all three depend on, matching Phase 5's own precedent for distributing Wave 0 across the first wave's independent plans.

- [ ] `packages/rulepacks/src/real-pack-fixture.golden.test.ts` — covers ENGINE-14/AC-09 against real HK+SG content (Plan 06-01 Task 2)
- [ ] `apps/web/app/api/assessments/[id]/route.ts` + `tests/routes/access-control-review.test.ts` — covers ACCESS-02/ACCESS-03/AC-01's literal route (Plan 06-03 Task 1, this phase's own tracer task)
- [ ] `tests/boundary/rsc-payload-leak.test.ts` + `tests/fixtures/rsc-payload-leak-canary.fixture.tsx` — covers ACCESS-07 (Plan 06-03 Task 2)
- [ ] `apps/web/src/domain/keyboard-shortcuts.ts` + test — covers REVIEW-08/NAV-03's pure mapping layer (Plan 06-08 Task 1)
- [ ] `tests/routes/legal-queue.test.ts` — covers NAV-01's full behavior (Plan 06-06 Task 2)
- [ ] `packages/schemas/src/constants.ts`'s `REASON_STOP_LIST` + test — covers REVIEW-05 (Plan 06-05 Task 1)
- Framework install: none — Vitest, zod, React and TypeScript are all already present; this phase adds no external dependency (confirmed in 06-RESEARCH.md's Package Legitimacy Audit: not applicable, no new packages proposed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| A live click-through of `/legal/queue`'s keyboard navigation, the shortcut help overlay, and the flat-fee choice/recompute-confirm banners in a real browser | REVIEW-08, REVIEW-10, REVIEW-11, NAV-03 | `pnpm dev`/`next build` remain unable to start on this build machine (WINDOWS.md entries 2-4, still open — a pre-existing, documented Tailwind v4 native-binary/Turbopack limitation, not a defect this phase introduces or can fix) | N/A this phase — verification relies on the route-handler and jsdom-component test suites (real `Request` objects through real handlers; real keydown events through real component trees), per the precedent Phases 04/05's own phase-goal verifications already used successfully |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify with a `<fails_when>` sibling — every one of the 20 tasks across all 9 plans carries at least one runnable command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — each gap above names the plan and task that closes it
- [x] No watch-mode flags — every command is `vitest run`, never bare `vitest`
- [x] Feedback latency < 30s — no new project or heavy fixture is introduced that would change this phase's baseline runtime materially
- [x] `nyquist_compliant: true` set in frontmatter — the structural property (every task automated) is true at plan time; execution-time greenness is the executor's job to confirm, not this document's at write time
- [ ] Every row above reads green — pending execution
- [ ] `wave_0_complete: true` — pending execution of Plan 06-01 Task 2 and Plan 06-03 Task 1, this phase's two independent Wave 0 anchors

**Approval:** planned, not yet executed — awaiting `/gsd-execute-phase 6`.
