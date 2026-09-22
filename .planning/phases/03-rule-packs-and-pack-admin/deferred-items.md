# Phase 03 — Deferred / Out-of-Scope Items

Discoveries made during plan execution that are out of scope for the
current task (per the executor's SCOPE BOUNDARY rule) and are not fixed.

## 03-01: pre-existing CRLF/LF drift in packages/schemas/src/json-schema.test.ts

**Discovered during:** Task 1 verification (`pnpm vitest run --project schemas`).

**Symptom:** `json-schema.test.ts`'s "regenerated output is byte-identical to
the committed artifact (frozen-type drift check)" test fails —
`packages/schemas/schema/assessment.schema.json` is committed with CRLF
line endings (this repo's git checkout normalizes to CRLF on Windows via
`core.autocrlf`), while `JSON.stringify(...) + "\n"` always emits bare `\n`.
The content is otherwise byte-identical; only the line-ending convention
differs.

**Confirmed pre-existing, not caused by this plan:** reproduced with all of
this plan's changes stashed (`git stash push -u`), against the unmodified
Phase 1/2 baseline. Same failure, same diff shape.

**Not fixed here** — out of scope for plan 03-01 (packages/rulepacks and its
two additive schema exports), which never touches `assessment.ts`,
`json-schema.ts`, or the committed `packages/schemas/schema/*.schema.json`
artifacts. Fixing a CRLF/LF policy question (normalize the committed
artifact's line endings, or force LF via `.gitattributes`) is a repo-wide
tooling decision, not a rule-pack change.

**Recommended follow-up:** add a `.gitattributes` entry forcing LF for
`packages/schemas/schema/*.schema.json` (and likely all `*.json`/`*.ts`
sources, to stop the warnings `git add` prints on every commit on this
checkout), then regenerate via `pnpm schema:json` once.
