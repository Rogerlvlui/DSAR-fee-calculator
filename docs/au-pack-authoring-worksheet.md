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

**Provenance of the content below — read this before anything else.** Everything under
"OAIC extract" was pulled by an AI-assisted fetch of one OAIC guidance page
(`oaic.gov.au/.../dealing-with-requests-for-access-to-personal-information`), *not* by
reading the primary sources. It has **not** been cross-checked against:
- the Privacy Act 1988 (Cth), Schedule 1, APP 12 itself: the operative legal text;
- the OAIC's own *APP Guidelines* Chapter 12 (`oaic.gov.au/.../chapter-12-app-12-access-to-personal-information`) — the source the PRD actually cites at §7.4's Australia row, which is a different page from the one just fetched and has not been checked at all in this pass.

Treat every proposed value below exactly as the SG worksheet treats its own proposals:
**a starting point for you to confirm or change, never a substitute for you reading the
primary source.** Nothing here should be transcribed into the pack without that reading.

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
- **Citation:** Privacy Act 1988, APP 12 (pinpoint TBC — see the citation question below) · **Confirm / change:** ______________

### `AU-PRIVACY-ACT.STAFF_TIME_ASSESS_EXEMPTIONS` — **this is the one that changed**
- **AU source quote:** the same sentence as STAFF_TIME_SEARCH above continues "...**and deciding which personal information is relevant to the request**" — named in the *same* allowable-cost clause as search/locate/retrieve, not carved out.
- **This resolves the ambiguity the worksheet flagged, but resolves it the opposite way from SG.** SG's own pack treats the equivalent category (time spent deciding what to withhold) as the organisation's own compliance cost, `DISALLOW`. This AU text puts "deciding what's relevant" in the *same allowable clause* as searching and retrieving — textually, `ALLOW`, not `DISALLOW`.
- ⚠ **One thing worth your own read before locking this in:** "deciding which personal information is **relevant to the request**" (scoping — is this document part of what was asked for) may not be the same decision as "deciding what may be **withheld/exempted**" (redaction — should this document be given at all). The PRD's `STAFF_TIME_ASSESS_EXEMPTIONS` category is named for the latter. If the source is only talking about scoping, it may not license charging for exemption-analysis time at all — the schema doesn't have a separate "scoping" category, so this is a real categorisation call, not a formality.
- **Proposed treatment:** `ALLOW` **if** "relevant to the request" reading covers exemption/withholding analysis in your judgment; otherwise this category should stay closer to SG's `DISALLOW` and a new note added explaining AU's "relevant to the request" language is being read narrowly. **Your call:** ______________
- **Your basis:** ________________________________________________

### `AU-PRIVACY-ACT.STAFF_TIME_COLLATE`
- **AU source quote:** confirms — "staff reproducing and sending the personal information"
- **Proposed treatment:** `ALLOW` · **Confirm / change:** ______________
- **Proposed basis:** "Compiling, reproducing and sending the response is a cost of giving access."
- **Citation:** APP 12 (pinpoint TBC) · **Confirm / change:** ______________

### `AU-PRIVACY-ACT.PHOTOCOPY_PRINT` / `POSTAGE_COURIER`
- **AU source quote:** confirms — "the postage or materials involved in giving access"
- **Proposed treatment:** `ALLOW` (possibly `ALLOW_WITH_CAP`, matching SG's per-page approach) · **Confirm / change:** ______________
- **Proposed basis:** "Postage and material costs actually incurred in giving access."
- **Citation:** APP 12 (pinpoint TBC) · **Confirm / change:** ______________
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
2. **What is the exact source of your pasted quote** — a URL, a named OAIC page, or the APP
   Guidelines Chapter 12 itself? The pack's `citation` field needs an instrument + provision
   (e.g. "Privacy Act 1988, APP 12.8"), not a paraphrase, and right now every citation in
   Part 4 above reads "pinpoint TBC" because the quote alone doesn't carry a section number.
3. **The `STAFF_TIME_ASSESS_EXEMPTIONS` categorisation call above** — whether "deciding
   what's relevant to the request" (your source's words) is the same decision as "deciding
   what may be withheld" (the schema category's meaning). This is the single highest-impact
   open item: it flips one category between `ALLOW` and `DISALLOW`, and SG's pack currently
   disagrees with a literal reading of your AU text on this exact point.
4. **Whose cost rates feed a clerical/professional rate distinction here**, if a per-unit
   cap is added — same open question PRD §17 raises for Singapore's `rateSanityCeiling`. Your
   pasted text doesn't distinguish a clerical vs. professional rate at all (unlike the
   earlier, now-superseded AI-fetched extract) — confirm whether that distinction exists in
   AU or was an artifact of the earlier bad source.
5. **"Using an intermediary" has no category home yet** — see Part 4's note above.
6. **The OAIC APP Guidelines Chapter 12 page the PRD actually cites** may or may not be
   where your pasted quote came from (see question 2) — worth confirming either way before
   this worksheet's citations are treated as final.

---

## When you're done

Same as the SG worksheet: hand this back filled in, in any form. It becomes
`AU-PRIVACY-ACT/2026.09.1.json`'s authored content against the frozen `RulePack` schema,
and golden-file fixtures pin the exact values afterward.

**Minimum to promote AU out of stub status:** Part 1, a decision on Part 2's agency/
organisation split, and Part 3's constraints. Part 4's remaining 15 categories can follow.
