---
quick_id: "260923-w2p"
status: complete
---

# Summary: combine Legal + DPO demo identities, delete Wei Ling Ong

**Task 1 — done.** Roger Lui's demo identity (`DEMO_USERS.LEGAL_REVIEWER`) renamed to
"Roger Lui — Privacy Lawyer, Singapore" and now carries both `LEGAL_REVIEWER` and
`DPO_ADMIN` access. `requireRole()` widened to accept a single role or an array of
acceptable roles (single-role error message preserved byte-for-byte for existing test
compatibility). `exportAuditLog`'s one gate (`apps/web/src/server/data/audit.ts`) now
accepts `["DPO_ADMIN", "LEGAL_REVIEWER"]`. `DPO_ADMIN_USER` ("Wei Ling Ong") removed from
`auth.ts` entirely; the `"DPO_ADMIN"` cookie value is no longer recognised by
`resolveActorFromCookieHeader` (falls back to `HR_PREPARER`, the correct outcome for a
retired identity, not a gap). Role switcher (`apps/web/app/layout.tsx`) now shows 2 entries.

**Not touched:** `packages/schemas`'s frozen `RoleSchema` and `prisma/schema.prisma`'s
native enum — `DPO_ADMIN` remains a structurally valid `Role` value, just with no demo
persona attached to it.

**Task 2 — done.** Updated tests that depended on the separate `DPO_ADMIN` identity:
- `tests/routes/audit-export.test.ts` — substantially rewritten. Kept "preparer refused"
  unchanged; flipped "reviewer refused" to "reviewer succeeds"; added a test proving the
  retired `DPO_ADMIN` cookie value now falls back to `HR_PREPARER`; added a test proving a
  hand-built (not `DEMO_USERS`-sourced) `DPO_ADMIN`-role actor is still structurally
  accepted, preserving coverage of that branch even with no demo persona using it.
- `tests/routes/signoff.test.ts` — removed the redundant `DPO_ADMIN`-cookie ACCESS-04 case
  (now a duplicate of the `HR_COOKIE` case directly above it) and the now-unused
  `DPO_COOKIE` constant.
- `tests/routes/matter-submitted-authorization.test.ts` — removed the redundant
  `DEMO_USERS.DPO_ADMIN` assertion (the same property already proven via
  `DEMO_USERS.LEGAL_REVIEWER` on the line above).
- `apps/web/src/ui/admin/audit-trail-view.test.tsx` — renamed the synthetic fixture actor's
  `displayName` away from "Wei Ling Ong" (unrelated to the demo identity system, but no
  trace of the retired name should remain anywhere).
- `apps/web/app/admin/audit/page.tsx`, `apps/web/src/server/data/audit-trail.ts` — comments
  updated to reflect the combined-role gate (no behavior change in either file).

**Verified:**
- `pnpm typecheck` — clean.
- `pnpm test` — 1095/1095 passing (same total as before: −2 redundant DPO_ADMIN-specific
  assertions removed, +2 new tests added in audit-export.test.ts — a coincidental wash).
- `pnpm lint` / `pnpm depcruise` — clean.
- Live browser check (dev server, webpack): role switcher shows exactly 2 entries; Roger's
  single identity successfully reaches `/admin/audit` and renders the real (empty) Audit
  trail screen — confirmed the combined access actually works, not just typechecks.
- `grep` for "Wei Ling Ong" / "wei.ling.ong" / "DPO_ADMIN_USER" across all tracked source
  and docs — zero live references remain (only two explanatory, past-tense code comments
  naming the retired identity for context).

Commit: (recorded by the quick-task closing commit)
