---
gsd_state_version: "1.0"
current_phase: 03
current_phase_name: Rule Packs and Pack Admin
status: executing
stopped_at: Completed 03-04-PLAN.md
last_updated: "2026-09-17T22:14:00.000Z"
last_activity: 2026-09-17
last_activity_desc: Phase 03 plan 4 (PACK-04 staleness derivation, PACK-05 version pinning) completed
state_head: fa085d877e558b71a3516e4e1cd866fa884af0d9
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 21
  completed_plans: 17
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13)

**Core value:** A lawyer can defend the output by saying "the engine applied rule HK-PDPO.STAFF_TIME_REDACT_EXEMPT, version 2026.09.1, authored by X on date Y, and struck the line" — never "the model assessed the claim."
**Current focus:** Phase 03 — Rule Packs and Pack Admin

## Current Position

Phase: 03 (Rule Packs and Pack Admin) — EXECUTING
Plan: 5 of 5
Status: Ready to execute
Last activity: 2026-09-17 — Completed 03-04-PLAN.md (PACK-04 staleness derivation, PACK-05 version pinning)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 17
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 6 | - | - |
| 02 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 40min | 3 tasks | 15 files |
| Phase 01 P02 | 25min | 3 tasks | 10 files |
| Phase 01 P03 | 20min | 2 tasks | 13 files |
| Phase 01 P05 | 25min | 3 tasks | 6 files |
| Phase 01 P06 | 30min | 3 tasks | 4 files |
| Phase 01 P07 | 25min | 3 tasks | 17 files |
| Phase 02 P01 | 35min | 3 tasks | 12 files |
| Phase 02 P02 | 45min | 3 tasks | 6 files |
| Phase 02 P03 | 20min | 3 tasks | 6 files |
| Phase 02 P04 | 95min | 3 tasks | 14 files |
| Phase 02 P05 | 40min | 3 tasks | 11 files |
| Phase 02 P06 | 48min | 3 tasks | 9 files |
| Phase 02 P07 | 23min | 3 tasks | 8 files |
| Phase 03 P01 | 55min | 3 tasks | 20 files |
| Phase 03 P02 | 15min | 3 tasks | 9 files |
| Phase 03 P03 | 50min | 3 tasks | 8 files |
| Phase 03 P04 | 35min | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Horizontal layers, but Phase 1 carries a thin walking skeleton — Postgres two-role split, Prisma, a route per role area, one audit event — proving the layers connect before real logic lands. Explicitly throwaway-tolerant.
- [Roadmap]: Phase 1's `RulePack` freeze includes the HK flat-fee extension, so neither the engine (Phase 2) nor pack authoring (Phase 3) re-opens the schema. PROJECT.md wants the invasiveness of this change recorded.
- [Roadmap]: Phases 2–5 have zero ordering between them. PACK-09 (HK/SG authoring, legal work by the product owner) is the likely schedule long pole and starts first.
- [Roadmap]: Two hard gates — schemas freeze (before Phase 2) and engine-meets-real-packs (AC-09 golden files, opening Phase 6). Everything else is parallelisable.
- [Roadmap]: ACCESS-08 and BOUND-01/BOUND-02 start in Phase 1 as glob-driven standing obligations that every later phase inherits automatically.
- [Phase 01]: pnpm 12.4.1 crashes with SIGILL on this machine (verified environment-wide, not repo-specific); substituted pnpm 11.27.0
- [Phase 01]: Corrected researched VariableDeclarator ESLint selector shape (type annotation lives on the id Identifier, not the declarator) via TDD RED-phase fixture
- [Phase 01]: Zod-first authoring shape (z.infer derives types) and subpath exports with no barrel index.ts, both per CONTEXT.md's Claude's Discretion — Avoids a shared-file bottleneck across four plans authoring entity modules in packages/schemas, and sidesteps zod's circular-import hazard between cross-referencing schemas
- [Phase 01]: MatterFlagRule and Condition deferred to plan 01-06 alongside RulePack — Condition.field: keyof ExpenseLine | keyof Matter cannot be frozen until those two entities exist; keeps the dependency pointing one way
- [Phase 01]: D-01 reconfirmed at implementation time (all-six-now); word-boundary deny-list matching adopted to avoid a finalAmount/fin false positive
- [Phase 01]: claimedAmount validated via superRefine, not transform (reconfirmed for Matter/ExpenseLine) — AC-08 needs a load-time invariant check, and it sidesteps zod 4's changed transform/default type inference — 01-RESEARCH.md Pattern 1; CONTEXT.md Claude's Discretion
- [Phase 01]: AUDIT_PAYLOAD_KEYS fixed as [entityId, field, before, after, elapsedReviewMs]; AuditPayloadSchema is a z.strictObject() derived from it, rejecting any undeclared key by name — PRD section6.5 and section12.1; Phase 4's AUDIT-01 and BOUND-05 build directly on this closed set
- [Phase 01]: PRD section6.1 Matter has 16 fields, not the 15 the plan's own acceptance criteria stated (plan miscount) — implemented all 16 per the PRD — CLAUDE.md: PRD is the source of truth; freeze is transcription, not design
- [Phase 01]: D-02 confirmed extend-now without currency: FlatFeeSchema is new design (no PRD section 7.2 basis), attached to RulePack as optional flatFee with no currency sub-field per PRD section 6.0
- [Phase 01]: SignOffSchema.attestationVersion added beyond PRD §6.4 (per plan action, records §9.5 wording verbatim by version)
- [Phase 01]: GuardInput authored as its own literal type (11 members), never Omit</Pick<-derived, so AC-15b's compile-time exclusion stays structural
- [Phase 01]: z.toJSONSchema() (zod 4 native) generates 3 committed JSON Schema artifacts under packages/schemas/schema/; drift test proves byte-identical regeneration
- [Phase 01]: fast-check property harness (seed 20260915) proves the money-integer invariant over hand-constructed Assessment values; Phase 2 re-points it at real assess() output
- [Phase 02]: [Phase 02 P01]: Trimmed errors.ts/messages.ts back to Task 1's three precondition codes after a RED-phase scope leak into Task 3's codes tripped the AC-07a money-branding lint rule; Task 3 re-added the remaining three with correctly Minor-typed detail fields
- [Phase 02]: [Phase 02 P01]: gsd-tools check tdd-red-evidence's classifier expects Node --test's TAP summary lines, which Vitest's tap/tap-flat reporters do not emit; RED evidence captured by appending a manually-counted (never fabricated) summary line to the real vitest output before classification
- [Phase 02]: [Phase 02 P01]: computeTotals' appliedRuleById is keyed by AssessmentLine.id, not CategoryRule.ruleId, so it stays unambiguous even when two lines share a rule
- [Phase 02]: Locale-formatting positive case uses (1234).toLocaleString() rather than .toLocaleDateString() (Number has no such method); the ban's selector matches any toLocale* property name regardless — Representative instance of the same construct, not a narrower rule
- [Phase 02]: RED evidence for TDD tasks captured via vitest tap-flat plus a hand-appended TAP summary line — Continues 02-01's documented workaround for gsd-tools check tdd-red-evidence's Node-test-runner-shaped parser
- [Phase 02]: [Phase 02 P03]: D-11/D-12 implemented additively — MatterFlagCode gains AGGREGATE_CAP_APPLIED, Totals gains optional flatFeeComparison; AssessmentLineSchema.superRefine re-proven unchanged in both directions
- [Phase 02]: [Phase 02 P03]: Pre-existing TotalsSchema shape-cardinality test updated (6 to 7 keys) — any optional field addition changes z.object's declared shape, so an exact-length assertion is inherently incompatible with the additive-only freeze policy; the parse-behavior guarantee (six-key object still parses, no comparison property) is the invariant that actually matters and is separately tested
- [Phase 02]: PERMITTED_NARROW_EXCEPTION is treated identically to PROHIBITED (forces DISALLOW) rather than inventing a narrow-exception mechanism the PRD's step 2 prose does not itself describe
- [Phase 02]: A CategoryRule authored with plain treatment FLAG on a category other than OTHER_UNCLASSIFIED reuses the UNCATEGORISED FlagReasonCode with distinct message text -- flagged as a candidate for a dedicated code if a real pack ever needs to distinguish the two
- [Phase 02]: Cross-line checks compute per-line flag reasons only (never rewrite verdicts); assess.ts applies them in exactly one place so the verdict-and-reason invariant is enforced once
- [Phase 02]: Aggregate cap pro-rata allocation floors each line's share once and leaves the remainder unallocated (never largest-remainder or by-sequence), per PROJECT.md's settled residue policy
- [Phase 02]: [Phase 02 P06]: D-12's flat-fee schema field consumed cleanly (no impedance mismatch); computeFlatFeeComparison is a direct mapping, computed last from the finalised draftBaseline
- [Phase 02]: [Phase 02 P06]: Derived matter flags composed from a declared DERIVED_MATTER_FLAG_SPECS array (not a sequence of if-statements) so the output order is a reviewable constant; composeMatterLevelFlags owns final ordering: derived, then aggregate-cap flag, then pack flags
- [Phase 02]: [Phase 02 P07]: Banned-word matching is case-sensitive on word boundaries, not case-insensitive — messages.ts and taxonomy.ts both legitimately use capitalised 'Legal' as the department's proper noun; a case-insensitive matcher was empirically shown to break 6 of 21 real message templates during this plan's own RED phase
- [Phase 02]: [Phase 02 P07]: RED phase used deliberately-backwards test assertions rather than a broken production stub, for all three TDD tasks — calendar-math.ts/totals.ts/messages.ts were already correct from prior plans in this phase; injecting a genuine purity/correctness bug into production source to manufacture RED would have briefly shipped the exact defect these tests exist to prevent
- [Phase 02]: [Phase 02 P07]: packages/engine/tsconfig.json gained types:[node], matching packages/schemas/tsconfig.json's existing entry — tsc could not resolve node:perf_hooks in perf.test.ts without it, even though @types/node is a root devDependency
- [Phase 03]: [Phase 03 P01]: PD-1/PD-2 implemented as planned - StubConstraintsSchema is a new parallel type, LoadableRulePackSchema is the primary load-boundary shape; RulePackSchema demoted to the narrowed ACTIVE-ready variant
- [Phase 03]: [Phase 03 P01]: TDD RED phases for Tasks 2/3 used deliberately-inverted assertions rather than injecting a production bug, since validate.ts/loader.ts/stub-category-rules.ts were already correct from Task 1 (STATE.md Phase 02 P07 precedent)
- [Phase 03]: [Phase 03]: [Phase 03 P02]: PD-3's appliesTo derivation and Claude's Discretion item 4's NO_EXPRESS_AUTHORITY default for unresearched public-agency postures applied consistently across AU/NZ/JP/KR/CN/IN
- [Phase 03]: [Phase 03]: [Phase 03 P02]: authoringNote markdown-stripping scope clarified -- only **/* emphasis markers removed, backticks retained as literal code-span references (new reading, no prior precedent had backticks to test)
- [Phase 03]: [Phase 03 P04]: packages/engine/package.json gained an additive exports map (".", "./calendar-math") alongside its existing main, and packages/rulepacks now depends on @dsar/engine (workspace:*) — the only new dependency direction, which no .dependency-cruiser.cjs purity rule (all anchored from: ^packages/engine) can forbid
- [Phase 03]: [Phase 03 P04]: deriveEffectiveStatus mirrors packages/engine/src/preconditions.ts's exact "past, not on" (< 0) boundary and only ever downgrades a pack's reported status (ACTIVE->STALE), never upgrades one — a DRAFT/WITHDRAWN/already-STALE pack's stored status always passes through unchanged
- [Phase 03]: [Phase 03 P04]: resolveRulePack's RulePackNotFoundError/RulePackVersionMismatchError authored as plain Error subclasses (no code/detail fields), following stub-category-rules.ts's UnknownPackJurisdictionError/NotAStubPackError precedent rather than validate.ts's RulePackValidationFailure convention — loader.ts had no structured-error precedent of its own
- [Phase 03]: [Phase 03 P04]: PACK-04 and PACK-05 left "Pending" in REQUIREMENTS.md, not marked complete — the plan's own <assumptions> record PACK-04's HTTP half (409 response, in-flight-review notice) and PACK-05's assessment-side half (AC-40, needs persisted assessments) as explicitly out of scope for this plan, deferred to Phases 5/6 and 3.2 respectively
- [Phase 03]: [Phase 03 P03]: assertActiveReady's ACTIVE_READY_CHECKS follows the DERIVED_MATTER_FLAG_SPECS precedent exactly (name+run pairs, exported name-only order constant); assertActiveReady is invoked from inside validateRulePack (guarded by status === "ACTIVE") rather than duplicating check logic
- [Phase 03]: [Phase 03 P03]: PROTOTYPE_COUNSEL.displayName reads "Product Owner — Prototype Authoring Counsel" (role, not a guessed personal name) — no canonical name for the product owner appears in any planning artifact read; D-17's ULID literal kept as specified, verified valid Crockford base32 before use
- [Phase 03]: [Phase 03 P03]: flatFee.verificationNote deliberately NOT scanned by the D-15 unauthored-token check — FlatFeeSchema has no such field yet; that extension (D-22) is scheduled for plan 03-05, which also owns packages/schemas/src/rule-pack.ts's next change. Flagged in validate.ts and 03-03-SUMMARY.md for 03-05 to pick up
- [Phase 03]: [Phase 03 P03]: gsd-tools.cjs unavailable in this worktree — TDD tasks committed as implementation+tests together (each verified failing-for-the-right-reason before finalizing) rather than separate RED/GREEN commits; STATE.md/ROADMAP.md/REQUIREMENTS.md updated manually (sequential mode, no gsd_run)
- [Phase 03]: [Phase 03]: [Phase 03 P02]: Task 3's RED phase used a deliberately-inverted assertion (.not.toBe(147)) rather than corrupting committed pack data, extending 03-01's no-manufactured-defects precedent to data-generation TDD tasks

### Pending Todos

None yet.

### Blockers/Concerns

- PACK-09 authoring is legal work, not code, and gates Phase 6's golden files. If it slips, Phase 2 must not wait on it — the engine is built against the PRD §14 fixture pack by design.
- Two product-owner decisions recorded in PROJECT.md are now load-bearing on Phase 2: aggregate-cap residue allocation (ENGINE-07) and pack-content immutability enforcement (PACK-06).
- Phases 3 and 5 both add routes to `apps/web`. Low collision risk on the Phase 1 shell, but worth sequencing the shell-level changes if both run concurrently.
- Pre-existing json-schema.test.ts CRLF/LF drift failure (unrelated to Phase 3) blocks a clean pnpm test exit — logged to WINDOWS.md entry #1, needs a .gitattributes fix independent of this phase
- Plan 03-05 must extend validate.ts's assertNoUnauthoredContent to scan flatFee.verificationNote once it adds that field to FlatFeeSchema (D-22) — 03-03 could not implement this channel since the field doesn't exist within 03-03's dependency scope (depends only on 03-01). No committed pack currently sets flatFee, so this is not yet a live gap.
- gsd-tools.cjs was not found anywhere under this worktree during 03-03/03-04 execution — if this recurs in later plans, TDD RED-evidence checks and state/roadmap updates will again need to be done manually
- PACK-04's HTTP half (409 refusal on a stale pack, in-flight-review full-width notice) and PACK-05's assessment-side half (AC-40's "existing assessment untouched by new activation") remain undischarged after 03-04 — both need a route/review screen (Phases 5/6) or persisted assessments (Phase 3.2) that do not exist yet. REQUIREMENTS.md correctly still shows both Pending.

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Demo Slice - In-Memory Determination Pipeline: live determination with no database, for a stakeholder presentation ~2 weeks out. Docker unavailable on the build machine; DB needed only for persistence and AC-34, neither exercised by a demo. (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-17T22:14:00.000Z
Stopped at: Completed 03-04-PLAN.md
Resume file: None
