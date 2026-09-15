# Phase 2: Deterministic Fee Engine - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

`assess(matter, lines, pack, now) → Assessment` — a pure function in `packages/engine` that applies PRD §8.1's seven-step algorithm to compute a defensible fee, proven correct against hand-built fixture packs before any real jurisdiction pack exists.

**In scope:** ENGINE-01..13, ENGINE-15, ENGINE-16, ENGINE-17.

**Not in scope:** real pack content or the loader (Phase 3), the guarded state machine (Phase 4), any screen (Phases 5–6, 3.1), sign-off or documents (Phase 7), the LLM (Phase 8), and anything requiring a database (Phase 3.2).

**Why there was no discuss-phase.** PRD §8.1 specifies the algorithm step by step and PROJECT.md already records the one ambiguity it left (aggregate-cap residue). Phase 2's research substituted for that discussion and surfaced three genuine gaps the spec does not resolve; those were put to the product owner and are recorded below as D-11 through D-13.
</domain>

<decisions>
## Implementation Decisions

Numbering continues from Phase 1's D-01..D-10 so decision IDs stay unique across the project.

### Where the aggregate-cap notice lives

- **D-11:** `AGGREGATE_CAP_APPLIED` is added to **`MatterFlagCode`** as a matter-level flag. Lines reduced by an aggregate cap keep their `ALLOW_CAPPED` verdict and contribute their reduced amounts to `draftBaseline`.

  The gap: the frozen `AssessmentLineSchema.superRefine` is bidirectional — `flagReasons` must be empty unless the verdict is `FLAG` — so a capped line legally cannot carry a line-level reason; and `MatterFlagCode` had no cap member. There was nowhere to put ENGINE-07's "flag that it bit".

  Rejected: relaxing the line-level refine (a retype of a frozen invariant, and it weakens the property that makes "flagged" unambiguous for every later phase that reads `flagReasons` to decide what blocks sign-off); and setting capped lines to `FLAG` (AC-11 makes `FLAG` lines contribute zero to `draftBaseline`, so a line the pack allows would drop out of the fee entirely because a cap trimmed it — that changes the computed figure, not merely its presentation).

  **Tension to record:** PRD §6.0 lists `AGGREGATE_CAP_APPLIED` among the *line-level* `FlagReasonCode` values, so Phase 1's bidirectional refine was probably stricter than the PRD intended. This resolves the conflict additively rather than by loosening the freeze. — **Reversibility:** costly — additive under D-09, but every later consumer of matter flags reads this set.

### How the flat-fee comparison surfaces

- **D-12:** An additive flat-fee comparison block is added to `TotalsSchema`, carrying the pack's flat figure and whether it exceeds itemised direct cost. **"Itemised direct cost" means `draftBaseline`.**

  The gap: ENGINE-16 requires the engine to compute and report the comparison, but the frozen `TotalsSchema` and `AssessmentSchema` carry no field for it — there was nowhere to write the answer.

  The definition is not PRD-defined. It cannot be: `FlatFeeSchema` was invention in Phase 1 filling a gap between ENGINE-16 and a spec that has no flat-fee field at all (PRD §7.2 has none; §7.5's only mechanism is an advisory `matterFlagRule`). `draftBaseline` is the defensible reading — it is the itemised allowable total before any lawyer disposition — and it is grounded in a Phase 1 module comment.

  Not on the demo path: Phase 3.1 demos SG, which has no flat fee. — **Reversibility:** costly — additive under D-09, but Phase 3's HK pack and Phase 6's review screen both read it.

### The implausible-magnitude check

- **D-13:** The `DATA_QUALITY` "implausible magnitude" cross-line check is **not built in this phase.** Ship only the three checks the PRD actually specifies: duplicate detection, materiality (40% of `claimedTotal`), and rate sanity against the pack's `rateSanityCeiling`.

  The PRD names no threshold, and inventing one would have the engine flag on a figure no lawyer authored — precisely what PRD §0's non-negotiables forbid. `rateSanityCeiling` already catches the realistic case (an inflated hourly rate) using a pack-authored number.

  Rejected: deriving a multiple of `rateSanityCeiling` (still requires an invented multiplier, and covers only rate-shaped lines — not a vendor invoice or a page count), and picking an absolute ceiling (a figure with no legal authority, inside an engine meant to apply only lawyer-authored rules).

  If a threshold is wanted later it belongs in the **rule pack**, authored by counsel, not in engine code. — **Reversibility:** reversible.

### Carried from Phase 1 — still binding

- **D-09 [informational]:** The freeze is additive-only. D-11 and D-12 are additive and therefore permitted; neither renames, retypes nor removes a frozen field. Any breaking change escalates to the product owner before the phase continues.
- **Aggregate-cap residue [informational]:** Already decided in PROJECT.md — round each line down, leave the remainder unallocated, flag it. Rejected largest-remainder and by-sequence allocation, both of which hit the cap exactly but introduce an ordering rule a lawyer would have to defend. **Not to be re-litigated.**

### Claude's Discretion

Grounded in `02-RESEARCH.md`; resolve without returning to the product owner unless something contradicts a decision above:

- **`disallowedTotal`'s formula.** Research established, by recomputing PRD §14's own published 126.60, that it must absorb `claimedAmount − engineAmount` from `ALLOW_CAPPED` lines as well as the full claim of `DISALLOW` lines (120.00 + 6.60). Verified independently. Getting this wrong fails AC-09's golden file for a reason that looks unrelated to the real bug.
- **The locale half of Success Criterion 2.** Research verified empirically on this machine that Node re-reads `process.env.TZ` dynamically (so the timezone leg needs no subprocess or `cross-env`), but that `LANG` does **not** move Node's `Intl` default locale on Windows. The locale leg therefore needs a static-analysis substitute — banning `Intl` and `toLocale*` in `packages/engine` via ESLint — rather than an env-var flip that would silently pass while testing nothing.
- **`PERCENT_OF_CLAIM` has no `.int()` constraint**, so fractional percents are legal. `Math.floor` discipline throughout, never `Math.round`.
- The performance-budget approach for ENGINE-15 (50 lines under 100ms) — a flaky perf test gets deleted, which is worse than none.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The specification
- `docs/PRD-dsar-fee-agent.md` §8.1 — the seven-step algorithm; this phase in one page
- `docs/PRD-dsar-fee-agent.md` §7.2 — the `RulePack` the engine reads
- `docs/PRD-dsar-fee-agent.md` §6.3, §6.4 — `Assessment` and `AssessmentLine`
- `docs/PRD-dsar-fee-agent.md` §11 — the 100ms / 50-line budget
- `docs/PRD-dsar-fee-agent.md` §13 — AC-07c, AC-08, AC-09, AC-11, AC-13, AC-14, AC-19, AC-22, AC-25
- `docs/PRD-dsar-fee-agent.md` §14 — **the reference fixture, which §14 says to build first.** Six lines, exact expected totals. It is this phase's spine and the check on every formula.

### This phase
- `.planning/phases/02-deterministic-fee-engine/02-RESEARCH.md` — arithmetic derivations, the TZ/locale findings, and the three gaps that became D-11..D-13

### Phase 1's output — the contract this phase consumes
- `packages/schemas/FREEZE.md` — the 12 frozen modules and the additive-only rule
- `packages/schemas/src/__fixtures__/arbitraries.ts` — **reusable fast-check arbitraries exported specifically for this phase.** Check these before writing new ones.
- `.planning/phases/01-schemas-freeze-and-walking-skeleton/01-CONTEXT.md` — D-01..D-10

### Project
- `CLAUDE.md` — the five PRD §0 non-negotiables. The first ("the LLM never does arithmetic; all money is computed by `packages/engine`") is this phase's whole subject; the fourth ("when in doubt, the engine flags rather than decides") is the disposition for any residual ambiguity.
- `.claude/CLAUDE.md` — locked stack. **Corrections that override it:** pnpm is 11.27.0 not 12.x (12.4.1 crashes with `SIGILL` here), TypeScript is exactly 6.0.3 (`typescript-eslint` requires `<6.1.0`).
- `.planning/PROJECT.md` — Key Decisions, including the aggregate-cap residue rule

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas` — all 12 frozen modules. `packages/engine` already imports it successfully through its exports map; a permanent cross-package boundary test guards that.
- `packages/schemas/src/__fixtures__/arbitraries.ts` — fast-check arbitraries built in Phase 1 for this phase's property tests.

### Established Patterns
- Cross-field invariants use `.superRefine()`, never `.transform()`.
- `packages/schemas` uses `.ts`-extension relative imports under `nodenext`; `allowImportingTsExtensions` is inherited from `tsconfig.base.json`.
- Money is branded `Minor`, bounded to the 32-bit signed range to match the Prisma columns.

### Integration Points
- `packages/engine/src/` — nearly empty; this phase fills it.
- `vitest.config.ts` — an `engine` project already exists; this phase's tests belong there.

### Live gates inherited
The AC-07a money-branding ESLint rule, the `dependency-cruiser` purity boundary over `packages/engine`, and a working `pnpm run typecheck`. **All three were found in Phase 1 to be passing while inspecting nothing at some point.** Any new gate this phase adds must ship with a violating fixture proving it fires.

</code_context>

<specifics>
## Specific Ideas

- **"The engine flags rather than decides."** PRD §0's fourth non-negotiable is the tie-breaker for every ambiguity in this phase. D-13 applies it directly: no invented threshold, because a flag on an unauthored number is the failure this rule exists to prevent.
- **A threshold belongs in the pack, not the engine.** If implausible-magnitude is wanted later, counsel authors it.
- **The §14 fixture is the spine.** Build it first, per §14's own instruction. Every formula is checked against its published totals rather than against reasoning.
- **Prove the gate fires.** Four checks in Phase 1 passed while inspecting nothing — an ESLint selector matching no AST node, a `typecheck` printing help text, 173 tests never exercising a cross-package import, and a `sed` probe matching no line. Every gate here ships with a fixture it must catch.

</specifics>

<deferred>
## Deferred Ideas

- **`DATA_QUALITY` implausible-magnitude check** (D-13) — not built. If wanted, it belongs in the rule pack as counsel-authored data, not in engine code.
- **ENGINE-14** — not in this phase's requirement set; it belongs to Phase 6.
- **Real pack content** — Phase 3. This phase uses hand-built fixture packs only, deliberately, so the engine is proven before real packs exist.

</deferred>

---

*Phase: 2-Deterministic Fee Engine*
*Context gathered: 2026-09-15*
