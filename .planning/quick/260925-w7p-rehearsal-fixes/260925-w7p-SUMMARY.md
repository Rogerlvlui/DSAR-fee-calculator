---
quick_id: "260925-w7p"
status: complete
---

# Summary: four fixes found in the demo rehearsals

**Done.**
1. Headline reads "1 line needs a decision" / "N lines need a decision".
2. HR notice reads "… signed off by …, on 25 Sep 2026." (`formatDisplayDate`, server-local).
3. `/hr/matters/new` renders per request (`connection()`); the build now lists it as ƒ.
4. `apps/web` `build` script is `next build --webpack`.
`docs/DEMO-WALKTHROUGH.md` updated: start-up uses `pnpm --filter @dsar/web build`; the
"same reference" caveat removed; the HR-result row mentions the sign-off date.

**Verified:**
- `pnpm typecheck`, `pnpm lint`, `pnpm depcruise` — clean. `pnpm test` — 1112/1112.
- New tests: `display-date.test.ts` (3), the headline's singular/plural, the notice never showing
  a raw ISO timestamp. `result-view.test.tsx`'s headline test had asserted the raw ISO string;
  updated to "18 Sep 2026".
- `pnpm --filter @dsar/web build` succeeded on webpack; `/hr/matters/new` is ƒ.
- Live on the production server: three loads of the intake page gave three references; a
  one-line claim's review headline read "1 line needs a decision"; after sign-off the HR notice
  read "on 25 Sep 2026."

**Open (decision for later):** the sign-off date uses the server's time zone. For a pilot on a
UTC host, a jurisdiction time zone would be more accurate — needs a choice for Australia.

Commit: (recorded by the quick-task closing commit)
