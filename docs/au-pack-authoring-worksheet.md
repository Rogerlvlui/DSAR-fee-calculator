# AU-PRIVACY-ACT rule pack — authoring worksheet (draft)

**For:** the named authoring counsel (Roger Lui)
**Feeds:** `packages/rulepacks/AU-PRIVACY-ACT/2026.09.1.json` — currently a correct-posture
**stub**: `status: "DRAFT"`, all 21 categories `FLAG`/`NEEDS_VERIFICATION`, `authoredBy` /
`reviewedBy` / `reviewedOn` all `null`.

**This is a scope question before it is a content question.** The PRD and README currently
treat Australia as one of the seven v1 stub jurisdictions — only Hong Kong and Singapore
are "worked" packs in v1 (PRD §7.4, README's Jurisdictions table). Promoting AU to a third
fully-authored jurisdiction is a v1 scope change, not just filling in a form. Worth
deciding explicitly — this worksheet exists so there is something concrete to decide
against, not as a signal the decision has already been made.

**Provenance of the content below — read this before anything else.**
- Content under "OAIC extract" was pulled by an AI-assisted fetch of the OAIC page
  *"Dealing with requests for access to personal information"* — an AI paraphrase, not a
  direct quote. Superseded where the AU source quote below covers the same ground.
- Content under "AU source quote" is text you pasted directly on 2026-09-23, confirmed as
  coming from that same OAIC page — a more literal, more reliable rendering of it, and the
  basis for the confirmed calls in Part 4 (STAFF_TIME_ASSESS_EXEMPTIONS in particular).
- **Neither source is the primary legal text.** Nothing below has been cross-checked
  against the Privacy Act 1988 (Cth), Schedule 1, APP 12 itself, or against the OAIC's own
  *APP Guidelines* Chapter 12 (`oaic.gov.au/.../chapter-12-app-12-access-to-personal-information`)
  — the more granular source the PRD actually cites at §7.4's Australia row. OAIC's own
  guidance page is a reasonable secondary source for policy content, but the exact APP 12
  pinpoint citations still need verifying against the Act's own text before `ACTIVE`.

Treat every remaining proposed (not yet confirmed) value below exactly as the SG worksheet
treats its own proposals: **a starting point for you to confirm or change.** Items marked
"confirmed" above have your explicit sign-off already, via direct conversation on
2026-09-23 — but even those still need the citation pinpoint nailed down before this pack
can reach `ACTIVE`.

---

## Part 1 — Identity (3 fields, blocks the pack reaching ACTIVE)

| Field | Value | Notes |
|---|---|---|
| `authoredBy` | ________________________ | Name + qualification |
| `reviewedBy` | ________________________ | May be the same person, per this project's existing convention for HK/SG |
| `reviewedOn` | ________ / ________ / 2026 | |
| `reviewDueOn` | ________ / ________ / 2027 | Suggest 12 months from `reviewedOn`, matching the SG/HK convention (PRD §7.3 default) |

---

## Part 2 — Fee posture (already drafted in the stub — confirm, don't re-derive)

The stub pack already carries this split posture, matching PRD §7.4's Australia row:

```json
"feePosture": {
  "PRIVATE_ORGANISATION": "PERMITTED_NOT_EXCESSIVE",
  "PUBLIC_AGENCY": "PROHIBITED"
}
```

**OAIC extract, on the agency/organisation split:** *"You must not charge an individual for
making a request to access personal information"* (cited by the fetch as APP 12.8 — verify
the pinpoint). The extract's "Permission to Charge" section describes only an
"organization['s]" ability to charge; it does not describe the public-sector position at
all — the `PROHIBITED` value for `PUBLIC_AGENCY` in the stub reflects the PRD's own separate
reading (APP 12.7's agency-specific language), not anything in the fetched page. **This is
exactly the kind of gap a single guidance page leaves — confirm the agency/organisation
split against APP 12.7 and 12.8 directly, not against this extract alone.**

- Confirm / change `PRIVATE_ORGANISATION`: ______________
- Confirm / change `PUBLIC_AGENCY`: ______________

---

## Part 3 — Constraints (`RulePackConstraintsSchema`, 11 fields — all currently `null`)

| Field | OAIC extract says | Proposed value | Your confirm / change |
|---|---|---|---|
| `noChargeForMakingRequest` | "You must not charge an individual for **making** a request" | `true` | ______ |
| `estimateRequiredBeforeCharging` | Not addressed in the fetched extract | *no proposal — needs primary-source check* | ______ |
| `feeNotificationDeadlineDays` | Not addressed | *no proposal* | ______ |
| `deadlineBasis` | Not addressed | *no proposal* | ______ |
| `responseDeadlineDays` | Not addressed (APP 12's "reasonable period" is a separate provision from the fee rules; the SG/NZ packs both treat response timing as its own researched field — don't infer a number from this extract) | *no proposal* | ______ |
| `advancePaymentPermitted` | Not addressed | *no proposal* | ______ |
| `mayWithholdDataUntilPaid` | Not addressed | *no proposal* | ______ |
| `profitElementPermitted` | Implied against: the extract lists "legal advice costs for deciding how to respond" and "system deficiencies" as examples of an **excessive** charge — suggests no margin/inefficiency loading, consistent with SG/HK's existing `false` | `false` | ______ |
| `deterrentUsePermitted` | Not addressed directly, but the "not excessive" standard and the alternatives-first steer ("consider cheaper access methods") both point the same way as SG's `NOT_A_DETERRENT` flag | *proposed:* `false` | ______ |
| `regulatorMayReviewFee` | Not stated explicitly on this page, but OAIC's general complaint jurisdiction over APP compliance would likely extend to a fee dispute — this is an inference, not a citation | *no proposal — needs confirmation of the actual complaint/review mechanism* | ______ |
| `aggregateCap` | Not addressed | *no proposal* | ______ |

---

## Part 4 — Category rules (21 required for `ACTIVE`; six shown here as a starting subset)

Same taxonomy as the SG/HK packs. **Update 2026-09-23:** you pasted a more complete, more
literal quote of what looks like the same OAIC source (below, "AU source quote"). It's more
authoritative than the earlier AI-paraphrased extract — treat it as the working text — but
it's still not a citation until you confirm which page/instrument it's actually from (see
the question at the end of this section). Everything not covered by it is still left as
`FLAG`/`NEEDS_VERIFICATION` (unchanged from the stub) until you've read the primary source.

> **AU source quote (pasted by you, 2026-09-23):** *"...an organisation may charge for
> providing you access, but this charge can't be excessive. The organisation must tell you
> there's a charge and explain the reasons for it. The charge may include the cost of:
> staff searching for, locating and retrieving the requested information, and deciding
> which personal information is relevant to the request; staff reproducing and sending the
> personal information; the postage or materials involved in giving access; using an
> intermediary, if necessary."*

### `AU-PRIVACY-ACT.STAFF_TIME_SEARCH`
- **AU source quote:** confirms — "staff searching for, locating and retrieving the requested information"
- **Proposed treatment:** `ALLOW` · **Confirm / change:** ______________
- **Proposed basis:** "Staff time searching for and retrieving the requested information is a cost of giving access."
- **Citation:** OAIC guidance, *"Dealing with requests for access to personal information"*, read against Privacy Act 1988 (Cth), APP 12 (pinpoint TBC — see citation note below) · **Confirm / change:** ______________

### `AU-PRIVACY-ACT.STAFF_TIME_ASSESS_EXEMPTIONS` — **resolved 2026-09-23**
- **AU source quote:** the same sentence as STAFF_TIME_SEARCH above continues "...**and deciding which personal information is relevant to the request**" — named in the *same* allowable-cost clause as search/locate/retrieve, not carved out.
- **Confirmed by you:** this is the same decision as the schema's exemption/withholding analysis, not a narrower "scoping" question. **This is the opposite treatment from SG's equivalent category** (SG: `DISALLOW`, the organisation's own compliance cost, not a service to the applicant). Recorded here as a deliberate, confirmed cross-jurisdiction difference — not an inconsistency to "fix" later.
- **Treatment:** `ALLOW` — **confirmed**.
- **Basis:** "Deciding which personal information is relevant to the request, including what may be withheld, is a cost of giving access under Australian guidance — unlike Singapore's treatment of the equivalent decision as the organisation's own compliance cost."
- **Citation:** OAIC guidance, *"Dealing with requests for access to personal information"* (charging section), read against Privacy Act 1988 (Cth), APP 12.8 — pinpoint APP 12 provision to be confirmed against the Act's own text before `ACTIVE` (see citation note below).

### `AU-PRIVACY-ACT.STAFF_TIME_COLLATE`
- **AU source quote:** confirms — "staff reproducing and sending the personal information"
- **Proposed treatment:** `ALLOW` · **Confirm / change:** ______________
- **Proposed basis:** "Compiling, reproducing and sending the response is a cost of giving access."
- **Citation:** OAIC guidance, *"Dealing with requests for access to personal information"*, read against APP 12 (pinpoint TBC) · **Confirm / change:** ______________

### `AU-PRIVACY-ACT.PHOTOCOPY_PRINT` / `POSTAGE_COURIER`
- **AU source quote:** confirms — "the postage or materials involved in giving access"
- **Proposed treatment:** `ALLOW` (possibly `ALLOW_WITH_CAP`, matching SG's per-page approach) · **Confirm / change:** ______________
- **Proposed basis:** "Postage and material costs actually incurred in giving access."
- **Citation:** OAIC guidance, *"Dealing with requests for access to personal information"*, read against APP 12 (pinpoint TBC) · **Confirm / change:** ______________
- ⚠ Per-unit figure (if capping) not in the source text — same open question as SG's PHOTOCOPY_PRINT (whose cost rates feed this).

### A category not yet identified — "using an intermediary, if necessary"
- **AU source quote:** this is a fourth allowable cost head with no obvious home in the
  existing subset above. It doesn't map to `PROFESSIONAL_REVIEW` (nothing here mentions a
  professional/rate distinction — that line from the earlier AI-fetched extract is not
  repeated in your pasted text, so treat it as unconfirmed rather than assume it still
  holds). It may belong under one of the 15 categories not yet drafted here (candidates:
  `IDENTITY_VERIFICATION`, `ADMIN_OVERHEAD`, or a vendor/third-party category) — worth
  identifying which once you're working through the remaining 15.

### `AU-PRIVACY-ACT.OTHER_UNCLASSIFIED`
- **Treatment:** `FLAG` — fixed in every pack, not yours to change (AC-19), same as every other jurisdiction.
- **Basis:** you may still word this one. **Your text:** ________________________________________________

### The remaining ~14 categories

Still not addressed by any source text seen so far. Left as `FLAG`/`NEEDS_VERIFICATION`
(unchanged from the stub) until read against APP 12 and the OAIC APP Guidelines Chapter 12
directly — "not excessive" (org size/resources, nature of information held) is the
operative test to reason each of them against.

### New constraint signal from your pasted text: a notification requirement

*"The organisation must tell you there's a charge and explain the reasons for it"* — this
doesn't map cleanly onto any single one of the 11 `RulePackConstraintsSchema` fields (it's
closer to `feeNotificationDeadlineDays`/`deadlineBasis` than the others, but those fields
expect a deadline, and this text states an obligation with no stated timeframe). Confirm
whether AU has an actual deadline for this notice (like SG's written-estimate requirement)
or whether it's an unqualified "must explain" duty with no clock attached — that changes
which field(s) this becomes.

---

## Part 5 — Open questions this worksheet raises

1. **Is this in scope for v1 at all**, or does AU stay a stub alongside the other six
   non-HK/SG jurisdictions until a later milestone? (See the note at the top.)
2. ~~What is the exact source of your pasted quote~~ — **answered 2026-09-23:** the OAIC
   "Dealing with requests for access to personal information" guidance page (same one
   fetched earlier, just quoted more literally by you). Citations above now name that page
   plus the underlying APP 12 provision it interprets — the remaining gap is the exact APP
   12 pinpoint (12.7 vs 12.8 vs a sub-paragraph), which is guidance-page shorthand, not
   something OAIC's own guidance text spells out. Confirm the pinpoint against the Privacy
   Act 1988 (Cth) itself before `ACTIVE`.
3. ~~The `STAFF_TIME_ASSESS_EXEMPTIONS` categorisation call~~ — **answered 2026-09-23:**
   confirmed as the same decision as the schema's exemption/withholding analysis. `ALLOW`
   for AU, a deliberate, confirmed difference from SG's `DISALLOW` on the equivalent
   category — see Part 4 above.
4. **Whose cost rates feed a clerical/professional rate distinction here**, if a per-unit
   cap is added — same open question PRD §17 raises for Singapore's `rateSanityCeiling`. Your
   pasted text doesn't distinguish a clerical vs. professional rate at all (unlike the
   earlier, now-superseded AI-fetched extract) — confirm whether that distinction exists in
   AU or was an artifact of the earlier bad source.
5. **"Using an intermediary" has no category home yet** — see Part 4's note above.

---

## When you're done

Same as the SG worksheet: hand this back filled in, in any form. It becomes
`AU-PRIVACY-ACT/2026.09.1.json`'s authored content against the frozen `RulePack` schema,
and golden-file fixtures pin the exact values afterward.

**Minimum to promote AU out of stub status:** Part 1, a decision on Part 2's agency/
organisation split, and Part 3's constraints. Part 4's remaining 15 categories can follow.
