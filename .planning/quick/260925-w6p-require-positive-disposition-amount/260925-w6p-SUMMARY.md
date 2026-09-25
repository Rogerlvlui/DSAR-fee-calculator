---
quick_id: "260925-w6p"
status: complete
---

# Summary: refuse a zero or empty amount on Allow / Allow anyway / Reduce

**Done.** Allow (FLAG), Allow anyway (DISALLOW) and Reduce (ALLOW/ALLOW_CAPPED) now require an
amount above zero, in the UI and on the server. The UI button stays disabled with the hint
"Enter an amount above 0.00 to allow. To charge nothing for this line, use Strike." ("…use
Accept." on a not-supported line). The server returns 400 with the same guidance for a missing,
zero, negative or non-integer amount. Product-owner decision recorded in the PLAN (PRD silent).
`docs/DEMO-WALKTHROUGH.md`'s warning about SGD 0.00 allowances updated to match.

**Verified:**
- `pnpm typecheck`, `pnpm lint`, `pnpm depcruise` — clean.
- `pnpm test` — 1107/1107 (includes the property tests that timed out under load on 2026-09-24).
- New tests: component (disabled + hint for "", "0", "0.00", "0.001", "-5", "abc" across all three
  actions; enabled at "12.50"; Strike/Ask HR unaffected) and route (zero/missing/negative refused
  with 400, line left PENDING).
- Live: flagged vendor line — empty box and "0" kept Allow disabled with the hint; "0.5" enabled
  it; committed at 450.00 ("Allowed by you, not by a rule: SGD 450.00"). Reduce and Allow anyway
  cards showed the right alternative; each hint had a unique id.

**Note:** the hint shows on every undecided card that has an amount action, including
supported lines where the lawyer will simply Accept — visible text, not colour-only, but it
adds a line to each card.

Commit: (recorded by the quick-task closing commit)
