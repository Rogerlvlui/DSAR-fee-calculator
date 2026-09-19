---
gsd_state_version: "1.0"
current_phase: "04"
current_phase_name: Workflow and Audit Backbone
status: executing
stopped_at: Completed 04-02-PLAN.md (full guard table + purity/determinism gates) — ready for 04-03
last_updated: "2026-09-19T10:10:00.000Z"
last_activity: 2026-09-19
last_activity_desc: Phase 04 Plan 02 complete — all ten PRD §5 guard-table rows declared and tested, packages/workflow purity and determinism enforced by dependency-cruiser and ESLint gates, each proven by a violating fixture
state_head: 68d7ec7
progress:
  total_phases: 10
  completed_phases: 1
  total_plans: 31
  completed_plans: 25
  percent: 81
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13)

**Core value:** A lawyer can defend the output by saying "the engine applied rule HK-PDPO.STAFF_TIME_REDACT_EXEMPT, version 2026.09.1, authored by X on date Y, and struck the line" — never "the model assessed the claim."
**Current focus:** Phase 04 — Workflow and Audit Backbone (Plan 02/5 complete — full guard table + purity/determinism gates; 03.2 Database Boundary remains separately planned, runs concurrently per ROADMAP.md)

## Current Position

Phase: 04 — Workflow and Audit Backbone
Plan: 02/5 complete
Status: In progress — ready to plan/execute 04-03
Last activity: 2026-09-19 — 04-02 complete: all ten PRD §5 guard-table rows declared and tested, packages/workflow purity/determinism CI-enforced, full suite green (666/666)

Progress: [████████░░] 81%

## Performance Metrics

**Velocity:**

- Total plans completed: 25
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 6 | - | - |
| 02 | 7 | - | - |
| 3 | 5 | - | - |
| 03.1 | 5/5 | - | - |
| 3.1 | 5 | - | - |
| 04 | 2/5 | - | - |

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
| Phase 03 P05 | 30min | 3 tasks | 10 files |
| Phase 03.1 P01 | 70min | 4 tasks | 45 files |
| Phase 03.1 P02 | 30min | 3 tasks | 20 files |
| Phase 03.1 P03 | 55min | 3 tasks | 26 files |
| Phase 03.1 P04 | 75min | 3 tasks | 26 files |
| Phase 03.1 P05 | 90min | 3 tasks | 15 files |
| Phase 04 P01 | 40min | 3 tasks | 23 files |
| Phase 04 P02 | 35min | 2 tasks | 11 files |

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
- [Phase 03]: [Phase 03 P05]: HK-PDPO and SG-PDPA committed by transcription only — 9/21 (HK) and 6/15 (SG) categoryRules authored from PRD §7.5/§7.6, remaining 12/15 as generateStubCategoryRules() placeholders; FlatFeeSchema.verificationNote (D-22) lets HK's flatFee.amount:0 carry the UNAUTHORED marker; PACK-12 marked complete in REQUIREMENTS.md (structural half genuinely discharged), PACK-09 deliberately left Pending (D-16 defers full 21-category authoring + ACTIVE to before Phase 6)
- [Phase 03]: [Phase 03 P05]: assertActiveReady's actual thrown code for both reference packs is MISSING_REVIEWER, not the plan-stated UNAUTHORED_CONTENT — authoredBy/reviewedBy/reviewedOn transcribed as null per PRD, and REVIEWER_IDENTITY (03-03) runs before UNAUTHORED_CONTENT in ACTIVE_READY_CHECK_ORDER; test asserts the real, verified code (Rule 1 deviation, documented in 03-05-SUMMARY.md)
- [Phase 03]: [Phase 03 P05]: validate.ts's assertNoUnauthoredContent still does NOT scan flatFee.verificationNote — flagged in 03-03-SUMMARY as deferred here once the field existed, but adding the scan touches validate.ts, outside this plan's declared files (Task 1 only widens rule-pack.ts); recommend a Phase 3.2/Phase 6 follow-up task
- [Phase 03.1]: [Phase 03.1 P01]: ulid npm package approved by product owner at Task 0's blocking-human checkpoint (npmjs.com verified: 3.0.2, github.com/ulid/javascript, ~7.6M weekly downloads, MIT, 0 deps, no install script)
- [Phase 03.1]: [Phase 03.1 P01]: server-only npm package deliberately NOT installed — replaced by a local guard module (apps/web/src/server/server-only.ts, a window-typeof throw) plus the no-server-imports-in-ui dependency-cruiser rule, per 03.1-RESEARCH.md's own recorded assumption; gives the same runtime+build-time guarantees with no new dependency and no Vitest resolution workaround
- [Phase 03.1]: [Phase 03.1 P01]: restingOnUnverifiedRules confirmed as 26640 through the real HTTP path against the real committed SG-PDPA pack (not PRD §14's published 10640) — every relevant rule in the real pack is NEEDS_VERIFICATION, so all three ALLOW/ALLOW_CAPPED lines rest on unverified rules; asserted with toBe(26640), pack content untouched
- [Phase 03.1]: [Phase 03.1 P01]: tests/tsconfig.json's rootDir widened to the repo root, include narrowed to two targeted globs (apps/web/app/api/**, apps/web/src/server/**) plus an exclude for current-actor.ts — that file's next/headers import only resolves under apps/web/tsconfig.json's bundler moduleResolution, not this project's inherited nodenext
- [Phase 03.1]: [Phase 03.1 P01]: gsd-tools.cjs still unavailable in this worktree (same as 03-03/03-04) — STATE.md/ROADMAP.md updated manually, SUMMARY.md's actuals computed by hand (git diff char count / 4, git rev-list --count)
- [Phase 03.1]: [Phase 03.1 P02]: Requestor class rendered as fixed hint text, not an editable select, matching Annex A and this plan's own no-requestor-field-name acceptance criterion
- [Phase 03.1]: [Phase 03.1 P02]: AddExpenseLineInput/replaceExpenseLine gained an optional claimedAmount, defense-in-depth only, so a crafted request disagreeing with quantity*unitRate is caught by ExpenseLineSchema's own invariant rather than the server always silently recomputing it
- [Phase 03.1]: [Phase 03.1 P02]: Category select renders options only for codes present in the categories prop (grouped by the fixed PRD section10.2 four groups), never a hardcoded all-21 list, so an option never renders with no real pack-sourced label
- [Phase 03.1]: [Phase 03.1 P03]: Every disposition requires a reason, uniformly, on the server (including a plain Accept) — Annex A's varying reason-label text is rendered verbatim but the length rule itself does not vary by verdict or action
- [Phase 03.1]: [Phase 03.1 P03]: AssessmentRepository gained findByLineId() (interface.ts + memory implementation) — the disposition route only knows the assessment-line id, not its assessment id, and no existing method resolved one from the other
- [Phase 03.1]: [Phase 03.1 P03]: listBulkAcceptableLineIds() gained an optional pack override (defaults to the real loadDemoPack()) so the five-way exclusion matrix (capped, not-supported, flagged, unverified-rule, already-decided) is testable in one fixture — the real committed SG-PDPA pack has zero VERIFIED category rules, so no fixture built against it alone could isolate any one exclusion case from "unverified rule"
- [Phase 03.1]: [Phase 03.1 P03]: apps/web/src/domain/ established as a new directory for pure modules shared by apps/web/src/ui and apps/web/src/server (verdict-order.ts, review-tallies.ts, disposition-actions.ts) — neither prefix matches the no-server-imports-in-ui dependency-cruiser rule, so no new rule was needed
- [Phase 03.1]: [Phase 03.1 P03]: DispositionControls/BulkAcceptBar each split into a stateful wrapper and a pure *View component — useRouter() throws ("invariant expected app router to be mounted") when a "use client" component calling it is rendered via bare renderToStaticMarkup() outside a real Next.js request, so only the pure half is ever rendered directly in this plan's own tests
- [Phase 03.1]: [Phase 03.1 P04]: attestationText is computed via the shared renderAttestation() and returned in signOff()'s response, never persisted on SignOffSchema — the frozen schema carries only attestationVersion + the affirmed boolean, per Phase 1's own recorded-verbatim-by-version design
- [Phase 03.1]: [Phase 03.1 P04]: apps/web/src/server/state.ts extended with LEGAL_REVIEW->SIGNED_OFF, LEGAL_REVIEW->INFO_REQUEST, INFO_REQUEST->COMPUTING — a Rule 3 deviation beyond this plan's own declared file list, since dispositionLine/bulkAcceptLines/signOff all need the same INFO_REQUEST precondition
- [Phase 03.1]: [Phase 03.1 P04]: resubmitAfterInfoRequest overwrites the existing assessment under its existing id, discarding the engine's own derived id — exactly one assessment exists per matter after a recompute, matching PRD section5's mirror-image rule
- [Phase 03.1]: [Phase 03.1 P05]: SignOffPanel/Ask-HR wiring gap (WINDOWS.md entries 5-6) closed as a Rule 1 deviation ahead of Task 1 — assessment-view.tsx gained an optional signOffPanel composition slot; the legal review page computes the sign-off preview from the SAME pure modules (computeReviewTallies/computeFinalAmount/renderAttestation) signOff() itself calls
- [Phase 03.1]: [Phase 03.1 P05]: the totals-rail headline does not track the lawyer's live dispositions before sign-off — it shows draftBaseline as a placeholder until signOff() writes finalAmount; documented explicitly in docs/DEMO-WALKTHROUGH.md rather than asserting the wrong figure
- [Phase 03.1]: [Phase 03.1 P05]: @dsar/rulepacks added to the ROOT package.json (previously only an apps/web dependency) — a repo-root-level test file importing @dsar/rulepacks/validate directly cannot resolve it through apps/web's own node_modules symlink
- [Phase 03.1]: [Phase 03.1 P05]: the layout-marker-position honesty assertion runs under the node "routes" Vitest project, not the jsdom "web" one — rendering the real root layout under jsdom trips apps/web/src/server/server-only.ts's window-guard exactly as designed
- [Phase 04]: [Phase 04 P01]: GuardInput's "past its review date" condition reads pack.status === "STALE" (already downgraded upstream by the rulepacks loader's deriveEffectiveStatus) rather than the guard computing staleness from a clock — GuardInput's frozen 11-member shape has no `now` field, and packages/workflow must stay pure
- [Phase 04]: [Phase 04 P01]: submitForAssessment's two pre-existing 03.1 ValidationError checks (DRAFT-only, at-least-one-line) were left untouched; only the literal assertTransition(matter.status, "COMPUTING") stand-in call was replaced by the guarded executor — removing the pre-existing checks would flip the zero-line case's response from 400 to 409, breaking the already-passing, must-survive-unchanged PIPELINE-tagged demo-pipeline.test.ts
- [Phase 04]: [Phase 04 P01]: @dsar/engine added to the ROOT package.json (previously only apps/web and packages/rulepacks depended on it) — a repo-root-level test file importing @dsar/engine's ENGINE_VERSION directly cannot resolve it through apps/web's own node_modules symlink, same fix as 03.1-05's @dsar/rulepacks addition
- [Phase 04]: [Phase 04 P01]: packages/audit's PackLifecycleEventWriter interface declared but not implemented (04-03's job); the real pack-activation write path stays Phase 3.2's (PACK-07) — this plan does not discharge either half
- [Phase 04]: [Phase 04 P02]: GuardResult's canonical definition moved to guards.ts (re-exported from transitions.ts) to avoid an import cycle, since guards.ts needs the type and transitions.ts imports guards.ts's predicates
- [Phase 04]: [Phase 04 P02]: The GUARD-TABLE completeness test's origin/non-origin assertion follows the PRD table as actually transcribed rather than the plan's own summary prose — CLOSED IS an origin (it has its own outgoing SUPERSEDE row per PRD §5), so only SUPERSEDED has no outgoing row; the plan's "two terminal statuses" line does not hold once the table is faithfully implemented (PRD wins per CLAUDE.md)
- [Phase 04]: [Phase 04 P02]: checkPackAvailable (existence only) kept distinct from checkPackUsable (existence+ACTIVE+non-stale) — the recompute row and sign-off's fourth condition both require only a pinned/available pack, narrower than submit/resubmit's full usability requirement, per the plan's own action text
- [Phase 04]: [Phase 04 P02]: Both new dependency-cruiser rules (no-io-in-workflow, no-infra-in-workflow) match the dependency's raw @dsar/<pkg> specifier text in addition to the resolved packages/<pkg>/src path — dependency-cruiser cannot resolve a workspace package's subpath-export map ("./*": "./src/*.ts") inside its own module graph, and falls back to matching the unresolved specifier, the same double-coverage the pre-existing no-money-formatting-in-engine rule already relies on
- [Phase 04]: [Phase 04 P02]: STATE-02 still left Pending in REQUIREMENTS.md — the guard table is complete (all ten rows), but six call sites in apps/web/src/server/data/{matters,assessments}.ts still write MatterStatus literals directly; that retrofit is plan 04-04's job

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
- Phase 3's last plan (03-05) is complete — all 5/5 plans executed — but PACK-09 remains genuinely Pending: only 9/21 (HK) and 6/15 (SG) categoryRules are authored, per D-16's deliberate deferral of full 21-category authoring across both reference packs to before Phase 6's convergence gate. This is the schedule long pole PROJECT.md already flags; not a new blocker, but now the only Phase 3 in-scope requirement still open.
- validate.ts's assertNoUnauthoredContent does not yet scan flatFee.verificationNote, even though HK-PDPO's flatFee.verificationNote carries the UNAUTHORED token today — assertActiveReady still refuses HK-PDPO via MISSING_REVIEWER (reviewer fields are null), so no live gap in current behavior, but the scan should be added (touches packages/rulepacks/src/validate.ts) before HK-PDPO's reviewer fields are ever set, so a real flat-fee figure cannot slip through unscanned.
- **`pnpm dev`/`next build` currently fail** — discovered via a voluntary smoke test during 03.1-01, recorded as WINDOWS.md ledger entries 2 and 3 (open_count is 2, not 0): (1) `packages/rulepacks/src/loader.ts`'s `RULEPACKS_ROOT` throws under Turbopack's page-data collection (`import.meta.dirname` undefined there) — a frozen Phase 3 file, out of 03.1-01's scope, needs a product-owner decision; (2) no `@tailwindcss/postcss` plugin is registered anywhere, so `apps/web/app/globals.css`'s `@theme` block is inert in a real build — fixing this needs a new package install, which requires its own package-legitimacy checkpoint (like Task 0's ulid one) before any later plan runs `pnpm add @tailwindcss/postcss`. **Resolve both before Plan 03.1-02 starts** — otherwise every subsequent plan's UI work accumulates on a stylesheet Tailwind isn't processing, and the actual stakeholder demo cannot run.
- ~~SignOffPanel (03.1-04) is not yet rendered on the legal review page, and disposition-controls.tsx's Ask HR button stays hardcoded disabled~~ — **resolved in Plan 03.1-05** (WINDOWS.md entries 5-6 marked fixed): both are now wired into the actual legal review page.
- Phase 03.1 is now complete (5/5 plans) but its manual click-through row (03.1-VALIDATION.md's 05-manual) has never actually been run — `pnpm dev`/`next build` still cannot start on this build machine (WINDOWS.md entries 2-4, still open). A product-owner decision on the frozen Phase 3 `RULEPACKS_ROOT`/Turbopack issue and the Tailwind/Lightning-CSS native-binary crash is the prerequisite before that one manual row can move from "not run" to genuinely verified.
- Phase 04's 04-01 (tracer) and 04-02 (full guard table + purity/determinism gates) are both complete, but STATE-02/AUDIT-01/AUDIT-03/BOUND-05 remain only partly discharged — the guard table itself is now complete (all ten PRD §5 rows), but six status-literal call sites in apps/web/src/server/data/{matters,assessments}.ts still bypass it; the pack-lifecycle writer is still declared not implemented; the elapsed-review clock is still not wired to a real disposition/sign-off call site. REQUIREMENTS.md correctly still shows all four Pending.
- gsd-tools.cjs remains unavailable in this worktree during 04-01/04-02 execution (same recurring gap as 03-03/03-04/03.1) — STATE.md/ROADMAP.md updated manually again this plan.

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Demo Slice - In-Memory Determination Pipeline: live determination with no database, for a stakeholder presentation ~2 weeks out. Docker unavailable on the build machine; DB needed only for persistence and AC-34, neither exercised by a demo. (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-19T10:10:00.000Z
Stopped at: Completed 04-02-PLAN.md — full PRD §5 guard table (all ten rows) plus dependency-cruiser/ESLint purity and determinism gates for packages/workflow, full suite green (666/666)
Resume file: None
