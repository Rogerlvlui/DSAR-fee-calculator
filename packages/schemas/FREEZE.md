# packages/schemas — Freeze Policy

This file is what a later phase should read instead of the Phase 1 plans
that produced these modules. If you are about to add, rename, retype, or
remove a field anywhere in `packages/schemas`, read this first.

## What is frozen, and as of when

As of Phase 1 (Schemas Freeze and Walking Skeleton), the following modules
are frozen:

- `primitives.ts`
- `money.ts`
- `matter-status.ts`
- `taxonomy.ts`
- `constants.ts`
- `matter.ts`
- `expense-line.ts`
- `audit-event.ts`
- `condition.ts`
- `rule-pack.ts`
- `assessment.ts`
- `guard-input.ts`

## The rule (D-09): additive-only

After Phase 1 ships, a later phase may **add optional fields and new
tables**. It may **not rename, retype, or remove a frozen field.** Any
breaking change escalates to the product owner as an explicit decision
*before that phase continues* — it is never made silently inside a phase.

## Why

Phases 2, 3, 4 and 5 all run concurrently against one `packages/schemas`
and one `prisma/schema.prisma`. A silent retype of a frozen field in any one
of them invalidates the other three's in-flight work, and that would not be
caught until merge — by which point untangling it is expensive across four
workstreams at once, instead of cheap at the point someone typed the
change. Landing the rule with the freeze, rather than discovering the need
for it later, is what keeps that from happening.

## The escape valve (D-10): escalation, not a quiet workaround

The accepted cost of the additive-only rule is stated plainly: **until an
escalation happens, a genuinely wrong early type gets worked around rather
than fixed.** That is deliberate, not an oversight. PRD §16 (Phase 2)
already anticipates this exact moment — an engine change forcing a schema
change means the schema was wrong, "and that is worth knowing early." When
the additive-only rule forces a workaround, that *is* this signal firing.
It escalates to the product owner as an explicit decision, and the outcome
belongs in `PROJECT.md`'s Key Decisions table — it is not a decision to
make quietly inside a phase, and it is not a decision to defer indefinitely
by working around it forever.

If you are a later-phase implementer and you believe a frozen field is
wrong: stop, write down what's wrong and why the workaround is worse than
the fix, and escalate before you touch the frozen module. Do not "just fix
it" and do not silently work around it without recording that you did.

## D-03: Assessment and AssessmentLine were committed to before assess() ran

`Assessment` and `AssessmentLine` (`assessment.ts`, this plan) were frozen
before `packages/engine`'s `assess()` function has ever run — an accepted
trade-off recorded as D-03 in `01-CONTEXT.md`. The mitigation is this freeze
policy plus PRD §14's reference fixture, which specifies the expected
`Assessment` shape field by field before any engine code exists:
`claimedTotal` 888.00, `draftBaseline` 266.40, `disallowedTotal` 126.60,
`flaggedTotal` 495.00 (2 items), `restingOnUnverifiedRules` 106.40,
`finalAmount` `null`. If Phase 2 finds this frozen shape cannot express a
correct `assess()` output for that fixture, that is D-10's escalation
signal firing — not a reason to quietly retype `Assessment` inside Phase 2.

## Post-freeze amendment: `Minor`/`quantity` bounded to Postgres's Int32 range (WR-03)

Before Phase 3.2 applies the first migration — the last point at which this
counts as a same-phase correction rather than a D-09 escalation —
`MinorSchema` (`primitives.ts`) was narrowed from the full JS safe-integer
range to the 32-bit signed range (`MINOR_MIN`/`MINOR_MAX`,
`±2,147,483,647`), matching every Minor-typed Prisma column, which is
declared `Int`, not `BigInt`. `ExpenseLineSchema.quantity` (`expense-line.ts`)
was given a matching sane ceiling (`EXPENSE_LINE_QUANTITY_MAX`, 1,000,000) so
`quantity * unitRate` cannot lose precision or silently overflow the column
before either field's own bound gets a chance to reject it. This is a
narrowing of accepted values, not a rename/retype/removal of a frozen field —
no downstream package that was relying on the documented shape (a branded
integer `Minor`; an integer `quantity`) is broken by it, and the committed
JSON Schema artifacts under `packages/schemas/schema/*.schema.json` were
regenerated (`pnpm schema:json`) to reflect the new bounds. Recorded here so
the freeze record stays true, per the 01-REVIEW.md WR-03 fix.

## Post-freeze amendment: `AuditEvent.type` is now a native Postgres enum (WR-02)

`prisma/schema.prisma`'s `AuditEvent.type` column changed from `String` to a
native `enum AuditEventType`, mirroring the frozen `AuditEventTypeSchema`
(`primitives.ts`) member-for-member (verified 17/17, same order). No
`packages/schemas` module changed — `AuditEventTypeSchema` itself is
untouched — only the Prisma column's DB-level enforcement was tightened to
match a type this freeze already declared closed. Recorded here for the same
reason as the amendment above: the freeze record should account for every
change to a frozen entity's storage shape, not only to `packages/schemas`
source. See the 01-REVIEW.md WR-02 fix.

## Post-freeze amendment: `MatterFlagCode` gains `AGGREGATE_CAP_APPLIED`, and `Totals` gains an optional `flatFeeComparison` block (D-11, D-12)

Two additive changes landed in Phase 2 (plan 02-03), both decided by the
product owner on 2026-09-15 and recorded in full in
`.planning/phases/02-deterministic-fee-engine/02-CONTEXT.md`. **D-09 is the
authority under which both are permitted without escalation**: each is a
pure addition — no frozen field anywhere in `primitives.ts` or `assessment.ts`
is renamed, retyped, or removed.

**D-11 — `MatterFlagCodeSchema` (`primitives.ts`) gains a sixth member,
`AGGREGATE_CAP_APPLIED`.** The gap: `AssessmentLineSchema.superRefine`
(`assessment.ts`) is bidirectional — `flagReasons` must be empty unless
`verdict` is `FLAG`, and non-empty only when it is — so a line reduced by
the pack's aggregate cap cannot carry a line-level cap reason without
either losing its `ALLOW_CAPPED` verdict or being forced to `FLAG`, which
would drop its reduced amount out of `draftBaseline` entirely (AC-11) and
silently change the computed fee. `MatterFlagCode` had no cap member, so
there was nowhere to put ENGINE-07's "flag that the cap bit" instead. D-11
resolves this by giving the notice a matter-level home. **PRD §6.0 lists
`AGGREGATE_CAP_APPLIED` among the line-level `FlagReasonCode` values, and it
stays there unmoved** — this is an additive sibling at matter level, not a
relocation, and Phase 1's bidirectional refinement on
`AssessmentLineSchema.superRefine` is unchanged: a non-FLAG line with a
flag reason still fails to parse, and a FLAG line with no reason still
fails to parse, both re-proven by `primitives.test.ts` in the same commit
that added the new code.

**D-12 — `TotalsSchema` (`assessment.ts`) gains an optional
`flatFeeComparison` field**, typed as a new `FlatFeeComparisonSchema`
(`z.strictObject` with `flatFeeAmount: Minor`,
`itemisedDirectCostAmount: Minor`, `flatFeeExceedsItemisedCost: boolean`,
no currency sub-field). The gap: ENGINE-16 requires the engine to compute
and report a comparison between the pack's flat figure and itemised direct
cost, but the frozen `Totals` had no field to write that answer into.
**"Itemised direct cost" means `draftBaseline`** — this reading is Phase
2's, not the PRD's (PRD §8.1 step 6 names no flat-fee field at all), and is
grounded in `rule-pack.ts`'s `FlatFeeSchema` module note: a flat figure
cannot be shown to stay below direct cost without an itemised baseline to
compare it against, and `draftBaseline` is exactly that baseline — the
itemised allowable total before any lawyer disposition. The field is
**optional, not nullable-required**, following the `RulePack.flatFee`
precedent (PACK-12/D-02) exactly: a pack with no flat fee omits the key
entirely, so every existing `Totals` JSON is literally unchanged and every
pre-existing six-key `Totals` assertion in the repository keeps passing.

Both changes reach the generated JSON Schema artifacts —
`packages/schemas/schema/assessment.schema.json` moved with the source
(`assessment-line.schema.json` and `expense-line.schema.json` did not,
since neither `AssessmentLineSchema` nor `ExpenseLineSchema` reaches
`MatterFlagCode` or `Totals`) — regenerated via `pnpm schema:json` and
verified byte-identical to a fresh generation by the existing drift test
(`json-schema.test.ts`).

## Post-freeze amendment: `rule-pack.ts` gains `StubConstraintsSchema` and `LoadableRulePackSchema` (D-18, D-09, Phase 3 plan 03-01)

Two additive exports landed in Phase 3 (plan 03-01), decided by the product
owner at the 03-CONTEXT.md D-18 gate (2026-09-16) and confirmed by planning
decisions PD-1/PD-2 (`.planning/phases/03-rule-packs-and-pack-admin/03-01-PLAN.md`).
**D-09 is the authority under which both are permitted without escalation**:
neither `RulePackSchema` nor `RulePackConstraintsSchema` is renamed, retyped
or removed — `StubConstraintsSchema` is a brand-new type, and
`LoadableRulePackSchema` is `RulePackSchema.extend({ constraints:
StubConstraintsSchema })`, additive by construction.

**`StubConstraintsSchema`** carries the same eleven keys as
`RulePackConstraintsSchema`, in the same order, each wrapped in
`.nullable()`. D-18's reasoning: the frozen schema's booleans are
non-nullable with no defaults specifically so an authored pack cannot
silently inherit a permissive `true` — but that left no way to express "not
yet researched" for the seven unauthored stub jurisdictions. `null` means
not researched; `false` means researched and negative; the two are never
collapsed.

**`LoadableRulePackSchema`** is the primary shape every committed pack
parses as (the loader's one parse boundary, `packages/rulepacks/src/
loader.ts`). The frozen `RulePackSchema` is demoted to the narrowed,
ACTIVE-ready variant `packages/engine` consumes — since
`StubConstraintsSchema` is a strict superset of `RulePackConstraintsSchema`,
re-parsing with the untouched frozen schema is what refuses any pack still
carrying a `null` constraint at the ACTIVE gate (plan 03-03).

## Post-freeze amendment: `FlatFeeSchema` gains `verificationNote` (D-22, D-09, Phase 3 plan 03-05)

One additive field landed in Phase 3 (plan 03-05), decided by the product
owner at the 03-CONTEXT.md D-22 gate (2026-09-16). **D-09 is the authority
under which this is permitted without escalation**: `FlatFeeSchema.
verificationNote` is a new required-but-nullable key on `FlatFeeSchema`,
itself already Phase 1 invention (see that schema's own module note) rather
than a PRD §7.2 transcription — so this widening is additive to an
already-additive type. No frozen field anywhere in `rule-pack.ts` is
renamed, retyped or removed.

**`FlatFeeSchema.verificationNote`** (`z.string().nullable()`, positioned
immediately after `verificationStatus`) is field-for-field the same shape as
`CategoryRuleSchema.verificationNote`, already frozen and already nullable.
The gap: D-15's `UNAUTHORED_TOKEN` channel exists for every `CategoryRule`,
but `FlatFeeSchema` had no comparable field, so HK's flat fee (PRD §7.5 —
advisory prose only, no figure) had no way to say "structure authored,
figure not" — the only alternatives were inventing a number (forbidden by
D-14) or leaving the field silently absent (indistinguishable from an
oversight). This closes that gap.

**`RulePack.flatFee` remains optional** (`FlatFeeSchema.optional()` on
`RulePackSchema`, unchanged by this amendment) — every pack that carries no
flat fee at all omits the key entirely, and its committed JSON is literally
unchanged by this widening. Only `HK-PDPO/2026.09.1.json` (plan 03-05) sets
`flatFee`; the other eight committed packs are untouched.

The two pre-existing `FlatFee` object literals in `packages/engine` —
`DEFAULT_FLAT_FEE` (`packages/engine/src/__fixtures__/flat-fee-pack.ts`) and
`SAMPLE_FLAT_FEE` (`packages/engine/src/flat-fee.test.ts`) — were updated in
the same commit to carry `verificationNote: null`, so both keep
type-checking against the widened shape.
`computeFlatFeeComparison` (`packages/engine/src/flat-fee.ts`) reads only
`flatFee.amount` and is unaffected. This widening reaches none of the three
committed JSON Schema artifacts under `packages/schemas/schema/` —
`toJsonSchemaArtifacts()` only ever generates from `AssessmentSchema`,
`AssessmentLineSchema` and `ExpenseLineSchema`, none of which reach
`FlatFeeSchema` — verified by the existing drift test
(`json-schema.test.ts`) and re-proven directly in `rule-pack.test.ts`.
