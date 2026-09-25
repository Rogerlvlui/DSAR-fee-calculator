---
quick_id: "260924-w5p"
status: complete
---

# Summary: require a real description on "Something else" cost lines

**Done.** New `apps/web/src/domain/expense-description.ts` holds the rule (≥10 non-whitespace
characters for `OTHER_UNCLASSIFIED`) and the HR hint. Intake form blocks Submit with
`Describe what cost line N ("Something else") was for — at least 10 characters, so Legal can
classify it.`; the cost line shows the hint plus an inline "Required … (n so far)" counter.
`addExpenseLine`/`replaceExpenseLine` in `apps/web/src/server/data/matters.ts` return 400 for a
short description, so the API can't be used to bypass the form. No new field; `hrNote` untouched.

**Verified:**
- `pnpm typecheck`, `pnpm lint`, `pnpm depcruise` — clean.
- `pnpm test` — 1099/1102 on the full parallel run; the 3 failures were the 10,000-run property
  tests in `packages/engine` / `packages/schemas` hitting vitest's 5s timeout under load
  (packages this task doesn't touch). Rerun alone: 5/5 pass in 4.7s. Pre-existing flakiness,
  not a regression — worth a separate look (raise their timeout).
- New tests: `expense-description.test.ts` (3), two `computeIntakeDisabledReason` cases,
  `tests/routes/add-expense-line-other-description.test.ts` (2).
- Live: picked "Something else" → hint and Required prompt shown; "misc" kept Submit disabled
  with the line-numbered reason; a full description enabled it; submitted; Legal's review card
  showed "HR's description — Off-site archive retrieval fee for historical personnel files".

Commit: (recorded by the quick-task closing commit)
