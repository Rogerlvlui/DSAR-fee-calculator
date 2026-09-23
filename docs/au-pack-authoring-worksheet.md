# AU-PRIVACY-ACT rule pack — authoring worksheet (draft, minimal scope)

**For:** the named authoring counsel (Roger Lui)
**Feeds:** `packages/rulepacks/AU-PRIVACY-ACT/2026.09.1.json` — currently a correct-posture
**stub**: `status: "DRAFT"`, all 21 categories `FLAG`/`NEEDS_VERIFICATION`, `authoredBy` /
`reviewedBy` / `reviewedOn` all `null`.

**Scope, decided 2026-09-23: keep this simple.** AU is not part of Friday's demo (only SG
is) and is not being promoted to a fully-authored, `ACTIVE`-ready jurisdiction alongside
HK/SG. This worksheet now targets a **minimal authored subset**: the identity fields, the
fee-posture confirmation, and the ~4 categories we actually have real source text for.
The other ~17 categories stay exactly as they are in the stub — `FLAG`/`NEEDS_VERIFICATION`
— same as every other non-HK/SG jurisdiction. Nothing here is written to the actual pack
file yet; this is worksheet-only until you say otherwise.

**Sources used below:**
- The OAIC guidance page *"Dealing with requests for access to personal information"* —
  first an AI-paraphrased fetch, then a more literal quote you pasted directly on
  2026-09-23 (shown as "AU source quote"). The pasted version supersedes the paraphrase
  wherever they overlap.
- Neither is the primary legal text. The exact APP 12 pinpoint citation (12.7 vs 12.8 vs a
  sub-paragraph) isn't spelled out in the guidance page and hasn't been checked against the
  Privacy Act 1988 (Cth) itself — worth a quick confirm if this content ever needs to
  support real reliance, but not blocking for a minimal/demo-adjacent scope.

---

## Part 1 — Identity

| Field | Value |
|---|---|
| `authoredBy` | ________________________ |
| `reviewedBy` | ________________________ (may be the same person, per this project's existing convention) |
| `reviewedOn` | ________ / ________ / 2026 |
| `reviewDueOn` | ________ / ________ / 2027 (12 months from `reviewedOn`, matching SG/HK) |

---

## Part 2 — Fee posture (confirm)

```json
"feePosture": {
  "PRIVATE_ORGANISATION": "PERMITTED_NOT_EXCESSIVE",
  "PUBLIC_AGENCY": "PROHIBITED"
}
```

Your pasted source confirms the organisation side directly: *"an organisation may charge
for providing you access, but this charge can't be excessive."* It says nothing about
agencies — the `PROHIBITED` value for `PUBLIC_AGENCY` is carried over from the PRD's own
separate reading, not from anything fetched or pasted here.

- Confirm / change `PRIVATE_ORGANISATION`: ______________
- Confirm / change `PUBLIC_AGENCY`: ______________

---

## Part 3 — Constraints (minimal subset only — the rest stay `null`)

| Field | Value | Basis |
|---|---|---|
| `noChargeForMakingRequest` | `true` | Your source: "you must not charge... for making a request" is implicit in the posture above (organisations charge for *providing access*, not for the request itself) |
| `profitElementPermitted` | `false` | "can't be excessive" + no source basis for a margin |
| `deterrentUsePermitted` | `false` | Same "not excessive" standard |

Everything else (`estimateRequiredBeforeCharging`, `feeNotificationDeadlineDays`,
`deadlineBasis`, `responseDeadlineDays`, `advancePaymentPermitted`,
`mayWithholdDataUntilPaid`, `regulatorMayReviewFee`, `aggregateCap`) stays `null` for this
minimal pass — your source does mention a notification duty ("the organisation must tell
you there's a charge and explain the reasons for it") but gives no deadline, so there's
nothing concrete to put in `feeNotificationDeadlineDays` yet. Revisit if AU is ever promoted
beyond minimal scope.

---

## Part 4 — The four categories with real source text

> **Your pasted source:** *"...an organisation may charge for providing you access, but
> this charge can't be excessive... The charge may include the cost of: staff searching
> for, locating and retrieving the requested information, and deciding which personal
> information is relevant to the request; staff reproducing and sending the personal
> information; the postage or materials involved in giving access; using an intermediary,
> if necessary."*

| Category | Treatment | Basis | Citation |
|---|---|---|---|
| `STAFF_TIME_SEARCH` | `ALLOW` | Staff time searching for and retrieving the requested information is a cost of giving access | OAIC guidance, *"Dealing with requests for access to personal information"*, read against Privacy Act 1988 (Cth) APP 12 |
| `STAFF_TIME_ASSESS_EXEMPTIONS` | `ALLOW` **(confirmed by you 2026-09-23 — deliberately opposite to SG's `DISALLOW` on the equivalent category)** | Deciding which personal information is relevant to the request, including what may be withheld, is a cost of giving access under AU guidance | Same as above |
| `STAFF_TIME_COLLATE` | `ALLOW` | Reproducing and sending the response is a cost of giving access | Same as above |
| `PHOTOCOPY_PRINT` / `POSTAGE_COURIER` | `ALLOW` | Postage and material costs actually incurred in giving access | Same as above |

Confirm / change any of the four: ________________________________________________

**"Using an intermediary"** is a fifth allowable-cost head in your source with no obvious
category home in the 21-category taxonomy — not authored here; revisit only if AU scope
ever expands.

**`OTHER_UNCLASSIFIED`** stays `FLAG` — fixed in every pack (AC-19), not yours to change.

---

## When you're done

Hand back Parts 1–4 filled in, any form. This stays worksheet-only — nothing gets written
into `AU-PRIVACY-ACT/2026.09.1.json` until you say so.
