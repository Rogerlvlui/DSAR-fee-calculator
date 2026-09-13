# Phase 1: Schemas Freeze and Walking Skeleton - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 1-Schemas Freeze and Walking Skeleton
**Areas discussed:** Skeleton depth

---

## Gray areas offered

Four were presented; the user selected one to discuss.

| Area | Selected |
|------|----------|
| Skeleton depth — how much of the Prisma schema Phase 1 writes, and how thin "throwaway-thin" is | ✓ |
| Zod authoring shape — zod-first vs types-first, and where `.parse()` runs | |
| How you become a user — stubbed identity ergonomics behind ACCESS-06 | |
| Standing test harnesses — how AC-05/AC-06/ACCESS-08 enumerate artifacts so later phases are auto-covered | |

---

## Skeleton depth

### Q1 — How much of the Prisma schema does Phase 1 write?

| Option | Description | Selected |
|--------|-------------|----------|
| All six entities | Matter, ExpenseLine, Assessment, AssessmentLine, RulePackVersion, AuditEvent all modelled and migrated in Phase 1. DB freeze rides along with the type freeze; Phases 2–7 add data and routes, never tables. Strongest read of SC#1, and the four parallel phases never collide on migrations. Cost: Assessment's shape is committed before `assess()` has run. | ✓ |
| Matter + AuditEvent + User only | Literal minimum for one guarded route per role area and one audit round-trip. Genuinely throwaway. Cost: Phase 4 needs Assessment to exist to test in-place recompute and the SIGNED_OFF trigger, so it inherits migration work while running parallel with 3 and 5 on the same schema file. | |
| Everything Phase 4 needs | Matter, Assessment, AssessmentLine, AuditEvent, User — but not ExpenseLine detail or RulePackVersion. Unblocks the parallel phases without pre-committing what the engine and pack loader are still shaping. Cost: two of four parallel phases still write migrations. | |

**User's choice:** All six entities.
**Notes:** Recorded in CONTEXT.md as D-01 with a `one-way` reversibility rating. The accepted trade-off — committing to `Assessment`/`AssessmentLine` before the engine exists — is stated explicitly as D-03, mitigated by the additive-only rule (Q4) and by PRD §14's reference fixture, which already pins the expected `Assessment` field-by-field.

---

### Q2 — What do the three skeleton routes actually do?

| Option | Description | Selected |
|--------|-------------|----------|
| Guard probes only | Three route handlers calling `requireRole()`, returning typed JSON `{ok, role, user}`. No Prisma read. AUDIT-02 round-trip proven separately by a testcontainers integration test. Smallest throwaway surface; nothing proves guard and Prisma-as-`dsar_runtime` work together over HTTP. | |
| Read per area + POST that audits | `/hr/matters`, `/legal/queue`, `/admin/rulepacks` each read through Prisma as `dsar_runtime`; one POST creates a DRAFT matter and emits MATTER_CREATED. Proves guard → Prisma → runtime role → audit write end to end over real HTTP. The three list surfaces are Phase 3/5/6 deliverables anyway, so part survives. | ✓ |
| Read per area, audit via test | Three reads over HTTP, no write route; audit round-trip and the UPDATE-fails assertion live in the integration test. Avoids building a matter-creation endpoint Phase 5 will rewrite. | |

**User's choice:** Read per area + POST that audits.
**Notes:** Recorded as D-04. D-05 preserves the scope discipline: the POST is a bare typed endpoint, not Phase 5's intake form — no disclosure shell, capability statement, status strip, repeater or autosave. Phase 5 is expected to rewrite it.

---

### Q3 — Which database-level invariants land with the six tables?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit GRANT/REVOKE only | Two roles plus REVOKE UPDATE/DELETE/TRUNCATE on the audit table. Every other invariant written by its home phase. Keeps Phase 1's migration honest. Cost: tables exist for several phases unconstrained, so a Phase 2/3/5 bug can write a state the type system forbids. | |
| Everything the frozen types imply | Audit GRANT/REVOKE, plus MatterStatus as a real Postgres enum (STATE-01), the currency = JURISDICTION_CURRENCY check constraint (AC-42's second layer), and no cascade deletes near audit or signed-off rows (PRD §15). SIGNED_OFF immutability trigger stays Phase 4 — it needs the assessment lifecycle to be meaningful. | ✓ |
| Every invariant including sign-off | All of the above plus the SIGNED_OFF immutability trigger. Maximum hardening up front; the trigger ships untested until Phase 4. | |

**User's choice:** Everything the frozen types imply.
**Notes:** Recorded as D-06, with D-07 holding the SIGNED_OFF trigger in Phase 4. The stated principle — "if a rule is derivable from a frozen type, it lands with the freeze" — is captured in CONTEXT.md `<specifics>`. D-08 (fail fast on boot when `SELECT current_user` returns `dsar_migrator`) was carried in from the stack research, since the migrator/runtime split is silently unenforced otherwise.

---

### Q4 — What happens when a later phase finds a frozen type is wrong?

| Option | Description | Selected |
|--------|-------------|----------|
| Change it, but record it | Later phases may change a frozen type or migration, but must append to `packages/schemas/CHANGELOG.md` and log it in PROJECT.md Key Decisions. Makes PRD §16's "the schema was wrong and that is worth knowing early" the standing rule. | |
| Additive-only after freeze | Later phases may add optional fields and new tables; never rename, retype or remove a frozen one. Any breaking change escalates to the product owner before the phase continues. Strongest protection for four concurrent phases sharing one `schema.prisma`. Cost: a genuinely wrong early type gets worked around instead of fixed. | ✓ |
| Freeze is advisory | Normal engineering; ordinary review catches problems. Lowest ceremony. Cost: with 2/3/4/5 concurrent, a silent retype in one breaks the other three's assumptions until merge. | |

**User's choice:** Additive-only after freeze.
**Notes:** Recorded as D-09. D-10 names the accepted cost and keeps the recording instinct from the rejected option: the escape valve is escalation, not a quiet workaround, and an escalation under this rule *is* PRD §16's early-warning signal firing — so its outcome belongs in PROJECT.md's Key Decisions table.

---

## Claude's Discretion

The user chose not to discuss three areas. They fall to Claude, grounded in the PRD and the stack research already locked in `.claude/CLAUDE.md`:

- **Zod authoring shape** — zod-first vs types-first; where `.parse()` runs given the 100ms/50-line engine budget; and specifically how to express PRD §6.0's `Condition.field: keyof ExpenseLine | keyof Matter`, which has no clean zod form.
- **Stubbed identity ergonomics** — how a developer selects who they are behind ACCESS-06's swappable provider. Shapes every Playwright test and demo from Phase 5 onward.
- **Standing test harnesses** — how AC-05, AC-06 and ACCESS-08 enumerate generated artifacts so routes and fields added in Phases 3–8 are covered without editing the test.

## Deferred Ideas

- SIGNED_OFF immutability trigger (STATE-04, AC-33) → Phase 4
- Disclosure shell, capability statement, status strip (DISC-01..03) → Phase 5
- Real intake form, validation, autosave (INTAKE-01..09) → Phase 5
- Rule-pack loader, validator and authored content (PACK-01..12) → Phase 3
- Corporate SSO / IdP group role assignment → out of scope for the milestone (PROJECT.md)
