---
phase: "1"
slug: "schemas-freeze-and-walking-skeleton"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-14"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.0 — plus ESLint (flat config), `tsc --noEmit`, and `dependency-cruiser` as separate CI gates that Vitest does not subsume |
| **Config file** | `vitest.config.ts` at the repo root, using `test.projects` — none — Wave 0 installs. Confirm the field name (`test.projects` vs a separate `vitest.workspace.ts`) against the installed Vitest 5 docs at scaffold time; this surface has moved between minors |
| **Quick run command** | `pnpm vitest run --project schemas` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30s for the unit/property projects; the Testcontainers DB project adds ~60–90s for first container pull |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --project schemas` (or the project matching the task's package)
- **After every plan wave:** Run `pnpm vitest run`, plus `pnpm eslint .` and `pnpm depcruise packages/engine packages/schemas`
- **Before `/gsd-verify-work`:** Full suite green, `pnpm tsc --noEmit` clean across all packages, and the Testcontainers AUDIT-02 test green
- **Max feedback latency:** 30 seconds for the quick command; 120 seconds for the full suite including the DB project

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed on requirement until plans exist. The planner must carry each row's automated command into the matching task's `<verify><automated>` block, each with a `<fails_when>` sibling.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SCHEMA-01 | — | N/A | unit | `pnpm vitest run --project schemas` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCHEMA-02 | T-1-MONEY | A money-named identifier cannot silently hold an unbranded `number` | lint | `pnpm eslint packages/engine packages/schemas` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCHEMA-03 | — | N/A | unit | `pnpm vitest run --project schemas money.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCHEMA-04 | T-1-CURRENCY | A matter cannot be created in a currency its jurisdiction does not designate | unit + integration | `pnpm vitest run --project schemas matter.test.ts` and `pnpm vitest run --project db` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCHEMA-05 | — | N/A | unit | `pnpm vitest run --project schemas json-schema.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCHEMA-06 | — | A guard cannot read an advisory deadline field | typecheck | `pnpm tsc --noEmit -p packages/schemas` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SCHEMA-07 | T-1-MONEY | No money field of a returned `Assessment` is non-integer under 10,000 random inputs | property | `pnpm vitest run --project schemas assessment.property.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STATE-01 | — | No status value outside the seven can be written | unit + integration | `pnpm vitest run --project schemas` and `pnpm vitest run --project db` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ACCESS-01 | T-1-AUTHZ | A wrong-role request is refused server-side with no domain data in the body | integration | `pnpm vitest run --project routes` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ACCESS-06 | T-1-AUTHZ | Guard behaviour is independent of the identity provider in use | typecheck + structural | `pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ACCESS-08 | T-1-AUTHZ | Every discovered route is asserted against every role, on bodies not only status codes | integration | `pnpm vitest run --project routes enumerate-routes.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BOUND-01 | T-1-PII | No route accepts a multipart body | integration | `pnpm vitest run --project boundary multipart-415.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BOUND-02 | T-1-PII | No persisted field and no rendered form input can name requestor personal data | integration + canary | `pnpm vitest run --project boundary prisma-field-denylist.test.ts dom-denylist.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUDIT-02 | T-1-AUDIT | An audit row cannot be altered or removed by the application role | integration (Testcontainers) | `pnpm vitest run --project db audit-role.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Nothing exists yet — this is a from-zero scaffold, so every item below is a genuine gap rather than a stale checklist.

- [ ] pnpm workspace + `package.json` + `tsconfig` base — **pin `typescript@6.0.3` exactly.** `typescript@latest` is now 7.0.2 (the Go-based compiler) and `typescript-eslint@8.70.0` declares `typescript: ">=4.8.4 <6.1.0"`, so TS 7 breaks the AC-07a lint rule. Re-run `npm view typescript-eslint peerDependencies` immediately before installing — the compatible ceiling may have moved again
- [ ] `prisma` / `@prisma/client` exact-pinned to `7.10.0` — **never a caret range.** `prisma@latest` currently resolves to the `8.0.0-rc.15` prerelease; the stable 7 line sits under the `prev` dist-tag
- [ ] `vitest.config.ts` with `test.projects` — node env for `packages/*`, jsdom/happy-dom for `apps/web`, a separate `db` project for the Testcontainers suite
- [ ] `.dependency-cruiser.cjs` forbidding `fs`/`net`/`http`/`fetch`/`@prisma/client`/LLM-SDK imports from `packages/engine`
- [ ] `eslint.config.js` flat config carrying the AC-07a money-branding rule, scoped to `packages/engine` and `packages/schemas` and explicitly excluding Prisma-generated output
- [ ] `tests/routes/route-registry.ts` + `enumerate-routes.test.ts` — the ACCESS-08 / BOUND-01 standing harness. It must fail when a route exists on disk but is absent from the registry, so routes added in Phases 3–8 are covered without editing the test
- [ ] `tests/boundary/dom-denylist.test.ts` — **must include a canary fixture.** Phase 1 has no forms, so a bare glob over form routes passes vacuously and would keep passing forever. The canary is a deliberately deny-list-violating fixture that the test must catch, proving the detector works before any real form exists
- [ ] `tests/boundary/prisma-field-denylist.test.ts` — reads field names via `@prisma/internals` `getDMMF()` against `schema.prisma`, **not** the generated client's `Prisma.dmmf`. Prisma 7's default Rust-free `prisma-client` generator simplifies the runtime DMMF and drops per-field metadata
- [ ] `tests/db/audit-role.test.ts` — Testcontainers harness proving `UPDATE`/`DELETE`/`TRUNCATE` on the audit table fails for `dsar_runtime` at the database

---

## Environment Blocker

**Docker is not available on this machine** — `docker` is not on PATH and Docker Desktop is not installed at its default location. Verified independently of the research agent.

This blocks, at execution time and not before:

- Every `--project db` row in the map above (SCHEMA-04's check constraint, STATE-01's Postgres enum, AUDIT-02 / AC-34)
- Success Criterion 5 of the phase in full
- The `pnpm prisma migrate` step, and therefore any task that depends on a generated client against a real database

There is no fallback: PROJECT.md excludes SQLite for every environment precisely because it cannot express the GRANT/REVOKE separation AC-34 requires, so degrading to SQLite would leave the criterion tested only in principle. Install Docker Desktop before executing Phase 1, or expect execution to stop at the first migration task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Replacing the stub identity provider changes no guard code | ACCESS-06 | "No guard depends on which provider is in use" is a structural property of the import graph, not a runtime behavior. `tsc` proves guards only consume `getSession()`'s return type; that the *swap itself* is a one-file change is confirmed by inspection | Substitute a second provider implementation behind the same `getSession()` signature; confirm `git diff` touches only the provider module and no file under the guard/data-access layer |
| Prisma shadow-database behaviour on a hand-authored `CREATE ROLE` migration | AUDIT-02 | Flagged LOW confidence / ASSUMED by research — reasoned, not empirically confirmed. Roles are cluster-scoped in Postgres while the shadow database is not, so a bare `CREATE ROLE` may collide on re-run | Once Docker is available, run `prisma migrate dev` twice against a clean cluster and observe whether the second run errors on role creation. If it does, guard with `DO $$ ... IF NOT EXISTS ... $$` and record the outcome |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] Docker confirmed available, or the `db` project rows explicitly accepted as unverified
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
