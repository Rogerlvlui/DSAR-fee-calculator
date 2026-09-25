# SG-PDPA rule pack — authoring worksheet

**For:** the named authoring counsel (Roger Lui)
**Feeds:** PACK-09, `packages/rulepacks/SG-PDPA/2026.09.1.json` (Phase 3)
**Status as of Phase 7 (2026-09-22): still open.** `authoredBy`/`reviewedBy`/`reviewedOn`
are still `null` in the committed pack, and all six rules below are still
`NEEDS_VERIFICATION` — none of this worksheet's proposals have been confirmed or changed
yet. This no longer blocks the built demo (the app coerces an in-memory copy to `ACTIVE`
regardless — see `docs/DEMO-WALKTHROUGH.md`), but it does block the pack from ever
reaching a real `ACTIVE` status, which is what a pilot needs.

Pre-populated from PRD §7.6, which drafts the SG posture, constraints, instruments and six of the twenty-one category rules. **Your job is to confirm or change, not to draft from zero.** PRD Annex B is explicit that its source checks are "the starting point for the authoring lawyer, not a substitute for that lawyer."

---

## Part 1 — Identity (3 fields, blocks the build)

`prisma`-side validation hard-fails at **build time**, not runtime, if any of these is null (PACK-03, AC-38). Nothing activates without them.

| Field | Value | Notes |
|---|---|---|
| `authoredBy` | ________________________ | Name + qualification, e.g. "R. Lui, Advocate & Solicitor (Singapore)" |
| `reviewedBy` | ________________________ | May be the same person — PROJECT.md records the author/reviewer overlap as intentional for HK and SG |
| `reviewedOn` | ________ / ________ / 2026 | Date you signed off |
| `reviewDueOn` | currently **2027-03-12** (from §7.6) | Past this date the pack goes STALE: new matters in SG are refused with 409, in-flight reviews continue under a notice (AC-39). Change if you want a different review cadence |

---

## Part 2 — The six demo rules

These six are exactly the PRD §14 reference fixture, which is what the demo will show. Each needs four decisions from you.

**Constraint on `basis` text:** ≤240 characters, plain language, shown to the reviewing lawyer beside every line. The words **compliant, legal, lawful, approved, safe** are rejected by pack validation (PACK-11 / AC-32a) — the build fails. A `basis` says what the rule provides; it does not pronounce on legality.

**On `verificationStatus`:** `NEEDS_VERIFICATION` is not a hedge — it is load-bearing. Such a line renders distinctly, feeds the `restingOnUnverifiedRules` subtotal shown under `draftBaseline`, and is excluded from bulk-accept (AC-26). A `NEEDS_VERIFICATION` `ALLOW` is a visible, quantified, individually-dispositioned proposal. `VERIFIED` means you are prepared to stand behind it without that caveat.

> **To reproduce the §14 fixture exactly** (`restingOnUnverifiedRules` = 106.40 = 80.00 + 26.40), `STAFF_TIME_SEARCH` must be **VERIFIED** and `STAFF_TIME_COLLATE` + `PHOTOCOPY_PRINT` must remain **NEEDS_VERIFICATION**. If you decide differently, that is fine and the demo still works — but tell me, because the golden-file expectations change with it.

### 1. `SG-PDPA.STAFF_TIME_SEARCH`
- **Proposed treatment:** `ALLOW` · **Confirm / change to:** ______________
- **Proposed basis:** "Locating and retrieving the requested data is a service provided to the applicant to enable the organisation to respond."
- **Your basis (if changing):** ________________________________________________
- **Citation:** PDP Regulations 2021, reg. 7 · **Confirm / change:** ______________
- **verificationStatus:** ☐ VERIFIED  ☐ NEEDS_VERIFICATION → *fixture expects VERIFIED*
- **Cap:** none proposed · **Add one?** ______________

### 2. `SG-PDPA.STAFF_TIME_COLLATE`
- **Proposed treatment:** `ALLOW` · **Confirm / change to:** ______________
- **Proposed basis:** "Compiling and paginating the response is likewise such a service."
- **Your basis (if changing):** ________________________________________________
- **Citation:** reg. 7 · **Confirm / change:** ______________
- **verificationStatus:** ☐ VERIFIED  ☐ NEEDS_VERIFICATION → *fixture expects NEEDS_VERIFICATION*
- **Cap:** none proposed · **Add one?** ______________

### 3. `SG-PDPA.STAFF_TIME_ASSESS_EXEMPTIONS`
- **Proposed treatment:** `DISALLOW` · **Confirm / change to:** ______________
- **Proposed basis:** "Time assessing whether an exception applies is the organisation's own compliance cost, not a service provided to the applicant."
- **Your basis (if changing):** ________________________________________________
- **Citation:** reg. 7 · **Confirm / change:** ______________
- **verificationStatus:** ☐ VERIFIED  ☐ NEEDS_VERIFICATION
- *This is the rule the demo leans on hardest — it is the one that visibly strikes a line. Worth the most attention.*

### 4. `SG-PDPA.PHOTOCOPY_PRINT`
- **Proposed treatment:** `ALLOW_WITH_CAP` · **Confirm / change to:** ______________
- **Proposed cap:** `PER_UNIT`, **12 minor units per PAGE** (S$0.12/page) · **Your figure:** ________
- **Proposed basis:** "Reproduction at a standard per-page rate not exceeding the entity's actual direct cost."
- **Your basis (if changing):** ________________________________________________
- **verificationStatus:** ☐ VERIFIED  ☐ NEEDS_VERIFICATION → *fixture expects NEEDS_VERIFICATION*
- ⚠ **The per-page figure is entity-specific** — PRD §17 q.4 asks whose cost rates feed this and who maintains them. That question is still open. The fixture assumes S$0.12; if your entity's real figure differs, the demo's numbers change and that is fine, but I need the figure.

### 5. `SG-PDPA.VENDOR_PAYROLL`
- **Proposed treatment:** `ALLOW_IF` · **Confirm / change to:** ______________
- **Proposed conditions:** `isThirdPartyInvoiced` is true **AND** `evidenceRef` is not null
- **Confirm / change conditions:** ________________________________________________
- **Proposed basis:** "Out-of-pocket charge paid to a third party for data the employer does not hold, where invoiced and evidenced."
- **Your basis (if changing):** ________________________________________________
- **verificationStatus:** ☐ VERIFIED  ☐ NEEDS_VERIFICATION
- *In the fixture this line FLAGs, because the sample data has `isThirdPartyInvoiced: false` and no `evidenceRef` — the conditions are not met. That is the rule working, not failing.*

### 6. `SG-PDPA.OTHER_UNCLASSIFIED`
- **Treatment:** `FLAG` — **fixed in every pack, not yours to change** (AC-19). An unclassified line always flags, whatever the pack or the description says.
- **Basis:** you may still word this one. **Your text:** ________________________________________________

---

## Part 3 — Matter-level flags (3 drafted, confirm)

These show on every SG matter regardless of the lines claimed. Confirm the wording is right, and whether each should require explicit acknowledgement before sign-off.

| Flag | Drafted message (abridged) | Confirm? | Requires acknowledgement? |
|---|---|---|---|
| `SG.WRITTEN_ESTIMATE` | A written estimate must be given before the fee is charged; a further estimate is required if the eventual fee will exceed it | ☐ | ☐ yes ☐ no |
| `SG.RESPOND_30_DAYS` | Respond within 30 days; if not possible, notify in writing of the time by which a response will be provided | ☐ | ☐ yes ☐ no |
| `SG.NOT_A_DETERRENT` | The fee must be reasonable and must not discourage the applicant; the Commission may review its reasonableness | ☐ | ☐ yes ☐ no |

---

## Part 4 — The remaining 15 categories (full PACK-09 only, NOT needed for the demo)

An **ACTIVE** pack must carry all 21 or the build fails (AC-10, AC-38). These 15 are not drafted in the PRD. They are not on the demo path — Phase 3.1 only exercises the six above — so they can follow the presentation.

Same four decisions each: treatment, cap, basis, citation, plus `verificationStatus`.

`STAFF_TIME_REDACT_THIRD_PARTY` · `STAFF_TIME_REDACT_EXEMPT` · `STAFF_TIME_LEGAL_REVIEW` · `PROFESSIONAL_REVIEW` · `MEDIA_MATERIALS` · `POSTAGE_COURIER` · `SECURE_TRANSFER` · `IT_EXTRACTION` · `VENDOR_ARCHIVE` · `VENDOR_OTHER` · `TRANSLATION` · `TRANSCRIPTION_CONVERSION` · `IDENTITY_VERIFICATION` · `ADMIN_OVERHEAD` · `RECORDS_REMEDIATION`

The operative wording to reason against, per §7.6, is reg. 7's *"services provided … to enable the organisation to respond"* limb — the line between a service to the applicant and the organisation's own compliance cost. That distinction is what decides most of the fifteen.

---

## Part 5 — Two open questions the PRD raises for you

Neither blocks the demo, but both are recorded as unresolved and will surface eventually.

1. **PRD §17 q.4 — whose cost rates feed the sanity ceilings, and who maintains them?** §7.6 currently proposes `rateSanityCeiling` of ADMIN 3000, EXECUTIVE 5000, MANAGER 9000 (minor units per hour, i.e. S$30/S$50/S$90). Confirm or replace. These do not cap a fee — they raise a `RATE_ABOVE_EXPECTED` flag for the reviewing lawyer.
2. **§7.6's own `openQuestions`**, which ship inside the pack: whether staff time is costed at incremental cost or a loaded charge-out rate (*"a loaded rate with a profit element is not defensible"* — and `profitElementPermitted` is already `false`), and whether any part of a claim relates to assessing exceptions rather than providing access.

---

## When you're done

Hand this back filled in — markdown, Word, or just the answers in a message; any form works. I'll turn it into `SG-PDPA/2026.09.1.json` against the frozen `RulePack` schema during Phase 3, and the golden-file fixtures will then pin these exact values so a later edit to the pack breaks its tests rather than silently changing a fee.

**Minimum for the demo:** Part 1, plus Parts 2 and 3. Part 4 can wait until after the presentation.
