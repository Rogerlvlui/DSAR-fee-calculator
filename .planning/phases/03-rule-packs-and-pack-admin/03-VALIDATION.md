---
phase: "03"
slug: "rule-packs-and-pack-admin"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-16"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0 (workspace `projects` field in root `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (root) — needs a new `rulepacks` project entry; Wave 0 adds it |
| **Quick run command** | `pnpm vitest run --project rulepacks` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds (quick) — pure file reads + zod parsing, no Docker, no network |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --project rulepacks`
- **After every plan wave:** Run `pnpm test && pnpm run typecheck && pnpm run lint && pnpm run depcruise`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PACK-01 | — | Malformed pack JSON fails to load at build time, not runtime | unit | `pnpm vitest run --project rulepacks -t "PACK-01"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-02 | — | ACTIVE pack missing any of the 21 category rules fails validation | unit | `pnpm vitest run --project rulepacks -t "PACK-02"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-03 | — | ACTIVE pack missing `reviewedBy`/`reviewedOn`/`reviewDueOn` fails validation | unit | `pnpm vitest run --project rulepacks -t "PACK-03"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-04 | — | Pack past `reviewDueOn` is STALE — derived from the date, never trusted from a stored status literal | unit | `pnpm vitest run --project rulepacks -t "PACK-04"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-05 | — | Loader resolves a pack by id + version deterministically | unit | `pnpm vitest run --project rulepacks -t "PACK-05"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-06 | T-03-01 | An ACTIVE version's content cannot be rewritten — refused at the database, not by service-layer discipline | integration | `pnpm vitest run --project rulepacks -t "PACK-06"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-07 | T-03-02 | Activation writes a `PACK_ACTIVATED` audit event naming the actor | integration | `pnpm vitest run --project rulepacks -t "PACK-07"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-09 | — | HK-PDPO and SG-PDPA parse, and their 21 authored categories match PRD §7.5/§7.6 | golden-file | `pnpm vitest run --project rulepacks -t "HK-PDPO"` · `-t "SG-PDPA"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-10 | — | Seven stub packs load as DRAFT with every category rule `FLAG` and every rule `NEEDS_VERIFICATION` | unit | `pnpm vitest run --project rulepacks -t "PACK-10"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-11 | — | No pack-authored `basis` string contains a banned word (reuses the engine's `LEGAL_CONCLUSION_BANNED_WORDS` matcher) | unit | `pnpm vitest run --project rulepacks -t "PACK-11"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PACK-12 | — | HK's flat-fee extension is populated and the other eight packs' JSON is unchanged by the extension | unit | `pnpm vitest run --project rulepacks -t "PACK-12"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are filled in by the planner; the requirement → command mapping above is the binding contract.*

---

## Wave 0 Requirements

- [ ] `packages/rulepacks/package.json` + `tsconfig.json` — new package scaffold, mirroring `packages/schemas`
- [ ] `vitest.config.ts` (root) — new `rulepacks` project entry
- [ ] `tsconfig.json` (root) — new `{ "path": "./packages/rulepacks" }` project reference
- [ ] `packages/rulepacks/src/loader.test.ts` — stubs for PACK-01, PACK-02, PACK-03, PACK-05
- [ ] `packages/rulepacks/src/validate.test.ts` — stubs for PACK-11
- [ ] `packages/rulepacks/src/stale.test.ts` — stubs for PACK-04
- [ ] `packages/rulepacks/src/packs.test.ts` — stubs for PACK-09, PACK-10, PACK-12
- [ ] `packages/rulepacks/tests/fixtures/` — one violating fixture per validator gate (malformed JSON, missing category, missing `reviewedBy`, banned-word `basis`)
- [ ] `packages/engine/package.json` — additive `exports` entry for `calendar-math`, if the staleness-reuse recommendation is accepted

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HK-PDPO / SG-PDPA category content is legally correct | PACK-09 | Correctness of authored legal content is a qualified lawyer's judgement, not a machine-checkable property. The automated tests prove the packs *parse*, are *complete* and are *free of banned words* — they cannot prove the rules are right. | Named counsel reviews all 21 categories per pack against PRD §7.5/§7.6, then records `reviewedBy`/`reviewedOn`/`reviewDueOn` in the pack. |
| `/admin/rulepacks` live validation, 21/21 checklist, version diff, activation gate | PACK-06, PACK-07 | UI interaction against the Annex A mockup's structure. Verified in-browser once `apps/web` exists. | Load `/admin/rulepacks` as a `RULEPACK_AUTHOR`, edit a draft, confirm live validation and the 21/21 counter, view the diff, attempt activation without reviewer identity (must be refused), then activate with it and confirm the audit event. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
