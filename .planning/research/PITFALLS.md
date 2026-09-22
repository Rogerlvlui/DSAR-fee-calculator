# Pitfalls Research: DSAR Fee Assessment Agent

**Domain:** Legal-tech deterministic rules engine, human sign-off gate, narrow LLM boundary (Next.js/Prisma/Postgres, TypeScript)
**Researched:** 2026-09-13
**Confidence:** HIGH for technical mechanics (Next.js caching/RSC semantics, Postgres GRANT/TRUNCATE, Prisma types, JS float behaviour — all verifiable against vendor docs); MEDIUM for domain-interaction judgment calls (e.g. what "hidden total" is actually meant to defend against) — flagged inline.

This file does **not** restate PRD §9's R1–R11. It documents how a competent team, having already read and accepted those risks and their mitigations, still ends up implementing something that defeats them.

---

## Critical Pitfalls

### Pitfall 1: The zero-decimal-currency trap (JPY/KRW/VND) silently corrupts money by 100x

**What goes wrong:**
Every formatter, input-conversion routine, or validator written and tested against SGD/HKD (2 minor-unit decimals) assumes `minorUnits / 100 = majorUnits` and `majorUnits * 100 = minorUnits`. JPY, KRW and VND have **zero** minor-unit decimals — 1 JPY = 1 minor unit, not 100. Any hardcoded `/100` or `*100`:
- In the HR intake form's rate-entry field (`unitRate` in minor units, §6.2) inflates or deflates a JPY/KRW/VND rate by 100x at the point of entry.
- In display formatting (review screen, PDF, notice text) renders "10000 minor units" as "¥100.00" instead of "¥10,000" — a 100x under-display that a lawyer signs off on without noticing, because it looks like a plausible number either way.
- In the LLM-boundary verbatim-match validator (AC-36 b/c) — see Pitfall 8 — independently reintroduces the same bug in a completely different package.
- In CSV/PDF export, in the QA monthly report (§9.6) aggregating "value by jurisdiction" across currencies.

The PRD ships only SGD/HKD as reference packs (both 2-decimal), so this bug has **zero chance of surfacing in Phase 1/2 golden-file tests** and will not be caught until a JPY/KRW/VND pack is authored (PRD §16 Phase 2) — by which point the money-formatting code is already copy-pasted into three or four places (web, documents, agent, reports).

**Why it happens:**
`CurrencyCode` (§6.0) is a closed set spanning both 0- and 2-decimal currencies, but nothing in the schema encodes decimal places per currency — it's tempting to hardcode "divide by 100" once, early, against the two currencies actually in front of you.

**How to avoid:**
- One canonical `MINOR_UNIT_DECIMALS: Record<CurrencyCode, 0 | 2>` map (or derive from `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`, but pin explicitly rather than trust ICU) declared alongside `JURISDICTION_CURRENCY` in `packages/schemas`, imported everywhere money crosses a major/minor boundary — never a bare `/100` or `*100` literal anywhere in the codebase (grep for it in code review).
- A single `toMajorUnits(minor, currency)` / `toMinorUnits(major, currency)` / `formatMoney(minor, currency)` triplet, exported once, used by `apps/web`, `packages/documents`, `packages/agent`'s validator, and the QA report. No package hand-rolls its own.
- A fixture-level test: assert `toMajorUnits(10000, 'JPY') === 10000` and `toMajorUnits(10000, 'SGD') === 100.00`, run in the same suite as the SGD/HKD golden files, from day one — even though no JPY pack exists yet, the *formatter* can and should be tested against all nine `CurrencyCode`s immediately.

**Warning signs:** any file containing a literal `100` near a money variable; any `unitRate` input `<input step="0.01">` hardcoded rather than derived from currency; a JPY test fixture that "just uses round numbers" so a 100x bug wouldn't be visually obvious.

**Phase to address:** `packages/schemas` (define the decimals map before `packages/engine` exists) and `apps/web` intake form (Phase: web). Do not defer to Phase 2 pack-authoring — the formatter must be currency-generic from the first commit that touches money display.

---

### Pitfall 2: Pro-rata aggregate cap distribution leaves an unallocated rounding residue

**What goes wrong:**
§8.1 step 5 says the aggregate cap is applied "pro-rata across allowed lines." Distributing a fixed total (the cap) proportionally across N lines and flooring each line's share (per AC-07's floor rule) almost never sums exactly back to the cap — some number of minor units (0 to N-1) is left over. The PRD specifies rounding *direction* (down) but not what happens to the **residue**. Left unresolved, two engineers implement two different (both individually defensible) schemes — e.g. "give the leftover cent to the first line," "give it to the largest line," "just let the sum be short of the cap" — and:
- The §10.3 reconciliation invariant ("Supported + Not supported + Needs your decision = Claimed") can silently fail to reconcile by a few minor units whenever an aggregate cap bites, because the discarded residue has nowhere to go.
- Golden-file tests written against a claim that divides evenly by line count (as the §14 reference fixture does — none of its lines hit an aggregate cap at all) never exercise this path, so it ships untested and only surfaces once a jurisdiction pack with a real `aggregateCap` is authored.

**Why it happens:** "pro-rata" is stated as an outcome, not an algorithm; the PRD gives a rounding *direction* rule (§8.1, AC-07c) but that rule is about single-cap application, not residue allocation across a *set* of lines summing to a target.

**How to avoid:** Pick and document one deterministic residue-allocation rule before writing the aggregate-cap code — e.g. largest-remainder method (allocate floor shares, then distribute the leftover minor units one-by-one to the lines with the largest fractional remainder, ties broken by line `seq` ascending, never by insertion order of a `Map`/`Set` — see Pitfall 3). Write it as a named, independently unit-tested function (`distributeCapProRata`), not inline in `assess()`. Add a golden-file fixture specifically constructed so the cap does *not* divide evenly (e.g. 3 allowed lines against a cap that's not a multiple of 3), so the residue rule is under golden-file coverage from the start.

**Warning signs:** the §10.3 reconciliation check (`Supported + Not supported + Needs your decision === Claimed`) implemented as a UI-only display assumption rather than an asserted engine invariant with its own test; no fixture in §14's golden files exercises `aggregateCap`.

**Phase to address:** `packages/engine` — must be resolved before any pack with a non-null `aggregateCap` is authored (currently null in both reference packs, so this can slip past Phase 1 entirely unless deliberately tested).

---

### Pitfall 3: Golden-file tests give false confidence against non-determinism that only surfaces off-CI

**What goes wrong:** `assess()` is specified as pure with an injected `now` (§8.1), but purity is easy to violate in a nested helper without anyone noticing, because golden-file tests always run in the same container: same timezone (usually UTC), same Node build, same ICU data, same locale. Concrete leak vectors:
- A duplicate-line detector or ID-adjacent helper calling `Date.now()`/`new Date()` directly instead of threading the injected `now` parameter through.
- `.localeCompare()` used anywhere to order flagged lines or categories for display purposes inside the engine (rather than in `apps/web`) — locale-dependent, varies by Node's bundled ICU.
- Building a flags/lines array by iterating a `Map` or `Set` that was populated via delete-then-reinsert (breaks insertion-order guarantees) or an object with numeric-looking string keys (e.g. `{"0": ..., "1": ...}` from a mis-typed `Record`), which JS engines always iterate in ascending numeric order *before* string-key insertion order — an easy trap if any intermediate structure keys by array index as a string.
- `Intl.NumberFormat`/`toLocaleString()` used inside `packages/engine` (rather than confined to `apps/web`/`packages/documents`) for any comparison or generated text, making output depend on the Node binary's ICU build.

None of these show up in CI because CI is one environment run once. They surface as: flaky golden-file failures when a developer runs tests locally with a non-UTC `TZ` or non-`en-US` `LANG`; a regenerated golden file on a differently-configured machine baking in that machine's nondeterminism as the new "expected" output (which is worse than a failing test — it converts a bug into a false baseline); or a production incident when the app deploys to a runtime (e.g. an edge function) with different ICU defaults than the CI container.

**Why it happens:** the discipline "no I/O, no clock, no LLM" is stated once at the package level (§0, §8.1) but purity has to be re-verified at every function inside the package, not assumed from the top-level signature.

**How to avoid:**
- Run the engine test suite in CI under at least two different `TZ`/`LANG` combinations as a matrix (e.g. `TZ=UTC LANG=en_US.UTF-8` and `TZ=Pacific/Kiritimati LANG=ja_JP.UTF-8`) — a purity leak that's invisible in one environment is usually visible across two very different ones.
- ESLint rule (or a simple `grep`-based CI check) banning `Date.now()`, `new Date()` without an argument, `Math.random()`, and `.localeCompare()`/`toLocaleString()`/`Intl.*` inside `packages/engine` source (mirrors the existing AC-07(a) ESLint pattern banning bare `number` for money fields — same mechanism, different pattern).
- Never regenerate a golden-file fixture by blindly re-running with `--update-snapshots`; every fixture diff is reviewed by a human in the PR (this is explicitly the point of §14's "changing a pack must break its golden files").

**Warning signs:** a golden-file test that's ever been flaky and got fixed by "just re-running it"; any `.sort()` call inside `packages/engine` without an explicit comparator; ids generated inside `assess()` itself rather than supplied/derived deterministically.

**Phase to address:** `packages/engine`, at initial construction — cheaper to establish the lint rule and TZ/LANG test matrix before the first golden file is written than to retrofit after 20 fixtures exist.

---

### Pitfall 4: RSC data-fetching and caching leak the unreviewed assessment past the API boundary AC-01/02 tests

**What goes wrong:** AC-01/AC-02 correctly test the *API* boundary (an `HR_PREPARER` hitting `GET /api/assessments/{id}` gets 403 with no assessment data in the body). But in a Next.js App Router app, several other channels can carry the same restricted data to an `HR_PREPARER`'s browser without ever touching that specific endpoint:
- **RSC flight payload over-fetch.** If a Server Component fetches the *full* `Assessment` (verdict, `basis`, `lawyerReason`, `draftBaseline`) and passes it as props into a Client Component for interactivity, the full serialized object ships in the RSC payload embedded in the HTML/flight response for hydration — regardless of which fields the Client Component actually renders. Conditional rendering (`{role === 'LEGAL_REVIEWER' && <Full/>}`) hides it from the DOM but not from the payload; it's visible in view-source and the Network tab. The fix has to happen at the *data-fetching* layer (query only the fields the current role may see) — never at the render layer alone.
- **New endpoints added later miss the guard.** AC-01/02 are written and tested against the endpoints that exist at plan time. A later endpoint (an export route, a print view, an SSE/websocket channel for live status, anything added in a later phase per §16) that reuses the same Prisma `include`/`select` as the reviewed endpoint but forgets the role check is exactly where this regresses — because the acceptance-criteria tests don't automatically extend to endpoints that don't exist yet.
- **Caching serves a stale privileged response to the next role.** Next.js `fetch()` calls inside Server Components are cached by default (the Data Cache) unless `cache: 'no-store'` is explicitly set; a client-side cache (SWR/React Query, if used) keyed only by `matterId` without role or session in the key can replay a cached `LEGAL_REVIEW`-stage response after a role switch or on a shared machine; a CDN/edge cache header (`Cache-Control: public`) on an assessment API route caches a response that varies by requester role. Any data-fetching path for assessment data must explicitly opt out of default caching and set `Cache-Control: private, no-store`, and any client-side cache key must include role/session, not just `matterId`.
- **Middleware treated as the security boundary.** `middleware.ts` route-matching (e.g. `matcher: ['/legal/:path*']`) is good for UX redirects but is not authorization: it commonly omits `/api/*` routes from its matcher by oversight, and Server Actions in particular post to the *same URL as the page* — easy to miss in a matcher regex, meaning a Server Action can bypass a middleware guard that "protects" the page it's invoked from. AC-01 must be verified by calling the route handler / Server Action directly (bypassing the browser/UI and middleware), not just by navigating the UI as different roles.

**Why it happens:** App Router blurs the line between "what's fetched" and "what's rendered" in a way pages/API-route architectures didn't; it's natural to fetch the full object once and filter downstream because that's simpler code, and the acceptance criteria as written test the wrong layer (API response body) to catch the RSC-payload variant of the same bug.

**How to avoid:** Role-gate the *query* (Prisma `select`) for assessment data, not just the render — build one server-only data-access function per role that returns a role-scoped shape, and never let a Client Component receive a prop object that a stricter role shouldn't see even unrendered. Set `cache: 'no-store'` explicitly on every assessment-data fetch. Extend AC-01/02-style tests to run against every route handler and Server Action added in every future phase, not just the ones enumerated in the current PRD — this belongs in the phase's Definition of Done, not just the initial test suite. Verify middleware `matcher` explicitly includes every `/api/*` path serving assessment data and every Server Action's implicit POST target.

**Warning signs:** any Client Component whose props type is literally `Assessment` (the full type) rather than a narrower `HRVisibleAssessment`/`LegalVisibleAssessment`; any `fetch()` inside a Server Component without an explicit `cache` option; a new API route added without a corresponding AC-01/02-style test in the same PR.

**Phase to address:** `apps/web` (Phase: web) for the initial implementation; but the *test discipline* (every new endpoint gets an authorization test) should be a standing rule enforced at every subsequent phase, especially Phase 3+ (identity, correspondence, audit agents, §16) which add new endpoints by definition.

---

### Pitfall 5: The 10-character mandatory reason and the no-bulk-actions rule are UI-only unless independently enforced server-side

**What goes wrong:**
- **AC-23's stop-list is trivially satisfiable while conveying nothing.** `≥10 non-whitespace characters, not on the stop-list` blocks "ok"/"fine"/"n/a" but not "asdfghjklq" (10 chars), repeated-character padding ("reduced...."), or the lawyer copy-pasting the rule's own `basis` text back verbatim — which passes length and isn't on the stop-list, but adds no independent judgement. This is fundamentally not solvable by string validation, and the PRD's actual answer is the pairing with §9.6's behavioural monitoring (review duration, change rate) — the implementation pitfall is treating AC-23 as sufficient on its own and deprioritising the QA-report/review-duration instrumentation because "the reason field already handles it."
- **"No bulk actions on flagged lines" (AC-26, NS-7) enforced only by hiding/disabling a button in the UI**, while a single `POST /assessments/{id}/dispositions/bulk` endpoint accepts an array of line dispositions without independently re-checking, server-side, that every targeted line's current verdict is eligible (`ALLOW` + `VERIFIED` rule only). Anyone hitting the endpoint directly (devtools, curl, or a future "accept remaining" power-user shortcut nobody thought through against AC-26) bypasses the restriction entirely. AC-26 explicitly requires "the API rejects a batch disposition containing one" — the pitfall is implementing the UI restriction first, shipping it, and treating the API-level check as a follow-up that quietly doesn't happen.
- **The hidden-total mechanism (AC-25) is a UX nudge against rubber-stamping, not a confidentiality boundary — building it as the latter wastes effort and can break the legitimate UI.** §10.3's right rail legitimately shows `Supported by rules` / `Not supported` / `Needs your decision` subtotals to the lawyer *before* sign-off — only `finalAmount`/"Recommended fee" is hidden while `PENDING > 0`. Two opposite implementation failures follow from not being precise about what's actually hidden: (a) over-restricting — refusing to send any total-shaped number to the client pre-sign-off, which breaks the §10.3 right rail as specified; or (b) under-restricting — computing `finalAmount` as `draftBaseline` before sign-off, which §8.1 step 6 explicitly warns against by name ("Do not default it to draftBaseline") — meaning this is a known, named trap in the spec itself, not a hypothetical. Note also (MEDIUM confidence, a design observation rather than a bug): once every non-`FLAG` line is `ACCEPTED` and only flags remain `PENDING`, `Supported by rules` *is* arithmetically what the total would be if all flags were struck — a lawyer can derive the pending-hidden number from the legitimately-visible subtotal by then. This is inherent to the design (flags contribute 0 by definition) and not fixable by hiding more data without breaking §10.3; it's worth the roadmap being explicit that AC-25 is a rubber-stamp deterrent, not a confidentiality control, so nobody "fixes" it with an over-engineered solution that then breaks the mandated review screen.

**How to avoid:** Every UI-level restriction named in §9.4 (hidden total, no bulk accept on ineligible lines, mandatory reason) needs an independent server-side/API-level enforcement test that calls the endpoint directly, bypassing the UI component that "normally" prevents the action — write these as their own test file (`tests/auth/anti-automation-bias.spec.ts`) distinct from the UI E2E tests, so a UI refactor can't silently drop the server-side check without a failing test. Treat AC-23's stop-list as necessarily weak and build the §9.6 review-duration/change-rate monitoring in the same phase, not as a "nice to have" deferred later — the PRD pairs them for a reason.

**Warning signs:** a bulk-disposition endpoint whose only guard is "the request body came from the Accept-All button's known payload shape"; no test that POSTs a batch containing a `FLAG` line id directly to the API; §9.6's monitoring report scoped to a later phase than the review screen it's meant to backstop.

**Phase to address:** `apps/web` (Phase: web) for the API-level enforcement tests, built alongside the UI, not after. §9.6's monitoring report should ship no later than the phase that ships sign-off, since AC-23 is explicitly insufficient alone.

---

### Pitfall 6: "Append-only" audit log has more bypass vectors than the AC-34 GRANT covers

**What goes wrong:** AC-34 specifies revoking UPDATE/DELETE on the audit table for the application's database role. That's necessary but covers a narrower attack surface than "append-only" implies:
- **Cascade deletes via ORM relations.** A Prisma relation from `Matter` → `AuditEvent` with `onDelete: Cascade` (an easy default to reach for since audit events reference `matterId`) would let any matter-deletion path wipe its own audit trail — even though nothing in the PRD describes a matter-deletion feature, a generic Prisma schema authored quickly can default to cascade behaviour without anyone deciding it. There should be no FK cascade from `Matter` to `AuditEvent` at all.
- **Migrations run as a superuser bypass the GRANT entirely.** `prisma migrate` (and hand-written migrations) execute as the migration/owner role, not the constrained application role — a migration that backfills a new column with an unguarded `UPDATE audit_event SET ... ` (no WHERE clause) is a real, easy accident, and it isn't blocked by AC-34's revoke because that revoke only applies to the app role. Any migration touching `audit_event` warrants mandatory manual review; a database-level `BEFORE UPDATE OR DELETE` trigger that raises an exception is worth adding as defense-in-depth, since it blocks even the migration/superuser role unless someone explicitly disables the trigger first — turning an accident into a deliberate, logged act.
- **A soft-delete convention applied globally.** A Prisma middleware/extension that rewrites `.delete()` into `.update({ deletedAt: now })` project-wide (a common retention/GDPR-cleanup pattern) silently turns "append-only" into "update-then-filter" for `AuditEvent` unless the model is explicitly excluded from that convention.
- **A superuser connection string in `.env`, never tightened.** Local/demo setups commonly point `DATABASE_URL` at the Docker Compose default `postgres` superuser "to keep things simple," which makes AC-34's GRANT revocation meaningless since the app never connects as the restricted role in the first place — and prototype-phase shortcuts like this have a strong tendency to survive into later environments because the `.env` gets copied forward rather than rebuilt. Verify AC-34 by attempting an actual `UPDATE`/`DELETE`/`TRUNCATE` against `audit_event` using the exact `DATABASE_URL` the running app uses, in CI — not by inspecting the migration file that issues the GRANT.
- **`TRUNCATE` is a separate privilege from `DELETE` in Postgres.** `REVOKE DELETE` does not block `TRUNCATE` — that requires its own `REVOKE TRUNCATE`. If AC-34's implementation only revokes UPDATE/DELETE (as literally stated), the table remains truncatable by the app role. Revoke and test both.
- **`prisma db push` against an environment holding real audit data.** `db push` can drop-and-recreate tables on a detected "destructive" schema change; if ever pointed at a shared demo/staging environment that also serves as the project's "prototype" deployment (PROJECT.md explicitly frames this as local/demo with a real architecture underneath), a destructive push regenerates `audit_event` from empty. Use `migrate` exclusively once any environment holds audit events that matter, even in the prototype phase.
- **Backup/restore silently rolls back history.** Restoring a snapshot to "reset a demo" doesn't UPDATE/DELETE any row, so it's invisible to AC-34's role-based guard, but it reverts the audit log to an earlier point in time — indistinguishable from deletion from a defensibility standpoint. This is likely acceptable to leave out of scope for a prototype, but it should be a documented decision (who may restore, and how that operation is itself logged outside the app), not a silent gap discovered later.

**How to avoid:** Treat "append-only" as a set of five explicit guarantees to individually verify (no cascade FK, `REVOKE UPDATE, DELETE, TRUNCATE`, no soft-delete middleware applies to this model, app connects as the restricted role in every environment including local, and — separately — a documented policy on who can restore backups). Write one test per guarantee, run against the actual runtime `DATABASE_URL`.

**Warning signs:** a Prisma schema where `AuditEvent` has any `onDelete` other than `Restrict`/absent; any global Prisma middleware/extension that isn't explicitly scoped away from `AuditEvent`; a `.env.example` or docker-compose default using the superuser role for `DATABASE_URL`; a migration diff touching `audit_event` with an `UPDATE` statement.

**Phase to address:** schemas/engine setup (Prisma schema authored before Phase: web) for the FK/GRANT structure; a standing CI check (added once, applies forever) for the runtime-role verification.

---

### Pitfall 7: A pack row that's mutable after any assessment references it retroactively rewrites history

**What goes wrong:** `Assessment.rulePackVersion` is "pinned at compute time, immutable" (§6.4) and AC-40 guarantees that *activating a new version* doesn't alter existing assessments. But AC-40 only protects against version activation — it says nothing about an in-place edit of an *existing* pack version row. If the admin screen's "quick fix a typo in basis text" path (a plausible, reasonable-looking feature) does `UPDATE rule_pack SET ... WHERE packId=X AND version=Y` instead of creating a new version, every historical `Assessment` referencing that exact `packId`+`version` silently displays different `basis`/`citation` text than what the lawyer actually reviewed and signed off on — the pinned version string stays the same, but its resolved content changed underneath it. This defeats the entire "the engine applied rule X, version Y" defensibility claim (§8.3) without tripping any of the stated acceptance criteria, because none of them test for in-place mutation of an already-referenced pack version.

A second, related gap: golden-file tests (§14) are supposed to break when a pack changes ("that is the point"). If the test harness resolves "the SG pack" dynamically (e.g. "load whatever is currently `ACTIVE` for jurisdiction SG") rather than loading the fixture's pinned `packId`+`version` explicitly, a pack content change can silently produce different golden output without the test framework flagging it as the intended break — especially if a failing golden-file test is habitually "fixed" by regenerating the snapshot rather than requiring a human-reviewed diff.

**How to avoid:** Once any `Assessment` references a `RulePack` row (by `packId`+`version`), that row must become immutable — enforced the same way as the audit table (revoke UPDATE at the DB level for the app role once referenced, or — simpler for a prototype — always store a content hash of the pack on the `Assessment` at compute time and re-verify it on every render, which catches drift even without a DB-level lock). Editing a `DRAFT` pack in place before it's ever activated/referenced is fine (and matches §10.6's "diff against previous version" UI, which implies draft-mutation is the intended pre-activation model) — the immutability boundary is "has this exact version ever been referenced by an assessment," not "has it been activated." Golden-file fixtures must pin an exact `packId`+`version` in the fixture input, never resolve "the active pack" dynamically; any snapshot update requires a reviewed diff in the PR, never a blind re-run.

**Warning signs:** an admin edit form that writes to an existing pack version row rather than creating a new draft revision; a test harness function named something like `loadActivePack(jurisdiction)` used inside a golden-file test rather than `loadPack(packId, version)`.

**Phase to address:** `packages/rulepacks` (loader/validator) for the immutability boundary; `packages/engine` test setup for the fixture-pinning discipline — both before Phase: web's admin screen ships an edit path.

---

### Pitfall 8: The LLM boundary's "verbatim match" validation is necessary but not sufficient, and drifts toward the weaker check

**What goes wrong:** AC-36(b)/(c) requires every monetary figure and citation in LLM output to appear verbatim in engine output, or the draft is discarded. This is precise as stated but fragile as implemented, because engine output stores raw data (integer minor units, a structured `Citation` object), not a single canonical display string — so "verbatim" first requires the implementer to define a canonical string form to match against, and several plausible implementations fall short of what AC-36 actually requires:
- **Number-formatting variance defeats naive substring matching.** Engine amount 26640 minor units canonically renders as "266.40"; the LLM may (despite instructions) write "SGD 266.40", "S$266.40", "266.4", or "266.40 SGD." A check for `output.includes("266.40")` catches some of these and misses "266.4" (same value, different string) — fixing this by parsing-and-comparing numerically reintroduces float-precision risk into the one package this whole product was designed to keep away from money arithmetic, and needs currency-aware parsing to handle JPY/KRW/VND's lack of a decimal point (see Pitfall 1 — the same zero-decimal bug recurs independently here if the agent package's canonicalizer is hand-rolled rather than sharing the one sanctioned `formatMoney` utility).
- **Partial/composite citation matches slip through substring-presence checks.** AC-36(c)'s actual wording is the *stronger* framing: "every citation-shaped substring in LLM-generated text appears verbatim in an applied rule's citation" — i.e. nothing citation-shaped in the LLM's text may be unaccounted for. It's tempting, and easier to write first, to instead implement the *weaker* check: "the engine's citation string appears somewhere in the LLM text." The weaker check passes "PDPA s.21(1), which also requires X" even though "(1), which also requires X" is fabricated content the pack never asserted — exactly what AC-36 exists to catch. The gap between "citation appears in text" and "text contains nothing beyond the citation" is the whole ballgame, and it's easy to ship the easier, wrong one under time pressure since both pass the same happy-path test case.
- **The zero-decimal trap recurs independently in `packages/agent`.** If the verbatim-match canonicalizer is authored and tested only against the two reference packs (SGD/HKD, both 2-decimal) and reused unmodified once a JPY/KRW/VND pack exists (§16 Phase 2), it inherits the same `/100` bug as Pitfall 1 — but in a *different package*, meaning fixing the display-layer bug does not fix this one; they must share one implementation, not parallel independent ones.

**Also — boundary erosion over time, structurally:** the PRD's three LLM jobs are narrow by design (§8.2), but once `packages/agent`'s plumbing exists (schema validation, prompt versioning, template fallback), it becomes the path of least resistance for future "it's just advisory" additions not in the original three jobs — each individually defensible, cumulatively eroding §8.3's whole point. Guard structurally: `packages/agent` exports a closed, enumerated set of functions (`suggestCategory`, `draftRationale`, `summariseQueries`) with **no generic "call the model with this prompt" export** — a new LLM-touching feature requires adding a new named, reviewed function to that closed set (mirroring how the closed expense-category taxonomy in §6.3 prevents category sprawl), not a call site anywhere else in the codebase reaching into a generic client.

**How to avoid:** Implement AC-36(c) as written — every citation-shaped substring (defined by a regex matching how citations look, e.g. `/\b(s\.|reg\.|art\.)\s*\d+[A-Za-z()0-9.]*\b/`) extracted from LLM output must individually match, verbatim, against a citation string assembled from the applied rule's `citation` object — not the weaker "engine citation is present somewhere." Build one shared `formatMoney`/`canonicalCitation` utility (same one from Pitfall 1) used by the validator, not a parallel implementation local to `packages/agent`. Add adversarial eval cases in `/evals` specifically constructed to have the LLM append plausible-but-fabricated sub-citations or reformat numbers, and confirm the validator rejects them (this is exactly what the PRD's "adversarial pass before launch," §14, should include for this package). Keep `packages/agent`'s exported surface to the three named functions only.

**Warning signs:** a validator function using `.includes()` on a single canonical string rather than extracting and checking every citation-shaped/number-shaped substring in the LLM output; a `packages/agent` export named anything like `callModel`/`generateText`/`prompt` that isn't one of the three named jobs; the agent package's money formatter defined locally rather than imported from schemas.

**Phase to address:** `packages/agent` (built last, per PRD §0) — but the shared money/citation formatting utilities it depends on must exist in `packages/schemas` from Phase 1, so the agent package isn't tempted to hand-roll its own.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Modelling money as Prisma `Decimal` or `Float` columns "because it's money, decimals feel right" | Faster schema authoring, familiar ORM ergonomics | Breaks the branded `Minor` integer contract at the DB boundary; Decimal.js objects don't compare/serialize like numbers; violates AC-07(a)'s ESLint scoping if the Decimal leaks past the DB layer into engine-adjacent code | Never — use `Int` (or `BigInt` if headroom is a concern) for every minor-units column, full stop |
| Local `.env` `DATABASE_URL` pointed at the Postgres superuser "to move faster in prototype" | No GRANT/permission friction during early development | Makes AC-34 untestable in the actual running environment; shortcut tends to survive into shared/demo environments unnoticed | Acceptable only on a throwaway local DB never used to demo AC-34, and only if CI independently tests against the restricted role |
| `prisma db push` instead of `migrate` during rapid schema iteration | Faster iteration, no migration-file bookkeeping | Silent destructive drop/recreate risk once any environment holds real audit data or referenced pack versions | Acceptable before any audit event or referenced pack version exists in that environment; switch to `migrate` the moment either does |
| Regenerating a golden-file snapshot with an "update snapshots" flag when a test fails, rather than diffing by hand | Unblocks a red CI run immediately | Defeats the entire purpose of golden-file tests (§14: "changing a pack must break its golden files — that is the point"); can bake in a non-determinism bug or an unintended pack change as the new "expected" | Never for pack-behaviour fixtures; the diff must always be human-reviewed in the PR |
| Passing the full `Assessment` object as Client Component props and hiding fields with conditional JSX | Simpler component code, one data-fetch, less prop-drilling of narrower types | RSC flight payload still carries the hidden fields to the browser (Pitfall 4) — an information-disclosure bug that passes every UI-level manual check | Never for role-restricted data; acceptable only for data every role viewing that route may see |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Prisma + Postgres audit table | Relying solely on `REVOKE UPDATE, DELETE` for append-only; forgetting `TRUNCATE` is a separate privilege, and that migrations run as a different (superuser) role entirely | `REVOKE UPDATE, DELETE, TRUNCATE` on the app role; add a DB trigger raising on UPDATE/DELETE as defense-in-depth against migration-role accidents; verify against the actual runtime connection string in CI |
| Next.js App Router `fetch()` caching | Leaving default caching on for any assessment-data fetch, assuming "it's a dynamic page so it won't cache" | Explicit `cache: 'no-store'` (or route segment `export const dynamic = 'force-dynamic'`) on every fetch touching pre-sign-off assessment data; `Cache-Control: private, no-store` on the corresponding API routes |
| Next.js `middleware.ts` role checks | Treating middleware route-matching as the authorization boundary; matcher configs that omit `/api/*` or miss that Server Actions post to the page URL | Authorization enforced again inside every route handler/Server Action independently of middleware; middleware used only for UX redirects |
| LLM provider (Job 1/2/3) | Building a generic "send this prompt, get this response" helper exported from `packages/agent` for convenience, then reusing it for a feature outside the three named jobs | Export only the three named functions; any new LLM use case requires a new named, reviewed export, never a generic prompt-passthrough |
| PDF generation (`packages/documents`) | Hand-rolling its own money/citation formatting rather than importing the shared utility used by `apps/web` and `packages/agent`'s validator | One shared `formatMoney`/`toMajorUnits` module in `packages/schemas`, imported everywhere, currency-decimal-aware from day one |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Pro-rata aggregate-cap distribution implemented as repeated array re-scans (O(n²)) for residue allocation | Engine still under the 100ms/50-line budget at typical claim sizes, but degrades if a jurisdiction pack later allows very high line counts | Implement the largest-remainder allocation as a single sort + single pass (O(n log n)), not nested loops | Unlikely to bite at 50 lines (§11's stated performance target), but cheap to do right the first time |
| RSC over-fetching the full `Assessment` graph (all lines, all history) on every review-screen navigation rather than the fields the current view needs | Review screen interactivity creeping past the 1.5s target (§11) as line counts or audit history grow | Scope Prisma `select`/`include` to exactly what each role-specific view renders, per Pitfall 4's fix | Noticeable once matters regularly carry 20+ lines with full per-line `basis`/`citation` text |
| Monthly QA report (§9.6) computed as an on-demand full-table scan over `AuditEvent` rather than pre-aggregated | Report generation slows as audit history accumulates across all jurisdictions | Aggregate incrementally or via a scheduled job/materialized view, since `AuditEvent` is append-only by design and safe to aggregate incrementally | Becomes noticeable in the hundreds-of-matters range referenced by NS-6's future audit agent |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New API routes/Server Actions added in later phases (§16: identity, correspondence, audit agents) reuse an existing Prisma query shape without re-deriving the role-scoped `select` | Silently reintroduces the AC-01/02 leak for data these new agents touch, since the original tests don't cover endpoints that don't exist yet | Every new endpoint touching `Assessment`/`Matter`/`AuditEvent` data gets its own AC-01/02-style authorization test in the same PR that adds it — make this a standing phase-completion checklist item, not a one-time Phase-1 exercise |
| Bulk-disposition endpoint (AC-26) trusts that only the UI's "Accept all" button ever calls it with eligible line ids | Direct API call (devtools/curl, or a future keyboard-shortcut feature) can bulk-accept `FLAG`/`ALLOW_CAPPED`/`NEEDS_VERIFICATION` lines, defeating NS-7 | Server independently re-validates every targeted line's verdict/rule-verification status inside the bulk endpoint itself, never trusting client-supplied eligibility |
| Pack-version row mutated in place after being referenced by a signed-off assessment (Pitfall 7) | Retroactively changes what a lawyer is recorded as having reviewed, undermining the entire "defend the engine's output" premise (§8.3) | Immutability boundary on any pack version once referenced by an assessment; content-hash verification on render as a cheap independent check |
| LLM output's verbatim-match validator implemented as "citation is present somewhere in the text" rather than "nothing citation-shaped in the text is absent from the pack" (Pitfall 8) | Fabricated sub-provisions or additions around a genuine citation pass validation, reintroducing R11 (LLM fabricates a basis or citation) through the one gate meant to prevent it | Implement AC-36(c) literally as worded (every citation-shaped substring must match verbatim), with adversarial eval cases exercising fabricated additions specifically |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Treating AC-25's hidden total as a confidentiality boundary and over-restricting what the right rail can show pre-sign-off | Breaks §10.3's specified review screen, which legitimately shows `Supported`/`Not supported`/`Needs your decision` subtotals before sign-off — only `finalAmount` is hidden | Hide exactly `finalAmount`/"Recommended fee" while `PENDING > 0`; keep the specified subtotals visible, since they're the mechanism that makes line-by-line review possible at all |
| Mandatory-reason field accepting any 10 non-stop-list characters as if that guarantees engagement | False sense that AC-23 alone prevents rubber-stamping; a lawyer can satisfy it with meaningless padding | Pair the field with the review-duration/change-rate monitoring (§9.6) from the same phase, not as a later addition — the PRD already designs them as a pair |
| A "live preview of what the total would be" widget for the reviewing lawyer, added as a convenience feature not in the original spec | Reintroduces the automation-bias risk AC-25 is designed to prevent, in feature form | Do not build a lawyer-facing live/current-total preview during active review, even as an internal tool — the absence of a running total is deliberate |

## "Looks Done But Isn't" Checklist

- [ ] **Money formatting:** Often correct for SGD/HKD only — verify `toMajorUnits`/`formatMoney` is tested against all nine `CurrencyCode`s, including the three zero-decimal ones, before calling any money-display feature complete.
- [ ] **Append-only audit log:** Often means "app role can't UPDATE/DELETE" — verify `TRUNCATE` is also revoked, no FK cascade exists from `Matter`, no soft-delete middleware applies, and the running app's actual `DATABASE_URL` (not just a migration file) is the restricted role.
- [ ] **AC-01/02 authorization:** Often verified only for the endpoints that existed at Phase 1 plan time — verify every subsequently-added route handler and Server Action has its own equivalent test, and that RSC data-fetching (not just API responses) is role-scoped at the query level.
- [ ] **Aggregate cap pro-ration:** Often untested because the reference fixture's aggregate cap is null — verify a golden-file fixture exists where a non-null `aggregateCap` doesn't divide evenly across allowed lines, and that the residue-allocation rule is explicit and tested.
- [ ] **Golden-file determinism:** Often "passes in CI" without ever being run under a second timezone/locale — verify the engine test suite runs in at least two distinct `TZ`/`LANG` configurations, and that no fixture has ever been regenerated via blind snapshot-update.
- [ ] **LLM verbatim-match validation (AC-36):** Often implemented as "engine text is present somewhere in LLM output" — verify it instead checks that every citation-shaped/number-shaped substring *in the LLM output* is accounted for, with an adversarial eval case for fabricated sub-citations.
- [ ] **Rule pack immutability:** Often protected only by AC-40 (new-version activation doesn't mutate existing assessments) — verify a *referenced* pack version row cannot itself be edited in place, separately from the activation-doesn't-mutate guarantee.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Zero-decimal currency formatting bug shipped and discovered after a JPY/KRW/VND pack is live | MEDIUM | Centralize the formatter immediately (single shared utility), backfill a migration/report to identify any historical records displayed with the wrong scale (unlikely to have corrupted *stored* minor-unit values if the bug was display-only, but verify intake-side conversion wasn't also affected — that would require re-deriving `claimedAmount` from `quantity × unitRate` per AC-08's existing reconciliation check) |
| Aggregate-cap residue inconsistency discovered after packs with real caps are active | LOW–MEDIUM | Fix the allocation function, add the missing golden-file fixture, re-run affected `LEGAL_REVIEW`-stage assessments through `recompute` (per §5's `LEGAL_REVIEW → COMPUTING` transition, which is designed exactly for this — dispositions reset, no new record needed) — `SIGNED_OFF` assessments are untouched per AC-33/immutability |
| RSC payload leak of unreviewed assessment data discovered in production | MEDIUM–HIGH | Audit every Server Component in `/hr/*` and shared layouts for over-fetched props; rotate/invalidate any client-side cache; this is a disclosure incident for internal cost/legal data (not requestor personal data, per §12.1's boundary) but still requires notifying the DPO per the product's own governance stance |
| Pack version row found to have been edited in place after being referenced by signed-off assessments | HIGH | This is a defensibility incident, not just a data bug — every affected signed-off assessment's displayed `basis`/`citation` must be reconciled against what was actually reviewed (requires either an audit-log record of the pre-edit pack content, or accepting the gap is unrecoverable for those records); going forward, snapshot pack content onto the `Assessment` at compute time (not just a version string reference) as the durable fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Zero-decimal currency corruption (#1) | schemas (decimals map) + web (intake form) | Formatter unit-tested against all 9 `CurrencyCode`s before any money-display UI ships |
| Aggregate-cap rounding residue (#2) | engine | Golden-file fixture with a non-evenly-dividing `aggregateCap`; residue-allocation function independently unit-tested |
| Determinism leaks / false golden-file confidence (#3) | engine | CI test matrix across ≥2 `TZ`/`LANG` combinations; lint/grep rule banning `Date.now`, `Math.random`, locale-dependent calls inside `packages/engine` |
| RSC/caching/middleware leak of unreviewed data (#4) | web, and every subsequent phase adding an endpoint | AC-01/02-style test required in the PR for every new route handler/Server Action; explicit `cache: 'no-store'` audit |
| Automation-bias mitigations enforced only client-side (#5) | web | Dedicated server-side test file (`tests/auth/anti-automation-bias.spec.ts`) calling endpoints directly, bypassing UI; §9.6 monitoring shipped in the same phase as sign-off |
| Append-only audit bypass vectors beyond AC-34's literal scope (#6) | schemas/Prisma setup (pre-web) | One test per guarantee (no cascade FK, `REVOKE TRUNCATE` included, no soft-delete middleware, restricted role verified against runtime `DATABASE_URL`) |
| Mutable pack row after reference (#7) | rulepacks (loader/validator), before web's admin edit path ships | Immutability enforced once referenced; golden-file fixtures pin exact `packId`+`version`, never resolve "active pack" dynamically |
| LLM verbatim-match weak implementation + boundary erosion (#8) | agent (built last, per PRD §0), depends on schemas' shared formatter existing early | AC-36(c) implemented as substring-exhaustive, not substring-present; adversarial eval cases for fabricated sub-citations; `packages/agent` exports limited to the three named functions |

## Sources

- PRD-dsar-fee-agent.md §0, §5, §6, §7, §8, §9, §10, §13, §14, §15, §16 (primary source — every pitfall above is derived from a specific, cited PRD requirement or acceptance criterion, cross-referenced against known technical mechanics of the named stack)
- General technical mechanics referenced (HIGH confidence, standard documented behaviour, not project-specific claims): Next.js App Router `fetch()` caching defaults and RSC serialization semantics; Postgres `GRANT`/`REVOKE` privilege model (`TRUNCATE` as a distinct privilege from `DELETE`); Prisma `Decimal` type semantics vs. native `Int`; JavaScript floating-point and `Intl`/ICU locale-dependence; `Map`/`Set`/object key iteration order rules in V8.

---
*Pitfalls research for: DSAR Fee Assessment Agent (legal-tech deterministic engine + human sign-off)*
*Researched: 2026-09-13*
