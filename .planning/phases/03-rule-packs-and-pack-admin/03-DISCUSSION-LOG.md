# Phase 3: Rule Packs and Pack Admin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 3-Rule Packs and Pack Admin
**Areas discussed:** Who drafts the 42 rule bodies, Stub pack invented values

**Areas offered but not selected:** Phase shape vs. missing infra, Where the gates run — both recorded as Claude's Discretion in CONTEXT.md with the constraints that bound them.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Phase shape vs. missing infra | SC-4 needs an `apps/web` that doesn't exist; SC-5 needs Docker, still absent. Scaffold, defer, or split to 3.2? | |
| Who drafts the 42 rule bodies | PRD gives HK's extract and 5 of 21 SG rules; ~37 have no source | ✓ |
| Stub pack invented values | Seven stubs need 11 non-nullable booleans, a `rateSanityCeiling` and 147 rules the PRD never specifies | ✓ |
| Where the gates run | "The build fails, not the runtime" — but no pack build step exists. Plus: is STALE derived or stored? | |

---

## Who drafts the 42 rule bodies

### Q1 — How do the ~37 unwritten HK and SG rule bodies get authored?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts, you review in batches | Claude proposes treatment + basis + citation for each missing category from the PRD only; product owner reviews category by category. Fastest to the 3.1 demo; risks rubber-stamping | |
| You author both packs; Claude builds the scaffold | 42 rule objects with TODO markers that fail validation, plus loader/validator/tests. Honest provenance; demo blocked until the §14 six are filled | |
| Hybrid: PRD-sourced now, rest by you | Claude authors only what the PRD specifies as real content; the rest ship as unauthored placeholders that block ACTIVE | ✓ |

**User's choice:** Hybrid — PRD-sourced now, rest by the product owner.
**Notes:** The deciding property is the provenance line — every committed rule traces to a PRD sentence. Consistent with PRD §7.5's own instruction not to ship an unnamed lawyer's confidence, and with PRD M2's treatment of a near-zero lawyer change rate as a failure signal.

### Q2 — How does a rule declare itself unauthored, given the frozen schema can't gain a new field?

| Option | Description | Selected |
|--------|-------------|----------|
| Sentinel `ruleId` prefix | e.g. `SG-PDPA.UNAUTHORED.TRANSLATION`; validator refuses ACTIVE on the prefix. Machine-checkable, shows in the admin diff. Cost: `ruleId` doubles as a status marker | |
| Empty `basis` is the tell | Validator requires a non-empty basis and citation on all 21 before ACTIVE. No convention to remember. Cost: relies on nobody typing filler | |
| `verificationNote` carries the marker | A fixed `UNAUTHORED` token plus the §7.4 note for that jurisdiction; ACTIVE gate refuses any pack still holding one | ✓ |

**User's choice:** `verificationNote` carries the marker.
**Notes:** Raised in the question and confirmed by the choice — `treatment: FLAG` + `NEEDS_VERIFICATION` is a *legitimate* authored outcome (AC-19's `OTHER_UNCLASSIFIED` is exactly that in every pack), so the marker had to live somewhere that carries no authored meaning of its own. `verificationNote` is already the PRD's channel for instructions to counsel and is already surfaced on the review screen.

### Q3 — What does "HK and SG reach ACTIVE" mean at the end of this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism proven; packs ship DRAFT | Activation path proven by a test fixture; real packs stay DRAFT. Matches PRD §7.5's stated day-one behaviour. Cost: SC-2 as worded not met | |
| Phase blocks until you author both packs | All 42 rules written, both packs genuinely ACTIVE. Matches SC-2 exactly. Cost: phase completion = legal-drafting throughput; demo waits | |
| SG authored to demo scope, both ACTIVE at Phase 6 | SG's six §14-fixture categories now; full authoring tracked as an explicit obligation discharged before Phase 6's convergence gate | ✓ |

**User's choice:** SG authored to demo scope; both ACTIVE at Phase 6.
**Notes:** This question was dismissed on first ask and re-put unchanged. Chosen because it names where the debt is paid rather than leaving SC-2 quietly unmet, while keeping Phase 3's completion off the critical path of legal drafting.

### Q4 — Whose identity goes in SG-PDPA's `authoredBy`/`reviewedBy` when it reaches ACTIVE?

| Option | Description | Selected |
|--------|-------------|----------|
| Seeded prototype user, stable ULID | Fixed ULID in the seed script, `displayName` naming the product owner as authoring counsel, non-routable `example.invalid` address | ✓ |
| Your real name and email, committed | Maximum defensibility from day one, nothing to swap later. Cost: a personal email in repository JSON and in every internal-record PDF | |
| Real name, organisational address | Genuine attribution without a personal mailbox in committed files. Needs an address to be supplied | |

**User's choice:** Seeded prototype user with a stable ULID.
**Notes:** Pack JSON and the seeded `User` rows agree by construction, and Phase 3.2's Prisma seed gets a stable target. Accepted cost recorded: the committed address is deliberately fake and must be swapped before a pilot. Author/reviewer overlap here is the intended arrangement, not a conflict; PACK-07 / AC-41a's same-editor gate still applies in full.

---

## Stub pack invented values

### Q1 — How do the seven stubs express a constraint nobody has researched?

| Option | Description | Selected |
|--------|-------------|----------|
| Most-restrictive defaults, flagged as unauthored | Unknown booleans take the least-permitting value; pack-level marker says none of it is a determination. Cost: a committed boolean still reads like a position | |
| Escalate — the freeze is wrong here | Treat as D-09's escape valve; make constraints nullable or add an unresearched marker. Cost: re-opens a freeze mid-phase while Phases 4 and 5 run against it | |
| Stubs carry only posture; no constraints block | Nothing unresearched ever asserted. Cost: two pack shapes through the loader and the admin screen | ✓ |

**User's choice:** No constraints block — superseded by Q2 below.
**Notes:** Claude flagged after the answer that this reads against **PACK-10** ("correct posture and constraints") and **PRD §7.4** ("correct constraints skeleton"), and put the conflict back rather than resolving it silently.

### Q2 — What does "constraints skeleton" mean here?

| Option | Description | Selected |
|--------|-------------|----------|
| Keys present, every value `null` | `StubConstraints` with all eleven fields present, typed `boolean\|null`, set to `null` = not researched. Satisfies PACK-10 literally; one field list for all nine packs; no null constraint may reach ACTIVE | ✓ |
| Absence is the skeleton — reword PACK-10 | Keep Q1's answer and correct REQUIREMENTS.md, recorded as a deliberate departure. Cost: two pack shapes, and a requirement edited mid-milestone | |
| Values null, but three exceptions asserted | The three constraints §7.4 states for all nine regimes asserted; the rest null. Cost: three booleans that are inference, not determination | |

**User's choice:** Keys present, every value `null`.
**Notes:** Preserves the property the product owner was actually protecting — assert nothing unresearched — while satisfying PACK-10's wording without a requirement edit. No REQUIREMENTS.md change is needed as a result.

### Q3 — How do the 147 stub category rules get into the repository?

| Option | Description | Selected |
|--------|-------------|----------|
| Literal JSON, generated once by a script | Generator not part of the build; output committed. Cost: generator can drift from what's committed | |
| Generated at load from the taxonomy | No boilerplate in git. Cost: the repository stops being the literal source of truth §7.3 says it is | |
| Literal JSON, with a test that regenerates and compares | Byte-equality drift test, mirroring Phase 1's JSON Schema artifact pattern. Committed truth stays authoritative; drift fails CI | ✓ |

**User's choice:** Literal JSON with a regenerate-and-compare drift test.
**Notes:** The cost Claude named on selection — the test must stop guarding a file once counsel authors real content into it — became Q4.

### Q4 — How does a stub file get released from the drift test?

| Option | Description | Selected |
|--------|-------------|----------|
| The `UNAUTHORED` marker is the scope | Guard only rules still carrying the token; a rule leaves scope when counsel writes real reasoning. One marker governs two gates | |
| Pack status is the scope | Guard only DRAFT packs with `authoredBy: null`. Cost: all-or-nothing per pack | |
| An explicit opt-out list | A checked-in manifest of guarded files. Cost: a second place to keep in sync | |

**User's choice:** No preference — left to Claude.
**Notes:** Recorded in CONTEXT.md under Claude's Discretion with a leaning toward the `UNAUTHORED` marker, on the grounds that Phase 1 lost four gates to the "two places that must agree" failure mode.

---

## Claude's Discretion

- **Drift-test release mechanism** (explicit "no preference") — leaning to scoping by the `UNAUTHORED` marker.
- **Phase shape vs. missing infrastructure** (area not selected) — no `apps/web`, no Docker; bounded in CONTEXT.md so no success criterion is silently dropped and PACK-06's DB enforcement is deferred explicitly to Phase 3.2 if deferred at all.
- **Where the build-time gates run, and whether STALE is derived or stored** (area not selected) — bounded by Phase 2's "every gate ships with a fixture proving it fires".
- **PRD-resolvable details** — empty `rateSanityCeiling` for stubs; `NO_EXPRESS_AUTHORITY` for unresearched public-agency postures per §7.4's HK convention; empty `requestorNoticeTemplate` on a stub.

## Deferred Ideas

No scope creep arose — the discussion stayed inside the phase boundary throughout. Items carried forward are scheduling, not new capability:

- Full HK and SG authoring across all 21 categories → discharged before Phase 6's convergence gate.
- PACK-06's database-level enforcement → Phase 3.2 if it cannot be completed here; never marked done on a service-layer substitute.
- PACK-08's sign-off-side block → Phase 7, already the roadmap's position.
- The remaining seven packs' authoring → V2-PACK-01, each gated on named local counsel.
- Swapping the seeded prototype identity for real counsel details → before a pilot, not before the demo.
