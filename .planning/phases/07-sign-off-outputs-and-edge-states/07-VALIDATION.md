---
phase: "07"
slug: "sign-off-outputs-and-edge-states"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-20"
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0, `test.projects` field, single root `vitest.config.ts` |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `pnpm vitest run --project routes` (or the relevant project — `documents` once added) |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30-60 seconds (matches prior-phase STATE.md entries) |

---

## Sampling Rate

- **After every task commit:** Run the relevant project's quick run (`pnpm vitest run --project routes`, `--project documents`, etc.)
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-TBD | TBD | 0 | SIGNOFF-01 | V4 | 409 + named pending lines on sign-off while a line is PENDING | route | `pnpm vitest run --project routes -t SIGNOFF` | ✅ (test exists, assertion needs 400→409 correction) | ⬜ pending |
| 07-TBD | TBD | 0 | SIGNOFF-02 | V4 | flags-acknowledgement precondition blocks sign-off | route | `pnpm vitest run --project routes -t SIGNOFF` | ✅ (exists, status code TBD per Open Question 1) | ⬜ pending |
| 07-TBD | TBD | 0 | PACK-08 | V4 | activator of a pinned pack version is blocked from signing off that same matter | route + synthetic `PackLifecycleEvent` fixture | `pnpm vitest run --project routes -t PACK-08` (new) | ❌ W0 | ⬜ pending |
| 07-TBD | TBD | 0 | DOC-01, DOC-05 | V4/V5 | internal record PDF: field-completeness, footer on every page, pagination | unit + smoke + route integration | `pnpm vitest run --project documents` (new) | ❌ W0 | ⬜ pending |
| 07-TBD | TBD | 0 | DOC-03 | V5 | notice draft contains no rule ID/citation/basis string/AI mention (AC-17 regex) | unit | `pnpm vitest run --project web -t notice-draft` (new) | ❌ W0 | ⬜ pending |
| 07-TBD | TBD | 0 | DOC-04 | — | zero-allowable outcome produces valid "no fee charged" notice through full route stack | route | `pnpm vitest run --project routes -t zero-fee` (new) | ❌ W0 | ⬜ pending |
| 07-TBD | TBD | 0 | ACCESS-05 | V4 | PDF trigger absent from every `/hr/*` route; PDF route refuses `HR_PREPARER` | route role-matrix + DOM denylist scan | `pnpm vitest run --project routes -t ACCESS-05` (new) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs, plan numbers, and waves are TBD until the planner assigns them — the plan-checker verifies this table is reconciled against the actual PLAN.md task IDs before sign-off.*

---

## Wave 0 Requirements

- [ ] `packages/documents/` — the entire package (new), including its own `vitest.config.ts` project entry and the `.tsx` JSX transform override the `web`/`routes`/`boundary` projects already carry
- [ ] `tests/routes/pack-lifecycle-signoff.test.ts` (or extend `signoff.test.ts`) — PACK-08 stub
- [ ] `apps/web/src/domain/notice-draft.test.ts` — DOC-03's AC-17 regex assertion (confirm it genuinely doesn't exist yet before creating it)
- [ ] Root `tsconfig.json`'s `references` array — needs `{ "path": "./packages/documents" }` added
- [ ] No new `.dependency-cruiser.cjs` purity rule required — the forbidden-target lists already anticipate `packages/documents`; confirm no NEW rule needed for `packages/documents` itself (it legitimately needs Buffer/Stream I/O from `@react-pdf/renderer`, unlike `engine`/`workflow`)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the researcher's per-task map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
