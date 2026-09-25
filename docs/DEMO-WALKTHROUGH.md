# Demo walkthrough — HR intake through sign-off

A presenter's script for the stakeholder demo: what to type, in what order, and the exact
figure to expect at each stage, so it is obvious the moment something has gone wrong.

This walks the full built pipeline (Phases 1–7): HR intake, legal review, sign-off, and
outputs, running the real `packages/engine` against the real committed Singapore pack.
Start the app first — see the README's [Running the demo](../README.md#running-the-demo)
section for the one command, the prerequisites, and what this build honestly is not yet
(no persistent data, draft rule packs, stubbed identity — the audit backbone, sign-off
gate, and internal-record PDF are all real and wired in).

Every figure below is pinned by `tests/routes/demo-flow.test.ts`, which drives this exact
flow through the real HTTP routes and engine. If that test fails, this script is out of date.

There is no database, no Docker and no network involved anywhere below. Restarting the
server loses everything typed in — that is expected, not a bug.

**Present from the production build, not `pnpm dev`.** Straight after a restart, the dev
server compiles each page on its first visit and pushes a reload to every open tab — in
rehearsal that wiped the confirmation screen right after "Submit to Legal". The production
server has everything compiled in advance and never reloads. From the project folder:

```bash
pnpm.cmd --filter @dsar/web build
pnpm.cmd --filter @dsar/web start
```

(The build uses webpack, because Turbopack crashes on this machine; it takes about 30
seconds.) To empty the queue before presenting, stop the server (Ctrl+C) and run only the
second command again — no rebuild needed. Rebuild only after a code change. Close any other
`localhost:3000` tabs before you start.

## The claim

The six example rows come from PRD §14's reference fixture — "Fill in the example rows"
types them for you. The presenter then changes line 5 and types line 7 by hand, live.

| # | Category | Description | Qty | Unit | Rate | Source |
|---|----------|-------------|-----|------|------|--------|
| 1 | Staff time — locating and retrieving the data | Staff time locating and retrieving the requested personnel records | 4 | Hours | SGD 40.00 | example row |
| 2 | Staff time — collating, copying, compiling the response | Staff time compiling and paginating the response bundle | 2 | Hours | SGD 40.00 | example row |
| 3 | Staff time — deciding what may be withheld | Staff time deciding which items may be withheld under an exemption | 3 | Hours | SGD 40.00 | example row |
| 4 | Photocopying and printing | Photocopying the paginated response for physical delivery | 220 | Pages | SGD 0.15 | example row |
| 5 | Third-party payroll or tax-records vendor charge | Vendor extract of historical payroll and tax records from archive | 3 | Items | SGD 150.00 | example row, **then tick "Third-party invoiced?", vendor "Payroll Archive Services Pte Ltd", invoice/DMS reference "INV-2026-0417"** |
| 6 | Something else (always referred to Legal) | Miscellaneous cost not covered by any other category | 1 | Fixed | SGD 45.00 | example row |
| 7 | Something else (always referred to Legal) | Locksmith fee to open a locked filing cabinet holding the requested records | 1 | Fixed | SGD 60.00 | **typed live** |

Total claimed: **SGD 948.00**.

## The path

1. **From the landing page, "Continue as HR."** ("From cost claim to legal decision" — two
   cards, "Prepare a claim" and "Review a claim".)
2. **Acknowledge the capability statement** if it appears — shown once per role per
   browser. Type "I understand" and continue.
3. **Fill in matter details** (section 1): keep the default Singapore reference; legal
   entity e.g. "Acme Singapore Pte Ltd"; controller type "Private organisation"; the
   request-received date defaults to today. Point out that there is no field for the
   requestor's name or ID anywhere. Sections 2 and 3 appear once the legal entity is filled.
4. **Click "Fill in the example rows."** Six lines appear; the footer reads SGD 888.00.
5. **Line 5 — show evidence changing the outcome.** Tick **"Third-party invoiced?"**, enter
   vendor "Payroll Archive Services Pte Ltd" and invoice/DMS reference "INV-2026-0417".
6. **Add line 7 by hand — show HR choosing a category.** "+ Add a cost line", category
   **"Something else (always referred to Legal)"**. The hint appears: describe the cost,
   use a listed category if one fits (e.g. courier → "Postage, courier, delivery"), no
   names or addresses. Type "misc" first: the line shows "Required for 'Something else': at
   least 10 characters describing the cost (4 so far)" (and, once the attestations are
   ticked, Submit names this line as the blocker). Then replace it with the locksmith
   description above, quantity 1, rate 60.00. The footer now reads **SGD 948.00**.
7. **Tick the two required attestations** (section 3): identity verified; scope clear.
   Leave "known dispute or litigation" unchecked.
8. **Submit to Legal.** The confirmation reads "In Legal's review queue … no draft figure is
   shown here." Click **"Demo: switch to Legal queue"** (a cookie, not real authentication —
   the header says so) and open the matter.
9. **Decide each line.** The cards are not in line order: the three flagged lines come first
   (5, 6, 7), then 4, 3, 1, 2. A routine **Accept** needs no reason; the flagged lines and any
   departure from the engine's recommendation (Reduce, Strike, Allow anyway) need one of
   10+ characters.
   - Lines 1 and 2 (supported by rule): **Accept**.
   - Line 3 (not supported — the engine's amount is already zero): **Accept**.
   - Line 4 (capped at SGD 26.40): **Accept**.
   - Line 5 (flagged — **materiality only**): type a reason. Point out that **Allow is
     disabled** and the card reads "Enter an amount above 0.00 to allow. To charge nothing
     for this line, use Strike." Optionally type 0 to show it stays disabled. Then **type
     450.00** — the hint disappears and Allow enables — and click **Allow**.
   - Line 6 (flagged — the example's vague "Something else"): type a reason, **Strike**.
   - Line 7 (flagged — the locksmith line, HR's description quoted verbatim): type a
     reason, **type 60.00**, then **Allow**.

   Every undecided card with an amount box (Reduce, Allow, Allow anyway) shows that hint
   until an amount above 0.00 is typed — it does not stop Accept or Strike. Charging nothing
   is recorded as Strike (or Accept, on a not-supported line), never as an allowance or
   reduction of zero (PRD §6.4).
10. **Fill in a qualification** ("Advocate & Solicitor, Singapore") and click **"Sign off and
    release to HR."** The status changes in place to "Signed off — released to HR".
11. **Switch back to HR** (header role switcher → My matters → the matter): the assessed fee,
    the struck line's basis, and the draft notice marked "DRAFT — for HR to send" ("Send
    this yourself from your own mailbox. This tool does not email anyone.").
12. **(Optional, Legal only) Download the internal record.** Back as Legal, the signed-off
    matter shows "Download internal record (PDF)" — only on `/legal/*`, and only once a
    matter is signed off or closed. The dense line-item record with matter, pack, flags and
    sign-off sections; never sent anywhere automatically (NS-3).

## Figures to expect at each stage

| Stage | What to look for |
|-------|-------------------|
| Intake, after "Fill in the example rows" | Footer: **SGD 888.00**, "Claimed costs — not the assessed fee." |
| Intake, after line 7 | Footer: **SGD 948.00** |
| Review, before any decision | Totals: claimed **948.00**, supported by rules **266.40**, not supported **126.60**, needs your decision **555.00** across **3 items**. Headline: "7 lines need a decision. The recommended fee stays hidden until every line is decided." Bulk accept reads **(0)** and is disabled. |
| Review, every undecided card with an amount box | The Reduce / Allow / Allow anyway button is disabled, with "Enter an amount above 0.00 to reduce." (or "to allow" / "to allow anyway") and "To charge nothing for this line, use Strike." — "use Accept." on line 3, the not-supported line. |
| Review, line 5 card | "Why this needs you" lists **only** the materiality item — no "Conditions not met", because the invoice was ticked and referenced. |
| Review, after allowing line 5 at 450.00 | Totals rail: "Allowed by you, not by a rule" **SGD 450.00**. Following the step order (lines 1–4 already accepted), the headline reads "2 lines need a decision". |
| Review, line 7 card | "HR's description" quotes the locksmith text verbatim; the reason is "always referred to Legal for classification". |
| Review, after all seven decisions | "Every line has a decision. Review the totals before sign-off." The rail still shows the engine's own **SGD 266.40** "Not yet signed off" — the lawyer's figure is in the sign-off panel below. |
| Sign-off panel | Accepted as assessed **4**, Reduced by you **0**, Struck by you **1**, Allowed by you **2**. Final fee **SGD 776.40**. |
| HR result, after sign-off | "Fee assessed: SGD 776.40"; the reviewing lawyer's name, qualification and sign-off date (e.g. "on 25 Sep 2026"); line 6 struck, shown with its basis and no figure. |

**Final fee arithmetic:** 160.00 + 80.00 + 0.00 + 26.40 (four accepted lines) + 450.00 (vendor,
allowed by the lawyer) + 0.00 (struck) + 60.00 (locksmith, allowed by the lawyer) = **776.40**.
The engine alone would have recommended 266.40 — the other 510.00 exists only because a named
lawyer allowed it, and the sign-off records that.

## Moments worth pausing on

1. **At intake, the total is a claim, not a fee.** "Claimed costs — not the assessed fee." HR
   never computes anything; it only itemises.
2. **Evidence changes what Legal is asked.** Without the invoice, line 5 would read "Conditions
   not met: third-party invoice not confirmed; no invoice or DMS reference recorded." With it,
   only materiality remains — the engine lists exactly what is still unmet, nothing more.
3. **"Something else" is never scored.** The engine refuses to guess; Legal classifies it from
   HR's own words, which is why the form insists those words say something.
4. **No final figure exists on the review screen until the last line is decided** — absent from
   the markup, not hidden by a style rule.
5. **Bulk accept reads zero, honestly,** because no rule in the draft SG pack is verified yet.
6. **A routine Accept needs no reason; a departure always does.** The flagged lines always need
   one, because Legal is the first human judgement applied to them.
7. **The record says what the lawyer actually decided.** There is no "allowed at 0.00": a line
   that charges nothing is struck (or accepted, where the engine already said zero). The button
   refuses until there is a real amount, and the server refuses it too.

## Fallback: the six example rows only

If time is short, skip steps 5 and 6. Figures are then the reference fixture's, pinned by
`tests/routes/walkthrough.test.ts`: claimed **888.00**; supported **266.40**; not supported
**126.60**; needs your decision **495.00** across **2 items** (line 5 shows both "Conditions not
met" items and materiality). Allowing line 5 at 200.00 and striking line 6 gives a final fee of
**SGD 466.40**.
