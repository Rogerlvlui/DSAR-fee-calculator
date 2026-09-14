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
