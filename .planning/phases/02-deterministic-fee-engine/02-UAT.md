---
status: testing
phase: 02-deterministic-fee-engine
source: [02-VERIFICATION.md]
started: 2026-09-15T14:01:58Z
updated: 2026-09-15T14:01:58Z
---

## Current Test

number: 1
name: Legal-correctness of the PRD §14 reference fixture
expected: |
  Counsel confirms or corrects the fixture's proposed treatments — in particular that
  STAFF_TIME_ASSESS_EXEMPTIONS is DISALLOW, and that the 40% materiality threshold and
  the rateSanityCeiling figures are the right policy thresholds.
awaiting: user response

## Tests

### 1. Legal-correctness of the PRD §14 reference fixture
expected: Counsel (per docs/sg-pack-authoring-worksheet.md) confirms or corrects the fixture's proposed treatments, specifically that STAFF_TIME_ASSESS_EXEMPTIONS is DISALLOW and that the 40% materiality / rateSanityCeiling figures are the right policy thresholds. The arithmetic is machine-verified by the golden test; whether the underlying legal position is defensible is a legal judgment. Explicitly deferred by the plan authors themselves (02-04-PLAN.md's own human-check block).
result: [pending]

### 2. WR-02 scope decision — PERMITTED_NARROW_EXCEPTION missing its mandated matter-level flag
expected: A decision recorded — either a follow-up fix or an explicit deferral with reasoning — matching the D-11/D-12/D-13 pattern this phase already established. PRD §6.0 (docs/PRD-dsar-fee-agent.md:415) requires that this posture "carries a mandatory matter-level flag naming the exception"; no such code path exists in matter-flags.ts. A matter under this posture currently produces every line DISALLOW with no accompanying notice, indistinguishable from plain PROHIBITED. Low current impact (no jurisdiction pack in the Phase 3 roadmap uses this posture; reserved for a future EU/GDPR-shaped pack, NS-10 out of scope), but it is a literal unaddressed PRD requirement, not a judgment call.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
