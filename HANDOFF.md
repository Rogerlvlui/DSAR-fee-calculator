# HANDOFF — Phase 7.1 complete, Phase 8 next, both remaining pieces re-planned

**Written 2026-09-28.** This account loses access to this Claude Code session in ~2 days.
This file is the landing point for whoever picks the project up next — read this first,
then `.planning/STATE.md` (full decision log) and `docs/PRD-dsar-fee-agent.md` (the spec —
if the app and the PRD ever disagree, the PRD wins).

## Repo / branch state

- Primary repo: `Rogerlvlui/DSAR-fee-calculator`, branch `main`, local and origin both at
  `8186f74` (pushed 2026-09-26 — confirm this is still the HEAD when you resume).
- A second copy of this build lives in the LQ residency cohort repo,
  `LegalQuants/lq-residency-september-2026`, folder `lui-chun-fai/`, pushed to the same
  `8186f74` content as commit `d948fef` (2026-09-25). That copy is submission-facing, not a
  place to keep developing — do further work in the primary repo and re-sync that folder
  later if it needs to be current again.
- Working tree at last check: clean except normal untracked scratch files at the project
  root (docx notes, zips, `Copilot/`) — none of these are part of the product and none are
  tracked by git; ignore them.
- Full suite: **1112/1112 tests passing** as of quick task 260925-w7p; `typecheck`/`lint`/
  `depcruise` clean; `pnpm --filter @dsar/web build` (webpack) green.
- One known, pre-existing, not-yours-to-fix failure: `packages/schemas/src/json-schema.test.ts`'s
  byte-identical drift check fails on Windows checkouts (CRLF vs LF). Logged in
  `.planning/WINDOWS.md` (id 1, open).

## What's built vs. not, by phase

| Phase | Name | Status |
|---|---|---|
| 1 | Schemas Freeze and Walking Skeleton | ✅ complete |
| 2 | Deterministic Fee Engine | ✅ complete |
| 3 | Rule Packs and Pack Admin | ✅ complete |
| 3.1 | Demo Slice — In-Memory Determination Pipeline | ✅ complete |
| 3.2 | Database Boundary and Audit Immutability | ❌ not started (re-planned, see below) |
| 4 | Workflow and Audit Backbone | ✅ complete |
| 5 | HR Intake and Disclosure Shell | ✅ complete |
| 6 | Convergence and Legal Review | ✅ complete |
| 7 | Sign-off, Outputs and Edge States | ✅ complete |
| 7.1 | UI Redesign — Claude Design Adoption | ✅ complete |
| 8 | LLM Job 1 — Category Suggestion | ❌ not started, not yet discussed/planned |

`apps/web` delivers the full PRD §10 screen set — HR intake, legal review, sign-off, the
internal-record PDF, HR/requestor outputs, every §10.7 edge state, and (new in 7.1) a
`DPO_ADMIN`-gated `/admin/audit` trail screen — all restyled to match
`docs/dsar-fee-agent-mockup-simplified.html`'s actual visual system (self-hosted
Newsreader/IBM Plex Sans/IBM Plex Mono, card/eyebrow/callout/summary-row patterns). All of
it still runs against the **in-memory repository** — Phase 3.2 (Postgres) is the one
architectural piece genuinely still outstanding.

## What's happened since the last handoff snapshot (2026-09-22 → 2026-09-26)

In rough order:

1. **Fixed the Tailwind v4 pipeline** that had silently never compiled since Phase 3.1 (no
   `@tailwindcss/postcss`/postcss config existed) — added the plugin, a permanent
   regression gate (`tests/toolchain/css-pipeline.test.ts`), and worked around this build
   machine's Turbopack segfault with `--webpack` (`.planning/WINDOWS.md` entry 4).
2. **Phase 7.1 executed in full** (both plans): Claude-Design restyle wave (fonts, DISALLOW
   pill colour fix, verdict-accent bars, HR intake's numbered sections, letter-styled HR
   result/notice) and the new `/admin/audit` Audit trail screen end to end. Suite went
   1072 → 1095. Independently verified, all 5 ROADMAP success criteria met.
3. **Phase 3.2 context session** (2026-09-23): a repository-swap approach was decided
   (D-11/D-12/D-13, in `.planning/phases/03.2-.../03.2-CONTEXT.md`) — but this **postdates**
   the existing `03.2-01/02/03-PLAN.md` files, which the context file itself flags:
   **"Plans 03.2-01/02/03 predate the repository-swap decision above — replan before
   executing."** Don't execute those plans as written; replan Phase 3.2 first.
4. **A string of quick tasks** (260923-w1p through 260925-w7p) fixing things found in demo
   rehearsals: restyled the status strip and audit-trail table (missed spots in 7.1),
   combined the Legal and DPO demo identities, required a real description on "Something
   else" lines, required a positive amount on Allow/Reduce dispositions, and four small
   rehearsal fixes (headline pluralisation, sign-off date on the HR notice, `/hr/matters/new`
   dynamic rendering, `apps/web`'s build script pinned to `--webpack`).
5. **A separate PR (#4, `codex/demo-ux-review-fixes`)** merged in "Polish DSAR demo flow and
   fix PDF runtime" — worth reading its diff if you weren't the one who reviewed it, since
   it didn't go through the usual GSD quick-task flow.
6. `docs/DEMO-WALKTHROUGH.md` was kept current throughout — it's now the accurate
   presenter script against the production (`--webpack`) build, including the zero-amount
   rule (PRD §6.4, newly documented) and the review-card order actually seen in rehearsal.

## The two remaining pieces, and what each actually needs

**Phase 3.2 — Database Boundary and Audit Immutability.**
- Needs Docker available (it wasn't on this build machine as of Phase 1 — check first).
- **Replan before executing** — see point 3 above. The context/decisions (D-04 through D-13)
  are current and correct; only the three PLAN.md files need redoing against them.
- Scope: `prisma migrate dev`'s first migration; the two Postgres roles (`dsar_migrator` /
  `dsar_runtime`) with GRANT/REVOKE; a startup assertion that fails fast if the runtime
  connects as `dsar_migrator` (D-08); a Testcontainers-backed integration test proving the
  GRANT boundary (AC-34); Prisma-backed implementations of `MatterRepository`/
  `AssessmentRepository` dropped in behind the existing in-memory ones via a new
  `repositories/active.ts` composition module (D-11/D-12), selected by whether
  `RUNTIME_DATABASE_URL` is set (D-13) — **`apps/web/src/server/repositories/interface.ts`
  itself must not change**, and no UI/route call site should need to.

**Phase 8 — LLM Job 1 (Category Suggestion).**
- Not yet discussed or planned at all — start with a discuss-phase session.
- Builds `packages/agent`: suggests a category for an unclassified expense line only — no
  arithmetic, no rationale text the engine didn't already produce, no citation the engine
  didn't already cite (Non-negotiable #1, PRD §8.2).
- `/evals` gates any deploy of this package and nothing else.

Neither phase depends on the other; either can go first. `.planning/STATE.md`'s
frontmatter (`current_phase: 8`) reflects the last planning session's intent, not a
requirement that 3.2 wait — but given 3.2 needs a replan and Docker, confirm Docker's
available before committing to it over Phase 8.

## Assumptions a fresh session (or a new person) would get wrong

- **`apps/web` is not a demo-only slice waiting to be replaced.** Phase 3.1 built an
  in-memory demo shape; Phases 4–7.1 built the actual PRD §10 product on top of the *same*
  routes and repository interface. Only the persistence layer underneath is provisional.
- **Both reference rule packs (`SG-PDPA`, `HK-PDPO`) are still `status: "DRAFT"`.** Not a
  bug — full 21-category authoring and a named lawyer's sign-off are legal work, tracked in
  `docs/sg-pack-authoring-worksheet.md` / the AU worksheet. A pack can't reach `ACTIVE`
  while any `UNAUTHORED_TOKEN`-marked rule remains. The engine coerces an in-memory copy to
  `ACTIVE` for local running only; the committed file is never edited.
- **The CSS pipeline bug hid behind a fully green test suite for six phases.** If a future
  visual change looks unstyled in the browser despite passing tests, check
  `tests/toolchain/css-pipeline.test.ts` is actually running and compiling — a green suite
  alone doesn't prove the UI renders as designed.
- **This build machine has a documented Turbopack segfault** (`.planning/WINDOWS.md` #4).
  `apps/web`'s `build`/`dev` scripts are pinned to `--webpack` deliberately — don't "fix"
  them back to Turbopack without checking whether the new machine has the same issue.
- **`workflow.use_worktrees` is `false` project-wide.** Plans execute sequentially on the
  main tree regardless of whether their `files_modified` lists overlap.
- **Phase 3.2's existing PLAN.md files are stale relative to its own CONTEXT.md.** See "the
  two remaining pieces" above — don't execute them without replanning first.
- **PR #4 (`codex/demo-ux-review-fixes`) landed outside the GSD quick-task flow.** If you're
  auditing what changed and why, its own PR description is the record, not a
  `.planning/quick/` entry.

## Where everything lives

- Spec: `docs/PRD-dsar-fee-agent.md` (source of truth), `docs/dsar-fee-agent-mockup.html`
  (Annex A structure), `docs/dsar-fee-agent-mockup-simplified.html` (current visual design
  reference — self-extracting bundle, not readable as source).
- Full decision log, per phase: `.planning/STATE.md` + `.planning/phases/<NN>/`
  (PLAN/SUMMARY/REVIEW/VERIFICATION per plan).
- Windows-specific gotchas (Turbopack segfault, the schema drift test): `.planning/WINDOWS.md`.
- Presenter script for demoing the app: `docs/DEMO-WALKTHROUGH.md`.
- Build/test commands: root `package.json` scripts, also listed in `CLAUDE.md`.
