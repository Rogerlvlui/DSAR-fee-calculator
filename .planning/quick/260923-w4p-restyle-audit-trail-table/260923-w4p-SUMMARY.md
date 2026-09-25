---
quick_id: "260923-w4p"
status: complete
---

# Summary: restyle the Audit trail tables

**Task 1 — done.** Added `.data-table-card` and `.data-table` rules to
`apps/web/app/globals.css`, independent of `.notice-table`. Updated
`apps/web/src/ui/admin/audit-trail-view.tsx`: both `<section>`s now carry
`className="data-table-card"`, both `<table>`s use `data-table` instead of `notice-table`,
and the per-`<th>` `className="hint"` was removed (superseded by `.data-table th`).

**Verified:**
- `pnpm typecheck` — clean.
- `pnpm test` — 1095/1095 passing, unchanged.
- Live browser check: both tables now render as bordered white cards with a header bar
  ("Matter events" / "Pack lifecycle events") and shaded, uppercase column headers —
  matching the design source. Confirmed with real seeded data (9 audit events from this
  session's own walkthrough), not a synthetic fixture.

**Context:** this is the second of two gaps found in a systematic screen-by-screen pass
against the Claude Design source (the first was `status-strip.tsx`, quick task 260923-w3p).
Legal review and the Fee notice screen were also checked in this pass and found to already
match the design (Legal review verified live; Fee notice verified via its existing
`.card`/`.notice-document`/`.notice-table` class usage, the same classes already confirmed
correct elsewhere).

Commit: (recorded by the quick-task closing commit)
