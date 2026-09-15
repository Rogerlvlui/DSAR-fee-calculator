---
phase: "2"
slug: "deterministic-fee-engine"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-16"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time across all seven `02-0*-PLAN.md` `<threat_model>`
> blocks and deduplicated here; verified retroactively at ASVS L1 grep depth
> against the executed implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| caller → `assess()` | A `Matter`/`ExpenseLine[]`/`RulePack` may have been mapped from a Postgres row without passing back through zod. The engine treats its own arguments as untrusted and re-checks the invariants a wrong fee would rest on. | Matter metadata, claimed cost lines, rule pack — no requestor personal data (NS-4) |
| `assess()` → `Assessment` | The engine's output becomes the record a lawyer signs. Anything wrong here is wrong in a legal work product, not merely in a UI. | Verdicts, money totals, flag text |
| repository source → CI | The determinism guarantee is a property of the source tree, asserted before deploy. A gate reporting zero problems is indistinguishable from a gate inspecting nothing unless observed firing. | Source, lint/cruise gate results |
| `packages/engine` → `packages/schemas` | A legitimate dependency that nonetheless contains one module (`money.ts`) whose behaviour is locale- and float-dependent. | Type imports, `MinorSchema` |
| host environment → engine output | A timezone or locale difference between a developer machine, CI and a pilot host must not change a computed fee. | `TZ`, locale |
| rule pack data → `assess()` | A pack is authored data, not code. A structurally valid but semantically impossible combination must be refused, not interpreted. | Pack JSON |
| engine-authored text → the legal work product | Every string the engine writes ends up in a document a lawyer signs. | Flag and rationale strings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-2-01 | Tampering | money arithmetic (`totals`/`apply-cap`/`aggregate-cap`) | high | mitigate | Integer `Minor` only. Every arithmetic division in the package is `Math.floor((a * b) / c)` — multiply before divide, floored once. Verified: zero `Math.round` in executable source (the only textual hits are comments forbidding it); `totals.ts` performs no division at all | closed |
| T-2-02 | Tampering | `totals.ts` aggregate sums | high | mitigate | `MinorSchema.parse()` round-trip on computed totals (6 call sites) turns a silent 32-bit overflow into a thrown bound error at the point of computation | closed |
| T-2-03 | Information Disclosure | engine-authored language | high | mitigate | `engine-language.test.ts` checks every message export against a shared banned-word constant on word boundaries, with a control string proving the matcher fires | closed |
| T-2-05 | Spoofing | `preconditions.ts` | high | mitigate | Six independent checks, each throwing rather than degrading: `PACK_NOT_ACTIVE`, `PACK_PAST_REVIEW_DUE`, `CONTROLLER_TYPE_NOT_IN_SCOPE`, `CURRENCY_MISMATCH`, `CLAIMED_AMOUNT_MISMATCH`, `NEGATIVE_UNIT_RATE` — all six confirmed present | closed |
| T-2-06 | Repudiation | `assess.ts` identity derivation | medium | mitigate | Identity derived deterministically as `assessment:{matter.id}:{pack.packId}:{pack.version}:{now}` (`assess.ts:49`), so a re-run is checkable against the audit record | closed |
| T-2-07 | Tampering | engine determinism | high | mitigate | Zero occurrences of `new Date`/`Date.now`/`Math.random`/`Intl.`/`toLocale`/`require(`/node-builtin imports in engine production source. Statically gated by ESLint (passing) and proven at runtime by `purity.tz.test.ts` | closed |
| T-2-08 | Tampering | ESLint flat-config rule resolution | high | mitigate | `MONEY_BRAND_SELECTORS` lifted out and spread into both config entries (3 references in `eslint.config.js`), so the engine-scoped entry cannot silently disarm AC-07a | closed |
| T-2-09 | Tampering | `packages/schemas/src/money.ts` reachability | medium | mitigate | `no-money-formatting-in-engine` rule present in `.dependency-cruiser.cjs`; cruise reports zero violations over 81 modules / 188 dependencies | closed |
| T-2-10 | Repudiation | gate integrity | high | mitigate | Every gate ships with a violating fixture and an assertion observing the catch — `purity-gate.test.ts` carries two explicit "gate proven to fire" cases, both green | closed |
| T-2-11 | Tampering | `AssessmentLineSchema.superRefine` | high | mitigate | Refinement retained (not relaxed) under D-11's additive change | closed |
| T-2-12 | Tampering | `TotalsSchema` shape | medium | mitigate | `z.strictObject` rejects an undeclared key rather than archiving it; comparison block optional so no existing consumer breaks | closed |
| T-2-13 | Repudiation | freeze record | medium | mitigate | `packages/schemas/FREEZE.md` amendment names both changes and both decision IDs (D-11/D-12) | closed |
| T-2-14 | Tampering | generated JSON Schema artifacts | medium | mitigate | `packages/schemas/src/json-schema.test.ts` byte-for-byte drift test, so a source change skipping regeneration fails rather than shipping a stale constraint | closed |
| T-2-15 | Tampering | `PER_MATTER` cap on a single rule | medium | mitigate | Typed error rather than silent per-line misapplication | closed |
| T-2-16 | Elevation of Privilege | posture gate | high | mitigate | Exhaustive switch with a `never` exhaustiveness guard, so a later posture addition is a compile error rather than a silent fall-through into the permitting branch | closed |
| T-2-17 | Tampering | `AssessmentLineSchema` refinement | medium | mitigate | Every test-constructed line parsed through the frozen schema | closed |
| T-2-18 | Repudiation | golden fixture regeneration | high | mitigate | Zero snapshot matchers in `reference-fixture.golden.test.ts` — literal expected values compared with `toEqual`, so a changed pack breaks its golden file instead of being regenerated over | closed |
| T-2-19 | Tampering | cross-line check thresholds | high | mitigate | Every threshold PRD-specified (40%) or pack-authored (`rateSanityCeiling`); D-13 keeps the unauthored check out of the engine entirely | closed |
| T-2-20 | Tampering | duplicate detection | medium | mitigate | Fixed normalised-exact-match rule; no similarity score, no tunable threshold | closed |
| T-2-21 | Tampering | silent adjustment | high | mitigate | No check writes a non-zero `engineAmount`; a tripped check flips the verdict so removal is visible in `flaggedTotal` | closed |
| T-2-22 | Information Disclosure | engine-authored flag messages | medium | mitigate | All templates confined to `messages.ts`, enumerated against the banned-word list | closed |
| T-2-23 | Repudiation | `matterFlagRules` evaluation | high | mitigate | An unrecognised `when` shape throws rather than being skipped, so a pack-authored warning cannot silently never fire | closed |
| T-2-24 | Elevation of Privilege | acknowledgement requirements | high | mitigate | Taken from the rule rather than defaulted, with a false case asserted, so an informational flag cannot become a sign-off blocker or vice versa | closed |
| T-2-25 | Tampering | flat-fee comparison point | medium | mitigate | Computed after every step that can move `draftBaseline`, covering the aggregate-cap-reduced case | closed |
| T-2-26 | Tampering | flat fee substituting for the baseline | high | mitigate | Engine writes only the comparison block; `draftBaseline` and `finalAmount` asserted unchanged, keeping the choice with the lawyer at sign-off | closed |
| T-2-27 | Tampering | matter-flag ordering | low | mitigate | Declared order constant asserted stable across repeated runs | closed |
| T-2-28 | Denial of Service | performance budget | medium | mitigate | Median-of-twenty after warm-up rather than a single run, with a retained control test proving the harness can still fail | closed |
| T-2-SC | Tampering | package-manager installs | low | accept | See Accepted Risks Log | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-2-SC | T-2-SC | Phase 2 installs no new third-party runtime package. Verified against `packages/engine/package.json`: the sole runtime dependency is `@dsar/schemas` at `workspace:*`, and the sole devDependency is `fast-check` at the exact root-pinned `4.10.0` — matching the disposition's stated bound precisely. `tests/toolchain/pins.test.ts` fails any ranged or prerelease version anywhere in the workspace | Plan authors, phase 02 (all seven plans) | 2026-09-16 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-16 | 28 | 28 | 0 | `/gsd-secure-phase 02` (Claude Opus 5) |

**Method.** Register deduplicated from the `<threat_model>` blocks of all seven phase-02
plans — several threats (T-2-01, T-2-07, T-2-10, T-2-SC) were restated across multiple plans
and are carried once here at their highest stated severity. Classification ran at ASVS L1
grep depth against the executed implementation, which the workflow's short-circuit rule
deems sufficient given `register_authored_at_plan_time: true` and `asvs_level: 1`.

**Two register claims were checked rather than taken at face value, and both held:**

- T-2-01 states "flooring, never rounding", yet `Math.round` appears twice in
  `apply-cap.ts`. Both occurrences are comments *prohibiting* it; stripping comments leaves
  zero in executable source across the package.
- T-2-05 states "six independent precondition checks" while an initial pass matched only
  five named codes. The sixth is `NEGATIVE_UNIT_RATE`, present and throwing.

**One apparent determinism violation was run down and is deliberate.** A single
`new Date(2026, 0, 1).getTimezoneOffset()` occurs at `purity.tz.test.ts:89`. It is the
retained control assertion that T-2-07 and T-2-10 both explicitly require — the thing that
proves the timezone stub takes effect and that the deep-equality assertions are not passing
vacuously. It is test-only; engine production source is clean.

**Note on T-2-04.** The plan-time registers number their threats non-contiguously; no
`T-2-04` was authored in any of the seven blocks. Recorded here so a later reader does not
read the gap as a dropped threat.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
