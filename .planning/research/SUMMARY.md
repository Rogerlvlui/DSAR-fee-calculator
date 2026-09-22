# Research Summary: DSAR Fee Assessment Agent

**Project:** DSAR Fee Assessment Agent
**Domain:** Legal-tech deterministic engine + LLM-boundary web app
**Researched:** 2026-09-13
**Confidence:** MEDIUM overall

---

## Executive Summary

This is a spec-first, defensibility-focused legal workflow tool. HR itemises costs, deterministic engine applies versioned lawyer-authored rule pack, named lawyer reviews line-by-line before sign-off.

**Recommended approach:** TypeScript/Next.js/Postgres with strict package boundaries. Engine is pure (no I/O, network, LLM). LLM boundary is narrow (category suggestion only). Everything auditable and immutable.

**Key risks:** (1) non-determinism in engine via locale calls, (2) RSC payload leaks of unreviewed data, (3) zero-decimal currency bug corrupting by 100x, (4) rule-pack mutation after reference. All preventable with explicit discipline.

---

## Key Findings

### Stack

TypeScript 5.9, Next.js 16.3, Postgres 17/18, Prisma 7, zod 4, pnpm 12, Vitest 5, dependency-cruiser.

**Core patterns:** Branded Minor type, two Postgres roles (dsar_migrator, dsar_runtime), Data Access Layer with role-scoped Prisma select, dependency-cruiser config.

### Features

**Table stakes:** Reviewer queue, HR inbox, matter timeline, draft persistence.
**Defer:** Search/filter, self-monitoring view, metadata-only clone.
**Anti-features:** Confidence scores, leaderboards, open-ended AI chat.

### Architecture - CRITICAL FINDING

**Build order is NOT strictly sequential.** The PRD's five-step order is safe but not optimal. True dependency graph has TWO hard serialization points:

**Point 1: Schemas Core Types** (Nothing below compiles without this)
- MatterStatus, Matter, ExpenseLine, RulePack, Assessment, AssessmentLine
- JURISDICTION_CURRENCY + MINOR_UNIT_DECIMALS map (Pitfall 1 prevention)
- State machine types and guard predicates
- Shared formatters: toMinorUnits, toMajorUnits, formatMoney (currency-decimal-aware)

**Parallel Band: Six Independent Workstreams (zero ordering between them)**
- Engine (vs fixtures) + AC-07 tests
- Rulepack loader/validator
- HK/SG pack authoring (legal, critical path by schedule not code)
- Workflow state machine + transitions
- Audit package with GRANT/REVOKE
- Documents package + HR intake

**Point 2: Engine Code + Real Packs Converge** (AC-09 golden-file tests)

**Then: Legal-review screen** (needs both engine and packs)
**Finally: LLM Job 1 only** (last per PRD)

### Critical Pitfalls

1. **Zero-decimal currency** - 100x corruption if hardcoded division. Define MINOR_UNIT_DECIMALS in Phase 1. Test all 9 currencies immediately.

2. **Aggregate-cap residue** - PRD doesn't specify leftover minor units allocation when cap doesn't divide evenly. Requires product-owner decision before coding.

3. **Non-determinism in tests** - Locale calls or clock reads pass CI but fail locally. Run tests in >=2 TZ/LANG combos.

4. **RSC/caching leak** - RSC payloads carry full objects regardless of render. Role-gate Prisma select; explicit cache: no-store.

5. **Automation-bias UI-only** - AC-23/AC-25/AC-26 need server-side tests calling endpoints directly.

6. **Pack mutation after reference** - In-place UPDATE retroactively rewrites history. Immutability at DB level once referenced.

---

## Roadmap Implications

### Phase 1: Schemas Core Types
Freezes all core data model types, MINOR_UNIT_DECIMALS, shared formatters, state machine guards, Postgres DDL.

### Parallel Workstreams
Six independent teams work simultaneously after Phase 1: engine, rulepack tools, legal authoring, workflow, audit, documents+intake.

### Gate 2: Engine + Packs Converge
AC-09 golden-file tests pass.

### Phase 3: Legal-Review Screen
Review card, queue, admin shell, automation-bias enforcement. Cannot build before both engine and packs exist.

### Phase 4: LLM Job 1
Category suggestion (last per PRD for product risk management).

---

## Confidence Assessment

**Overall: MEDIUM** - Approach sound, risks clear. Not higher because versions shift and two key decisions (residue, immutability) need product-owner input.

**Sources:** PRD (HIGH), vendor docs (HIGH), web research (MEDIUM-LOW).

*Research completed: 2026-09-13*
*Ready for roadmap: yes*
