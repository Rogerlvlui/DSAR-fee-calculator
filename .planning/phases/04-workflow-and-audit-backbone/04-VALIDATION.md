---
phase: "04"
slug: "workflow-and-audit-backbone"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-19"
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm vitest run --project engine` / `--project routes` (new `packages/workflow`/`packages/audit` tests land under whichever project's `include` glob covers them — likely a new project entry, TBD by the planner) |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10s (current baseline, 612 tests) |

---

## Sampling Rate

- **After every task commit:** Run the relevant project filter, scoped by `-t` to the feature name
- **After every plan wave:** Run `pnpm test` (full monorepo suite — this phase specifically retrofits Phase 3.1's call sites, so a full-suite regression check after each swap is load-bearing, not optional)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Populated by the planner as tasks are authored.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | STATE-02/03/05, BOUND-05, AUDIT-01/03/04 | TBD | TBD | TBD | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/workflow/` scaffold (new pure package, guard table + transition executor)
- [ ] `packages/audit/` scaffold (new package, AuditEvent writer interface + in-memory implementation + PackLifecycleEventWriter)
- [ ] New Vitest project entries in `vitest.config.ts` for the two new packages (unless the planner routes their tests through an existing project)
- [ ] `.dependency-cruiser.cjs` rules for the new packages' purity (no I/O in the guard table itself, matching `packages/engine`'s existing discipline)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| STATE-04 (DB-level immutability of a SIGNED_OFF write) | STATE-04 | Requires a live Postgres constraint/trigger; this build machine has no Docker installed. Explicitly deferred to Phase 3.2, not in this phase's scope at all. | N/A this phase — tracked in Phase 3.2 instead. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
