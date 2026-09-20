# Phase 7: Sign-off, Outputs and Edge States - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 10 (net-new + modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/server/data/assessments.ts` (`signOff()`, modified) | service | request-response / state-machine guard | itself (existing function, additive edits) | exact |
| `packages/audit/src/memory/pack-lifecycle-event-writer.ts` (read-only, consumed not modified) | service | CRUD (append/query) | n/a — already-built dependency | exact |
| `packages/documents/package.json` | config | n/a | `packages/workflow/package.json` | exact |
| `packages/documents/tsconfig.json` | config | n/a | `packages/workflow/tsconfig.json` (structure) + `apps/web/tsconfig.json` (jsx field only) | role-match |
| `packages/documents/src/internal-record-view.ts` | utility / transform | transform (pure data-shaping) | `apps/web/src/domain/notice-draft.ts` | exact |
| `packages/documents/src/internal-record-view.test.ts` | test | transform | `apps/web/src/domain/notice-draft.test.ts` / `review-tallies.test.ts` | exact |
| `packages/documents/src/internal-record-document.tsx` | component (server-rendered JSX, non-UI) | transform → binary output | none in-repo (net-new pattern); external lib usage per RESEARCH.md Code Example 1 | no analog |
| `packages/documents/src/internal-record-document.test.tsx` | test | smoke test | `apps/web/src/ui/review/signoff-panel.test.tsx` (jsx test conventions only) | partial |
| `apps/web/app/api/assessments/[id]/internal-record/route.ts` | route (Route Handler) | request-response, binary/file-I/O | `apps/web/app/api/assessments/[id]/signoff/route.ts` (control flow) — binary response shape has no analog, see RESEARCH.md Code Example 3 | role-match |
| `vitest.config.ts` (add `documents` project) | config | n/a | existing `workflow`/`web` project blocks in same file | exact |
| `tests/routes/signoff.test.ts` (modified: 400→409 assertions) | test | request-response | itself | exact |
| `apps/web/src/ui/review/signoff-panel.tsx` / `apps/web/src/ui/hr/result-view.tsx` (wiring only, no new pattern) | component | request-response | itself — no structural change, only prop/copy wiring | exact |

## Pattern Assignments

### `apps/web/src/server/data/assessments.ts` — `signOff()` (service, request-response)

**Analog:** itself, `apps/web/src/server/data/assessments.ts:398-495` (already read in full this session)

**Current guard sequence** (lines 398-414):
```typescript
export async function signOff(
  actor: DemoActor,
  assessmentId: string,
  input: SignOffInput
): Promise<SignOffResult> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  const matter = await requireAssessmentInLegalReview(assessment);

  if (assessment.lines.some((line) => line.disposition === "PENDING")) {
    throw new ValidationError("Every line must be dispositioned before sign-off");
  }
```

**Fix required (SIGNOFF-01, AC-16 — 409, name the pending lines):** replace the `ValidationError` above with `ConflictError`, and name lines by `ExpenseLine.seq`. Exact shape — RESEARCH.md Code Example 1:
```typescript
const lines = await memoryMatterRepository.listExpenseLines(matter.id); // move this fetch earlier
const expenseLineById = new Map(lines.map((line) => [line.id, line]));
const pendingLines = assessment.lines.filter((line) => line.disposition === "PENDING");
if (pendingLines.length > 0) {
  const seqList = pendingLines
    .map((line) => expenseLineById.get(line.expenseLineId)?.seq)
    .filter((seq): seq is number => seq !== undefined)
    .sort((a, b) => a - b)
    .map((seq) => `line ${seq}`)
    .join(", ");
  throw new ConflictError(
    `Sign-off refused — ${pendingLines.length} line(s) still need a decision: ${seqList}.`
  );
}
```
Copy matches 07-UI-SPEC.md's Copywriting Contract verbatim. `signoff-panel.tsx:29-34`'s existing `SIGN_OFF_FAILURE_PREFIX`/`SUFFIX` wrapper is unchanged — the new message slots into the existing `{detail}` placeholder.

**PACK-08 guard (net-new)** — insert after `pack` is resolved, before `computeFinalAmount`, following the file's own documented precedent comment at lines ~474-477 ("The guard is a second, STRUCTURAL check..."). RESEARCH.md Code Example 2:
```typescript
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";

const lifecycleEvents = await memoryPackLifecycleEventWriter.listByPack(
  assessment.rulePackId,
  assessment.rulePackVersion
);
const lastActivation = [...lifecycleEvents].reverse().find((event) => event.type === "PACK_ACTIVATED");
if (lastActivation && lastActivation.actor.id === actor.user.id) {
  throw new ForbiddenError( // 403 — same refusal class as ACCESS-04's requireRole (RESEARCH.md Open Question 2 recommendation)
    `Blocked — you activated rule pack ${assessment.rulePackId} ${assessment.rulePackVersion} in this session. ` +
    `Sign-off by the same person who activated the pack is not permitted; ask another reviewer with the ` +
    `Legal Reviewer role to sign off this assessment instead.`
  );
}
```
Note: RESEARCH.md's Open Question 2 leaves 409-vs-403 as a planner decision (recommends 403/`ForbiddenError`); confirm in the plan and use consistently with whichever the planner locks in.

**Error classes to reuse** — `apps/web/src/server/errors.ts` (read in full):
```typescript
export class ForbiddenError extends Error { readonly status = 403; ... }
export class NotFoundError extends Error { readonly status = 404; ... }
export class ConflictError extends Error { readonly status = 409; ... }
export class ValidationError extends Error { readonly status = 400; ... }
```
`errorToResponse()` in the same file is the single mapping point every route handler already delegates to — do not hand-roll a second mapper.

---

### `packages/documents/src/internal-record-view.ts` (utility/transform, pure)

**Analog:** `apps/web/src/domain/notice-draft.ts` (read in full — 76 lines)

**Imports pattern:**
```typescript
import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import type { CurrencyCode, Minor } from "@dsar/schemas/primitives";
import { formatMinor } from "@dsar/schemas/money";
```
No server import — lives under a pure `src/` module, importable from both a Route Handler and a plain unit test, per this file's own header comment: "Pure and lives under src/domain/ so it needs no server import to test or reuse."

**Core transform pattern** — pure function taking already-computed inputs, returning a plain value (never recomputing money):
```typescript
export function buildNoticeDraft({
  template, amount, currency, allowedLines, matterReference,
}: BuildNoticeDraftInput): string {
  const wording = isUnauthoredTemplate(template) ? NOTICE_NOT_YET_AUTHORED_STATEMENT : template;
  return [
    `Reference: ${matterReference}`,
    `Amount: ${formatMinor(amount, currency)}`,
    "",
    "What this covers:",
    itemisation(allowedLines, currency),
    "",
    wording,
  ].join("\n");
}
```
Zero-case handling directly reusable for DOC-04:
```typescript
function itemisation(allowedLines: readonly NoticeDraftAllowedLine[], currency: CurrencyCode): string {
  if (allowedLines.length === 0) {
    return "This covers no chargeable items — no fee is charged.";
  }
  return allowedLines.map((line) => `- ${line.description}: ${formatMinor(line.amount, currency)}`).join("\n");
}
```

**Apply to `buildInternalRecordView()`:** same shape — accept `Assessment`/`Matter`/`RulePack`/`SignOff`/`ExpenseLine[]` (already-computed), return a plain `InternalRecordView` object (RESEARCH.md's Pattern 1 gives the exact interface shape). Never recompute `finalAmount` or attestation text — read `assessment.signOff.finalAmount` and the stored attestation text as-is, matching `signOff()`'s own comment: "the only module in the codebase that writes finalAmount."

---

### `packages/documents/src/internal-record-document.tsx` (component, transform → binary)

**No in-repo analog** — this is the first `@react-pdf/renderer` usage in the codebase. Follow RESEARCH.md Architecture Pattern 1 exactly: this file imports `@react-pdf/renderer`'s JSX primitives and *only* the plain `InternalRecordView` object from `internal-record-view.ts` — never React-agnostic; never recomputes figures; never reads `Date.now()`/`new Date()` inside the JSX tree (Anti-Pattern in RESEARCH.md).

**De-risking requirement (RESEARCH.md Pitfall 4, Open Question 3):** before building the full dense table, a Wave-0 smoke test must prove `renderToBuffer()` works when `@react-pdf/renderer` is imported from `packages/documents` and called from an `apps/web` Route Handler (not just a Vitest unit test) — a known open upstream bug (`diegomura/react-pdf#3285`) affects exactly this monorepo shape. If it reproduces, fall back to keeping `packages/documents` pure-only and moving the JSX+`renderToBuffer()` call directly into `apps/web/src/server/documents/internal-record-pdf.tsx` so `@react-pdf/renderer` is `apps/web`'s own direct dependency.

---

### `apps/web/app/api/assessments/[id]/internal-record/route.ts` (route, request-response / binary)

**Analog (control-flow shape):** `apps/web/app/api/assessments/[id]/signoff/route.ts` (read in full — 29 lines)

**Full existing pattern to copy (parse params, resolve actor, delegate, map errors):**
```typescript
import { signOff, type SignOffInput } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId); // ids are colon-joined and percent-encoded from Next's dynamic segment
    const body = (await request.json()) as SignOffInput;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const result = await signOff(actor, id, body);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
```

**Deviation required for this file — binary response, not `Response.json`.** No existing route in this codebase returns non-JSON content; this is a genuinely new shape. Use GET (non-mutating, matches every existing read route's convention) and return a raw `Response` with a PDF body per RESEARCH.md Code Example 3:
```typescript
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    // requireRole(actor, "LEGAL_REVIEWER") via the existing data-layer function — the route
    // itself must also enforce this, defense-in-depth, not just page composition (ACCESS-05).
    const view = buildInternalRecordView(assessment, matter, pack, expenseLines);
    const buffer = await renderInternalRecordPdf(view);
    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${matter.reference}-internal-record.pdf"`,
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
```

---

### `packages/documents/package.json` (config)

**Analog:** `packages/workflow/package.json` (read in full)
```json
{
  "name": "@dsar/workflow",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./*": "./src/*.ts" },
  "dependencies": { "@dsar/schemas": "workspace:*" },
  "devDependencies": { "@types/node": "26.5.1" }
}
```
Adapt to `"name": "@dsar/documents"`, add `"@react-pdf/renderer": "4.9.0"` and `"react": "19.3.0"` to `dependencies` (react as a peer of `@react-pdf/renderer`).

### `packages/documents/tsconfig.json` (config)

**Analog (structure):** `packages/workflow/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```
**Required deviation (RESEARCH.md Pitfall 6):** must add `"jsx": "react-jsx"` to `compilerOptions` (not `"preserve"` — that's Next-specific and wrong here) and widen `include` to `["src/**/*.ts", "src/**/*.tsx"]`, since this package (unlike `workflow`) has `.tsx` files.

---

### `vitest.config.ts` — new `documents` project (config)

**Analog:** the existing `workflow` project block (plain node, no JSX) and the `web` project block (needs `oxc.jsx` override), both in the same file (read in full, lines 1-138).

**Plain-node half** (for `internal-record-view.test.ts`), copy the `workflow` shape:
```typescript
{
  test: {
    name: "documents",
    environment: "node",
    include: ["packages/documents/src/**/*.test.ts"],
  },
},
```
**JSX half** (for `internal-record-document.test.tsx`) needs the same override as `web` (lines 113-124):
```typescript
{
  oxc: {
    jsx: { runtime: "automatic", importSource: "react" },
  },
  test: {
    name: "documents-jsx", // or fold both globs into one project with the oxc override applied to all — planner's call
    environment: "node", // react-pdf's renderer does not need jsdom; only web's DOM tests do
    include: ["packages/documents/src/**/*.test.tsx"],
  },
},
```

---

### `tests/routes/signoff.test.ts` (test, modified)

**Analog:** itself. `tests/routes/signoff.test.ts:183` currently asserts:
```typescript
expect(response.status).toBe(400);
```
inside the test titled "sign-off with any line still pending is refused" (line 176) — must become `expect(response.status).toBe(409)` as part of implementing SIGNOFF-01 correctly (RESEARCH.md Pitfall 1: "do not fix the test to match the code; the PRD is authoritative"). Line 203's flag-acknowledgement assertion is a parallel, discretionary change (RESEARCH.md Open Question 1) — keep both assertions consistent with whatever status code the plan locks in.

**PACK-08 fixture technique** (RESEARCH.md Code Example 2, D-02) — construct a synthetic `PackLifecycleEvent` directly via the writer, bypassing any UI:
```typescript
import { memoryPackLifecycleEventWriter } from "../../packages/audit/src/memory/pack-lifecycle-event-writer.ts";
import { DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { packActivatedPayload } from "../../packages/audit/src/payload-builders.ts";

await memoryPackLifecycleEventWriter.append({
  packId: assessment.rulePackId,
  packVersion: assessment.rulePackVersion,
  actor: DEMO_USERS.LEGAL_REVIEWER.user, // same actor who will attempt sign-off — positive case
  actorRole: "RULEPACK_AUTHOR",
  at: new Date().toISOString(),
  type: "PACK_ACTIVATED",
  payload: packActivatedPayload("DRAFT", "ACTIVE"),
});
// then POST /assessments/{id}/signoff with the LEGAL_REVIEWER cookie — expect the blocked status, naming the pack.
```
Negative case: use any well-formed fixture `UserRef` distinct from `DEMO_USERS.LEGAL_REVIEWER.user` as the activation event's `actor` — do not attempt to construct a second `DemoActor` with role `LEGAL_REVIEWER` (the auth module's `DEMO_USERS` is a closed set of exactly one reviewer).

## Shared Patterns

### Error mapping (all new/modified server code)
**Source:** `apps/web/src/server/errors.ts` (full file read)
**Apply to:** `signOff()`'s new guard branches, the new internal-record Route Handler.
```typescript
export function errorToResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
  }
  if (isStatusCarryingError(error)) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return Response.json({ error: message }, { status: 500 });
}
```
Every route handler's catch block delegates here — never hand-roll a second status-mapping mechanism.

### Route Handler shape (request parsing, actor resolution, delegation)
**Source:** `apps/web/app/api/assessments/[id]/signoff/route.ts`
**Apply to:** the new `internal-record` Route Handler (GET variant, binary body instead of `Response.json`).

### Pure data-shaping before rendering/writing
**Source:** `apps/web/src/domain/notice-draft.ts` (text), `apps/web/src/domain/review-tallies.ts` and `apps/web/src/domain/attestation.ts` (referenced in CONTEXT.md as the same-module precedent `signOff()` itself reads from)
**Apply to:** `packages/documents/src/internal-record-view.ts` — one pure function producing a plain, deep-comparable object; the JSX/PDF layer only ever consumes that object, never recomputes.

### Money formatting
**Source:** `@dsar/schemas/money`'s `formatMinor`, used in `notice-draft.ts`
**Apply to:** both `internal-record-view.ts` and any PDF `<Text>` node that renders a figure — never inline currency formatting.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/documents/src/internal-record-document.tsx` | component | transform → binary | First `@react-pdf/renderer` usage in this codebase; no existing PDF-generation code to copy structurally. Use RESEARCH.md's Code Examples/Architecture Patterns sections directly (Pattern 1, Pattern 2, Pitfalls 4-6) as the source of truth instead of an in-repo analog. |

## Metadata

**Analog search scope:** `apps/web/src/server/data/`, `apps/web/src/server/errors.ts`, `apps/web/app/api/**`, `apps/web/src/domain/`, `packages/workflow/`, `packages/audit/src/memory/`, `vitest.config.ts`, `tests/routes/signoff.test.ts`
**Files scanned:** 14 (read in full or targeted) + directory listings of `packages/`, `apps/web/src/server/data`, `apps/web/src/ui/review`, `apps/web/src/ui/hr`, `packages/audit/src/memory`, `packages/schemas/src`
**Pattern extraction date:** 2026-09-20
