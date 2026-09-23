# Demo walkthrough — HR intake through sign-off

A presenter's script for the stakeholder demo: what to type, in what order, and the exact
figure to expect at each stage, so it is obvious the moment something has gone wrong.

This walks the full built pipeline (Phases 1–7): HR intake, legal review, sign-off, and
outputs, running the real `packages/engine` against the real committed Singapore pack.
Start the app first — see the README's [Running the demo](../README.md#running-the-demo)
section for the one command, the prerequisites, and what this build honestly is not yet
(no persistent data, draft rule packs, stubbed identity — the audit backbone, sign-off
gate, and internal-record PDF are all real and wired in, as of Phase 4 and Phase 7
respectively).

There is no database, no Docker and no network involved anywhere below. Restarting the
server, or saving a source file while `pnpm dev` is running, loses everything typed in —
that is expected, not a bug.

## The six reference cost lines

These are PRD §14's reference fixture, transcribed at
`apps/web/src/server/__fixtures__/reference-fixture.ts` and reproduced through the real
HTTP path in `tests/routes/reference-fixture.test.ts` and `tests/routes/walkthrough.test.ts`.
The intake screen's "Fill in the example rows" control (see the note at the foot of this document)
types exactly these six rows for you.

| # | Category | Description | Quantity | Unit | Rate |
|---|----------|--------------|----------|------|------|
| 1 | Staff time — locating and retrieving the data | Staff time locating and retrieving the requested personnel records | 4 | Hours | SGD 40.00 |
| 2 | Staff time — collating, copying, compiling the response | Staff time compiling and paginating the response bundle | 2 | Hours | SGD 40.00 |
| 3 | Staff time — deciding what may be withheld | Staff time deciding which items may be withheld under an exemption | 3 | Hours | SGD 40.00 |
| 4 | Photocopying and printing | Photocopying the paginated response for physical delivery | 220 | Pages | SGD 0.15 |
| 5 | Third-party payroll or tax-records vendor charge | Vendor extract of historical payroll and tax records from archive | 3 | Items | SGD 150.00 |
| 6 | Something else (always referred to Legal) | Miscellaneous cost not covered by any other category | 1 | Fixed | SGD 45.00 |

Total claimed: **SGD 888.00** (16000 + 8000 + 12000 + 3300 + 45000 + 4500 minor units).

## The path

1. **Acknowledge the capability statement.** First screen load only, per browser — type
   "I understand" and continue.
2. **Create the matter** as HR. Use the default (Singapore-jurisdiction) reference; legal
   entity "Acme Pte Ltd"; controller type "Private organisation"; requestor class defaults
   to "Former employee". Check both "identity verified" and "scope clarified". Check
   **"This requestor is, to my knowledge, in a dispute or litigation with the company"** —
   this is what makes the sign-off step below show an acknowledgement to tick.
3. **Add the six rows** above (or use "Fill in the example rows" — see the note below).
4. **Submit to Legal.** HR is told it will not see a figure before a lawyer signs off, and
   the confirmation screen shows no figure.
5. **Switch to the legal identity** (the role switcher in the header — a cookie, not real
   authentication; the demo says so).
6. **Disposition each of the six lines**, one sample reason each (at least 10 non-whitespace
   characters — "ok" is refused):
   - Lines 1 and 2 (both supported): **Accept**.
   - Line 3 (not supported): **Accept** — the engine's own amount here is already zero.
   - Line 4 (capped): **Accept**.
   - Line 5 (flagged, the vendor line): **Allow at a reduced amount** — e.g. SGD 200.00.
   - Line 6 (flagged, unclassified): **Strike**.
7. **Acknowledge the dispute flag** in the sign-off panel, fill in a qualification (e.g.
   "Advocate & Solicitor, Singapore"), and **sign off**.
8. **Switch back to HR** and open the matter again: read the fee, the struck line's basis,
   and the draft notice.
9. **(Optional, Legal-only) Download the internal record.** Back in the legal identity,
   the signed-off matter now shows a "Download internal record (PDF)" trigger — this
   control only ever appears on `/legal/*`, and only once a matter is `SIGNED_OFF` or
   `CLOSED` (Phase 7). It opens the dense, ten-column line-item PDF with the matter, pack,
   flags and sign-off sections, and a page-repeating footer — the internal compliance
   record, never sent anywhere automatically (NS-3).

## Figures to expect at each stage

| Stage | What to look for |
|-------|-------------------|
| Intake, after all six rows | Claim footer reads **SGD 888.00**, labelled "not the fee" |
| Review, before any disposition | Totals rail: claimed **888.00**, supported **266.40**, not supported **126.60**, needs-your-decision **495.00** across **2 items**. Headline reads hidden, "6 lines still need your decision". Bulk-accept reads **(0)** and is disabled. |
| Review, after all six dispositions | Totals-rail headline reads "Not yet signed off" showing **SGD 266.40** — the engine's own supported-by-rules figure, not yet the lawyer's total; that number appears one panel below, in sign-off. The sign-off panel is now visible (it was not, before). |
| Sign-off panel | Accepted as assessed: **4**. Struck by you: **1**. Allowed by you: **1**. Final fee: **SGD 466.40**. |
| HR result, after sign-off | "Fee assessed: SGD 466.40", the reviewing lawyer's name, qualification and sign-off date; the struck line shown with its basis and no figure; the lawyer-allowed line shown at **SGD 200.00**, not the vendor's original claim |

The final figure (466.40) is the arithmetic of what the lawyer actually decided, not a
value the engine alone produced: 160.00 + 80.00 (the two accepted supported lines) + 0.00
(the accepted not-supported line) + 26.40 (the accepted capped line) + 200.00 (the
lawyer's own reduced allowance on the flagged vendor line) + 0.00 (the struck line). Note
the totals-rail headline does not track this arithmetic live — it shows the engine's own
draft figure until sign-off actually writes the final amount, so it is normal for it to
read a smaller number than the sign-off panel directly below it once the lawyer has
allowed extra on a flagged line.

## Three moments worth pausing on

These are the demonstration's actual argument, not incidental UI details:

1. **At intake, the running total is labelled a claim, not a fee.** "Total you are
   claiming — not the fee. Legal decides what can actually be charged, and will strike
   anything local law doesn't support." HR never computes anything; it only itemises.
2. **On the review screen, no final figure exists at all until the last line is decided.**
   Not hidden by a style rule — absent from the markup. The headline reads "— hidden —"
   and names how many lines still need a decision.
3. **The bulk-accept control reads zero, honestly, because no rule in this pack is
   verified yet.** The real, committed `SG-PDPA/2026.09.1.json` pack marks every relevant
   category rule `NEEDS_VERIFICATION` — this demo does not pretend otherwise by hard-coding
   a nonzero count the way an earlier mockup did.

## The "Fill in the example rows" control

The intake screen's expense-line repeater has a "Fill in the example rows" button. It populates
the six form inputs above and nothing else — no request is sent, no figure is computed. Every
number in the rest of this walkthrough still comes from the real engine, only after
"Submit to Legal" is pressed.
