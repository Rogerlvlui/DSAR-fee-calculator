# Phase 7: Sign-off, Outputs and Edge States - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 7-Sign-off, Outputs and Edge States
**Areas discussed:** Reviewer jurisdiction scoping, PACK-08 activation dependency, Requestor notice template content, Internal record PDF layout

---

## Reviewer jurisdiction scoping (ACCESS-04 / AC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Add jurisdiction entitlement now | Extend the identity model with a jurisdictions field and a second LEGAL_REVIEWER persona, so ACCESS-04 has a real negative case | |
| Keep flat role, treat as prototype limitation | One lawyer entitled to all jurisdictions for now, same exception already used for ACCESS-06 (SSO/IdP) | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Resolved in CONTEXT.md D-01 — kept the flat role (option 2's substance), reasoning that reopening the frozen `UserRefSchema` for a single-lawyer prototype buys no genuine test coverage.

---

## PACK-08 / AC-41b activation dependency

| Option | Description | Selected |
|--------|-------------|----------|
| Build the check now, prove via synthetic fixture | Call packages/audit's memory-backed writer directly from a test, same technique as Phase 6's REVIEW-10 | |
| Defer PACK-08 out of Phase 7 | Mark Pending like PACK-09, re-scope success criteria | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Resolved in CONTEXT.md D-02 — build now against a synthetic fixture (option 1's substance), consistent with established project precedent; full live-admin-screen proof stays deferred to Phase 3.2.

---

## Requestor notice template content (DOC-02/DOC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Author real HK/SG notice wording now | Product owner authors real text now, same authoring identity as the category rules | |
| Defer, build against fixture content | Mirror the Phase 6 PACK-09 decision — prove the mechanism against placeholder text | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Resolved in CONTEXT.md D-03 — defer (option 2's substance), tracked alongside the remaining PACK-09 category authoring.

---

## Internal record PDF layout (DOC-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Dense data table | One row per line, optimised for a printed/archival record | |
| Mirror the review-card structure | More visual continuity with the review screen, more pages | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Resolved in CONTEXT.md D-04 — dense data table (option 1's substance); DOC-01's own field list is already table-shaped, and it paginates more predictably with `@react-pdf/renderer`.

---

## Claude's Discretion

- Exact PDF page size, font choices, and column widths within the dense-table layout.
- Whether the fixture notice template lives as a new committed test fixture or reuses an existing one.
- Exact wording of PACK-08's "points to another reviewer" block message.

## Deferred Ideas

- Real HK/SG requestor-notice legal content — follow-up alongside remaining PACK-09 categories.
- Jurisdiction-scoped `LEGAL_REVIEWER` entitlement — future refinement, not built now.
- Correction re-review after `SUPERSEDED` — pre-existing standing blocker (checkpoint 04-05-CP), resurfaced but out of this phase's scope; needs a product-owner decision separately.
- `/admin/rulepacks` activation screen (PACK-06/PACK-07) — stays with Phase 3.2, blocked on Docker.
