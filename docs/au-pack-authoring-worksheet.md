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

Same taxonomy as the SG/HK packs. The OAIC extract only speaks clearly to a handful of
these — the rest are left as `FLAG`/`NEEDS_VERIFICATION` (i.e., unchanged from the current
stub) until you've read the primary source.

### `AU-PRIVACY-ACT.STAFF_TIME_SEARCH`
- **OAIC extract:** allowable cost — "staff costs for searching and retrieving personal information"
- **Proposed treatment:** `ALLOW` · **Confirm / change:** ______________
- **Proposed basis:** "Staff time searching for and retrieving the requested information is a cost of giving access, chargeable at a clerical rate."
- **Citation:** Privacy Act 1988, APP 12.8 · **Confirm / change:** ______________
- **Rate standard note:** the extract states clerical-rate staff time is chargeable for tasks "clerical staff can perform (such as photocopying, printing, collating and posting documents)" — search/retrieval itself isn't explicitly named as clerical-rate work in the extract; confirm which rate applies here specifically.

### `AU-PRIVACY-ACT.STAFF_TIME_COLLATE`
- **OAIC extract:** allowable cost — "staff costs for reproducing and sending information"; clerical rate expressly named for "photocopying, printing, collating and posting"
- **Proposed treatment:** `ALLOW` · **Confirm / change:** ______________
- **Proposed basis:** "Compiling, reproducing and sending the response is chargeable at a clerical rate."
- **Citation:** APP 12.8 · **Confirm / change:** ______________

### `AU-PRIVACY-ACT.STAFF_TIME_ASSESS_EXEMPTIONS`
- **OAIC extract:** does not name this cost directly. It does say "professional rates may apply when professionals review files before providing access" — that's about *rate*, not about whether the underlying time is chargeable at all. SG's own pack treats the equivalent category as the organisation's own compliance cost, not a service to the applicant — **worth checking whether OAIC draws the same line, or treats exemption-review as part of "giving access" and therefore chargeable at a professional rate.**
- **Proposed treatment:** ______________ (no proposal — genuinely ambiguous on this extract alone)
- **Your basis:** ________________________________________________

### `AU-PRIVACY-ACT.PROFESSIONAL_REVIEW`
- **OAIC extract:** "Professional rates may apply when professionals review files before providing access."
- **Proposed treatment:** `ALLOW` · **Confirm / change:** ______________
- **Proposed basis:** "Professional review of files before access is given may be charged at a professional rate."
- **Citation:** APP 12.8 (rate guidance) · **Confirm / change:** ______________
- ⚠ Needs the actual rate figure or method — not in the extract.

### `AU-PRIVACY-ACT.PHOTOCOPY_PRINT` / `POSTAGE_COURIER`
- **OAIC extract:** allowable cost — "postage or material costs"; clerical rate for photocopying/printing/posting
- **Proposed treatment:** `ALLOW` (possibly `ALLOW_WITH_CAP`, matching SG's per-page approach) · **Confirm / change:** ______________
- **Proposed basis:** "Reproduction and postage/material costs actually incurred, charged at a clerical rate."
- **Citation:** APP 12.8 · **Confirm / change:** ______________
- ⚠ Per-unit figure (if capping) not in the extract — same open question as SG's PHOTOCOPY_PRINT (whose cost rates feed this).

### `AU-PRIVACY-ACT.OTHER_UNCLASSIFIED`
- **Treatment:** `FLAG` — fixed in every pack, not yours to change (AC-19), same as every other jurisdiction.
- **Basis:** you may still word this one. **Your text:** ________________________________________________

### The remaining 15 categories

Not addressed by the fetched extract at all. Left as `FLAG`/`NEEDS_VERIFICATION`
(unchanged from the current stub) until read against APP 12 and the OAIC APP Guidelines
Chapter 12 directly — the "excessive charge" factors (org size/resources, nature of
information held, and legal-advice/system-deficiency costs being excessive) are the
operative test to reason each of them against, per the extract.

---

## Part 5 — Open questions this worksheet raises

1. **Is this in scope for v1 at all**, or does AU stay a stub alongside the other six
   non-HK/SG jurisdictions until a later milestone? (See the note at the top.)
2. **The excessive-charge test cuts against several categories that HK/SG allow.** The
   extract is explicit that "legal advice costs for deciding how to respond" are an
   example of an *excessive* charge — this may mean `STAFF_TIME_ASSESS_EXEMPTIONS` (or
   whichever category captures exemption/redaction-decision time) should lean toward
   `DISALLOW`, similar to SG's own treatment of that category, but for a textually
   different reason (excessiveness, not "not a service to the applicant"). Worth deciding
   deliberately rather than copying SG's disposition for a different rationale.
3. **Whose cost rates feed a clerical/professional rate distinction here**, if a per-unit
   cap is added — same open question PRD §17 raises for Singapore's `rateSanityCeiling`.
4. **The OAIC APP Guidelines Chapter 12 page the PRD actually cites has not been read in
   this pass.** It is the more authoritative, more granular source than the general
   "dealing with requests" page fetched here, and should be the next thing read before
   any of the "no proposal" rows above are filled in.

---

## When you're done

Same as the SG worksheet: hand this back filled in, in any form. It becomes
`AU-PRIVACY-ACT/2026.09.1.json`'s authored content against the frozen `RulePack` schema,
and golden-file fixtures pin the exact values afterward.

**Minimum to promote AU out of stub status:** Part 1, a decision on Part 2's agency/
organisation split, and Part 3's constraints. Part 4's remaining 15 categories can follow.
