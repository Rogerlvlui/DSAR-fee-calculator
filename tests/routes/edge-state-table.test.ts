// tests/routes/edge-state-table.test.ts
//
// PRD §10.7's full empty/error/edge-state table (DISC-06), proven row by
// row, in the table's own order, tagged EDGE-STATE-TABLE. One `describe`
// per row, each titled with that row's own State cell text, so this file
// reads like §10.7 itself — a reader can check the table against the tests
// line for line. Most of §10.7 was built in earlier phases (the intake
// blocks in Phase 5, the recompute banner in Phase 6, the engine-error
// rollback in Phase 4); this file's own job is proving all seven still hold
// together, not rebuilding any of them. Where an assertion is already made
// in another test file, it is still made here too, with a cross-reference
// comment naming that file — the value of this file is that all seven rows
// are visible in one place.
//
// Three rows could not be proven exactly as first planned, once checked
// against this codebase's actual, frozen architecture rather than an
// assumption about it — the same class of plan/reality correction this
// phase's own 07-03 and 07-04 plans already recorded (DOC-04's SG-PDPA to
// JP-APPI substitution; the HK line-item fixture correction):
//
//   1. "No pack for jurisdiction"'s server-side refusal cannot be reached
//      through the real committed pack directory: all nine schema-valid
//      jurisdiction codes have a committed pack file (apps/web/src/server/
//      jurisdiction-packs.ts's own JURISDICTION_PACKS list), so
//      buildJurisdictionPackViews() never actually returns NO_USABLE_PACK
//      in this deployed set — jurisdiction-packs.test.ts already proves the
//      pure resolveJurisdictionPackViews() branch the same way. This file
//      partially mocks apps/web/src/server/jurisdiction-packs.ts's
//      buildJurisdictionPackViews export (delegating to the real
//      implementation for every call except the one this row overrides) so
//      the real server-side route can be driven through the one condition
//      that cannot occur with real pack data.
//   2. "Pack STALE"'s first half ("new matters blocked with the reason")
//      cannot be reached through the real submit route either:
//      apps/web/src/server/guard-input.ts's own documented DEMO-ONLY
//      coercion (coercePackForDemoEngine) unconditionally forces every
//      pack's status to ACTIVE before the SUBMIT guard ever runs, precisely
//      because every committed pack is honestly DRAFT and cannot yet reach
//      an authored ACTIVE state (D-16). packages/workflow/src/evaluate-
//      transition.test.ts already proves this exact guard row directly
//      against a STALE GuardInput; this file reuses the identical
//      technique (the real, uncoerced packages/workflow guard, called
//      directly) so the row still reads complete here, with this same
//      explanation recorded inline at the point it applies.
//   3. "Currency mismatch" sub-case (a) ("a second expense line whose
//      currency differs from the matter's") cannot be constructed at all:
//      packages/schemas/src/expense-line.ts's ExpenseLineSchema (frozen
//      since Phase 1, PRD §6.2) carries no currency field of its own — the
//      PRD's own §6.2 comment reads "unitRate: number; // in matter
//      currency" — currency is deliberately a matter-level-only property,
//      the same repeatedly-recorded architectural decision already
//      documented for Assessment.feeChoice and RulePack.flatFee (neither
//      carries a currency sub-field either, per assessment.ts's and
//      rule-pack.ts's own module comments). This row's test proves the
//      structural guarantee that makes the PRD's sub-case (a) unreachable,
//      rather than fabricating a refusal path that does not exist.
//
// None of these three are gaps this plan introduces or should fix — they
// are pre-existing, deliberate architectural facts (D-16's demo coercion;
// the Phase-1 schema freeze), recorded here because DISC-06's job is to
// prove what §10.7 actually says happens, honestly, not what a plan assumed
// would happen.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { POST as recomputeRoute } from "../../apps/web/app/api/assessments/[id]/recompute/route.ts";

import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { getAssessmentForLegalReview, getSignedOffAssessmentForHr } from "../../apps/web/src/server/data/assessments.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";
import { resolvePinnedRulePack } from "../../apps/web/src/server/engine-invocation.ts";
import { buildNoticeDraft } from "../../apps/web/src/domain/notice-draft.ts";
import { shouldRenderStalePackNotice } from "../../apps/web/src/domain/stale-pack-notice.ts";
import { renderAttestation } from "../../apps/web/src/domain/attestation.ts";
import { shouldRenderRecomputeBanner } from "../../apps/web/src/domain/recompute-banner.ts";
import {
  MatterDetailsFields,
  canOfferExpenseEntry,
  type MatterDetailsJurisdictionPack,
  type MatterDetailsValue,
} from "../../apps/web/src/ui/intake/matter-details-fields.tsx";
import { ResultView } from "../../apps/web/src/ui/hr/result-view.tsx";

import { resolveRulePack } from "@dsar/rulepacks/loader";
import { AssessmentLineSchema, AssessmentSchema } from "@dsar/schemas/assessment";
import { ExpenseLineSchema } from "@dsar/schemas/expense-line";
import { toMinor } from "@dsar/schemas/primitives";
import type { GuardInput } from "@dsar/schemas/guard-input";
import { evaluateTransition } from "@dsar/workflow/evaluate-transition";

// Partial mock (T-07-06 deviation #1 above): every export except
// buildJurisdictionPackViews passes through unchanged (`...actual`), and
// buildJurisdictionPackViews itself is wrapped in `vi.fn(actual....)`,
// which DELEGATES to the real implementation unless a specific test
// overrides it with `mockReturnValueOnce`. Every row in this file other
// than "No pack for jurisdiction" gets the real, unmodified production
// behaviour.
vi.mock("../../apps/web/src/server/jurisdiction-packs.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/src/server/jurisdiction-packs.ts")>();
  return { ...actual, buildJurisdictionPackViews: vi.fn(actual.buildJurisdictionPackViews) };
});
import { buildJurisdictionPackViews } from "../../apps/web/src/server/jurisdiction-packs.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// apps/web/src/ui/review/recompute-confirm.tsx imports "next/navigation"
// unconditionally at module scope, which does not resolve under this
// project's inherited "nodenext" resolution — loaded via a computed-path
// dynamic import, the same technique tests/boundary/ui-banned-words.test.ts
// and tests/routes/legal-queue.test.ts already established for this exact
// class of file, so `tsc --build` never has to resolve "next/navigation"
// for a component whose pure *View half never calls it.
const { RecomputeConfirmView } = (await import(
  pathToFileURL(path.join(REPO_ROOT, "apps", "web", "src", "ui", "review", "recompute-confirm.tsx")).href
)) as { RecomputeConfirmView: (props: Record<string, unknown>) => React.ReactElement };

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

function jsonRequest(url: string, method: string, body: unknown, cookie: string = HR_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-EDGE-${String(matterCounter).padStart(4, "0")}`;
}

const VALID_MATTER_INPUT_BASE = {
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-09-01",
  requestorClass: "FORMER_EMPLOYEE",
  currency: "SGD",
  identityVerified: true,
  identityVerifiedNote: null,
  scopeClarified: true,
  isRepeatRequestWithin12Months: false,
  isKnownDisputeOrLitigation: false,
};

// The same four-line composition tests/routes/recompute.test.ts and
// tests/routes/notice-outputs.test.ts already established: one line of
// each verdict, none over the engine's own 40% cross-line MATERIALITY
// threshold — reused verbatim rather than re-derived, per this project's
// "reuse a proven fixture rather than hand-trim a new one" precedent
// (07-04-SUMMARY.md's own recorded HK fixture bug).
const LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Staff time locating and retrieving the requested records",
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
    description: "Staff time deciding which items may be withheld under an exemption",
    quantity: 60,
    unit: "HOUR",
    unitRate: 1000,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "PHOTOCOPY_PRINT",
    description: "Photocopying the paginated response for physical delivery",
    quantity: 220,
    unit: "PAGE",
    unitRate: 15,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
  {
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Meeting room and refreshments for the internal review session",
    quantity: 1,
    unit: "FIXED",
    unitRate: 4500,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  },
];

interface FixtureAssessmentLine {
  id: string;
  verdict: string;
  disposition: string;
  flagReasons: { code: string; message: string }[];
}

interface FixtureAssessment {
  id: string;
  matterId: string;
  rulePackId: string;
  rulePackVersion: string;
  lines: FixtureAssessmentLine[];
  totals: { draftBaseline: number; finalAmount: number | null };
}

async function createMatterWithLines(overrides: Partial<typeof VALID_MATTER_INPUT_BASE> = {}): Promise<{ id: string }> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, ...overrides, reference: nextReference() }, HR_COOKIE)
  );
  const matter = (await matterResponse.json()) as { id: string };
  for (const input of LINE_INPUTS) {
    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(response.status).toBe(201);
  }
  return matter;
}

async function submitMatter(matterId: string): Promise<FixtureAssessment> {
  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matterId}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matterId }),
  });
  expect(submitResponse.status).toBe(200);
  return (await submitResponse.json()) as FixtureAssessment;
}

function findLine(assessment: FixtureAssessment, verdict: string): FixtureAssessmentLine {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) throw new Error(`fixture has no ${verdict} line`);
  return line;
}

async function strikeLine(lineId: string): Promise<void> {
  const response = await dispositionRoute(
    jsonRequest(`http://localhost/api/assessment-lines/${lineId}/disposition`, "POST", { action: "STRIKE", reason: GOOD_REASON }, LEGAL_COOKIE),
    { params: Promise.resolve({ id: lineId }) }
  );
  expect(response.status).toBe(200);
}

async function acceptLine(lineId: string): Promise<void> {
  const response = await dispositionRoute(
    jsonRequest(`http://localhost/api/assessment-lines/${lineId}/disposition`, "POST", { action: "ACCEPT", reason: GOOD_REASON }, LEGAL_COOKIE),
    { params: Promise.resolve({ id: lineId }) }
  );
  expect(response.status).toBe(200);
}

async function signOffFixture(assessmentId: string): Promise<Response> {
  return signoffRoute(
    jsonRequest(
      `${ASSESSMENTS_URL}/${assessmentId}/signoff`,
      "POST",
      { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: assessmentId }) }
  );
}

// ---------------------------------------------------------------------------
// Completeness tracking (T-07-06-02) — row() records its own PRD-cell title
// as a side effect of being called at collection time, before any `it()`
// runs. A row deleted in a later edit shrinks this array, reddening the
// final completeness assertion below rather than leaving a silent gap.
// ---------------------------------------------------------------------------

const registeredRowTitles: string[] = [];

function row(prdStateCell: string, body: () => void): void {
  registeredRowTitles.push(prdStateCell);
  describe(`EDGE-STATE-TABLE — ${prdStateCell}`, body);
}

const PRD_10_7_STATE_CELLS = [
  "No pack for jurisdiction",
  "Pack `STALE`",
  "Pack activated mid-review",
  "Engine error",
  "LLM unavailable",
  "Zero allowable",
  "Currency mismatch",
];

// ---------------------------------------------------------------------------
// Row 1 — No pack for jurisdiction
// ---------------------------------------------------------------------------

row("No pack for jurisdiction", () => {
  function value(overrides: Partial<MatterDetailsValue> = {}): MatterDetailsValue {
    return {
      reference: "DSAR-EDGE-0001",
      jurisdictionCode: "SG",
      legalEntity: "Acme Pte Ltd",
      controllerType: "PRIVATE_ORGANISATION",
      requestReceivedOn: "2026-08-20",
      requestorClass: "FORMER_EMPLOYEE",
      ...overrides,
    };
  }

  function noUsablePack(overrides: Partial<MatterDetailsJurisdictionPack> = {}): MatterDetailsJurisdictionPack {
    return {
      jurisdictionCode: "SG",
      jurisdictionName: "Singapore",
      packId: null,
      version: null,
      displayStatus: "NO_USABLE_PACK",
      daysUntilReviewDue: null,
      feePosture: null,
      ...overrides,
    };
  }

  it("EDGE-STATE-TABLE: intake renders the Contact-Legal message and offers no expense entry when the jurisdiction has no usable pack (see matter-details-fields.test.tsx for the full UI proof)", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatterDetailsFields, {
        value: value(),
        onChange: () => {},
        currency: "SGD",
        jurisdictionPack: noUsablePack(),
      })
    );
    expect(html).toContain("No usable rule pack — contact Legal");
    expect(canOfferExpenseEntry(noUsablePack(), "PRIVATE_ORGANISATION")).toBe(false);
  });

  it("EDGE-STATE-TABLE: a direct POST to add an expense line on a matter whose jurisdiction has no usable pack is refused server-side with 409, naming the jurisdiction — not merely hidden by the UI", async () => {
    const matterResponse = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, reference: nextReference() }, HR_COOKIE)
    );
    const created = (await matterResponse.json()) as { id: string };

    const now = new Date().toISOString();
    const realViews = buildJurisdictionPackViews(now);
    vi.mocked(buildJurisdictionPackViews).mockReturnValueOnce({
      ...realViews,
      SG: { ...realViews.SG, packId: null, version: null, displayStatus: "NO_USABLE_PACK", feePosture: null },
    });

    const response = await addLineRoute(
      jsonRequest(`${MATTERS_URL}/${created.id}/lines`, "POST", LINE_INPUTS[0], HR_COOKIE),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/no usable rule pack/i);
    expect(body.error).toContain("SG");
  });
});

// ---------------------------------------------------------------------------
// Row 2 — Pack `STALE`
// ---------------------------------------------------------------------------

row("Pack `STALE`", () => {
  it("EDGE-STATE-TABLE: a new matter in a stale-pack jurisdiction is refused at the SUBMIT guard, naming the review-due date — proven directly against packages/workflow's real guard table (see this file's own header note on why the live route cannot exercise this in the current demo build, and packages/workflow/src/evaluate-transition.test.ts for the same row proven independently)", () => {
    const staleGuardInput: GuardInput = {
      matterStatus: "DRAFT",
      expenseLineCount: 1,
      jurisdictionCode: "SG",
      currency: "SGD",
      controllerType: "PRIVATE_ORGANISATION",
      pack: { status: "STALE", reviewDueOn: "2020-01-01", appliesTo: ["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"] },
      attestationsAddressed: true,
      pendingLineCount: 0,
      matterLevelFlagsRequiringAck: [],
      acknowledgedFlags: [],
      lawyerIdentity: null,
    };

    const outcome = evaluateTransition("DRAFT", "SUBMIT", staleGuardInput);
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.reason).toContain("STALE");
      expect(outcome.reason).toContain("past its review date");
      expect(outcome.reason).toContain("2020-01-01");
    }
  });

  it("EDGE-STATE-TABLE: an in-flight matter whose pinned pack has since gone stale still resolves for legal review (no staleness gate exists on the review read at all), and the stale-pack notice / extended attestation correctly activate for it", async () => {
    const matter = await createMatterWithLines();
    const assessment = await submitMatter(matter.id);

    const reviewed = await getAssessmentForLegalReview(DEMO_USERS.LEGAL_REVIEWER, assessment.id);
    expect(reviewed.id).toBe(assessment.id);

    // Every committed pack's real reviewDueOn (2027-03-12) is never stale
    // today, and its real committed status is honestly DRAFT (D-16) — not
    // ACTIVE, since deriveEffectiveStatus only ever downgrades ACTIVE to
    // STALE, never upgrades DRAFT. Synthesize the condition by spreading
    // the assessment's own real pinned pack and overriding BOTH status and
    // reviewDueOn, the same technique apps/web/src/domain/stale-pack-notice.
    // test.ts and Phase 06 both established, never a hand-built literal
    // that could drift from the real committed shape.
    const realPinnedPack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
    const staleOverridePinnedPack = { ...realPinnedPack, status: "ACTIVE" as const, reviewDueOn: "2020-01-01" };
    const now = new Date().toISOString();
    expect(shouldRenderStalePackNotice(staleOverridePinnedPack, now)).toBe(true);

    const attestationText = renderAttestation({
      jurisdiction: realPinnedPack.jurisdiction.name,
      packId: realPinnedPack.packId,
      packVersion: realPinnedPack.version,
      reviewedOn: realPinnedPack.reviewedOn,
      packIsStale: true,
    });
    expect(attestationText).toContain(
      "I am aware this rule pack is past its review date and I have satisfied myself as to the current position."
    );
  });
});

// ---------------------------------------------------------------------------
// Row 3 — Pack activated mid-review
// ---------------------------------------------------------------------------

row("Pack activated mid-review", () => {
  const TWO_VERSION_ROOT = path.resolve(REPO_ROOT, "packages", "rulepacks", "src", "__fixtures__", "versions");

  it("EDGE-STATE-TABLE: the recompute banner's predicate is true and its rendered copy names both the pinned and the new version, matching §10.7's quoted wording — proven against the two-version synthetic ACME-FIXTURE pack, since no real committed pack has a second version (see recompute-banner.test.ts / recompute-confirm.test.tsx for the same component proven independently)", () => {
    const pinnedFixturePack = resolveRulePack("ACME-FIXTURE", "2026.01.1", TWO_VERSION_ROOT);
    const newerFixturePack = resolveRulePack("ACME-FIXTURE", "2026.06.1", TWO_VERSION_ROOT);

    expect(shouldRenderRecomputeBanner(pinnedFixturePack.version, newerFixturePack.version)).toBe(true);

    const html = renderToStaticMarkup(
      React.createElement(RecomputeConfirmView, {
        pinnedVersion: pinnedFixturePack.version,
        newVersion: newerFixturePack.version,
        expanded: false,
        pending: false,
        error: null,
        onExpand: () => {},
        onCancel: () => {},
        onConfirm: () => {},
      })
    );
    expect(html).toContain(`A newer rule pack (${newerFixturePack.version}) is now active.`);
    expect(html).toContain(`This assessment uses ${pinnedFixturePack.version}.`);
  });

  it("EDGE-STATE-TABLE: the assessment keeps its pinned version regardless of a newer version becoming current elsewhere, and a confirmed recompute clears every disposition while keeping the same assessment id (see tests/routes/recompute.test.ts for the full STATE-03 proof)", async () => {
    const matter = await createMatterWithLines();
    const assessment = await submitMatter(matter.id);
    const originalPinnedVersion = assessment.rulePackVersion;

    // "A newer version becomes current" is independently true of the
    // ACME-FIXTURE pair (2026.06.1 postdates 2026.01.1) — nothing in this
    // codebase ever reads that unrelated fixture pack when resolving THIS
    // matter's own jurisdiction pack, which is exactly the point: without
    // an explicit, confirmed recompute, nothing changes the stored
    // assessment's pinned version at all.
    const unchanged = await memoryAssessmentRepository.getAssessment(assessment.id);
    expect(unchanged?.rulePackVersion).toBe(originalPinnedVersion);

    const allowLine = findLine(assessment, "ALLOW");
    await acceptLine(allowLine.id);

    const recomputeResponse = await recomputeRoute(
      jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/recompute`, "POST", {}, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(recomputeResponse.status).toBe(200);
    const recomputed = (await recomputeResponse.json()) as FixtureAssessment;
    expect(recomputed.id).toBe(assessment.id);

    const assessmentsForMatter = [...demoStore.assessments.values()].filter((a) => a.matterId === assessment.matterId);
    expect(assessmentsForMatter).toHaveLength(1);

    const stored = await memoryAssessmentRepository.getAssessment(assessment.id);
    for (const line of stored?.lines ?? []) {
      expect(line.disposition).toBe("PENDING");
      expect(line.lawyerAmount).toBeNull();
      expect(line.lawyerReason).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Row 4 — Engine error
// ---------------------------------------------------------------------------

row("Engine error", () => {
  it("EDGE-STATE-TABLE: when the engine throws, the matter returns to DRAFT with the typed error, and no assessment — partial or otherwise — is ever stored for it (see tests/routes/audit-trail.test.ts for the same rollback path proven with full audit-record assertions)", async () => {
    // PUBLIC_AGENCY is outside SG-PDPA's own appliesTo list, but the SUBMIT
    // guard does not check controllerType (only the engine's own
    // precondition does) — the matter is created and its lines added as
    // PRIVATE_ORGANISATION (assertJurisdictionAllowsExpenseEntry would
    // otherwise refuse a PUBLIC_AGENCY line directly), then mutated to
    // PUBLIC_AGENCY on the repository after creation, the same technique
    // tests/routes/audit-trail.test.ts already established.
    const matter = await createMatterWithLines();
    const draftMatter = await memoryMatterRepository.getMatter(matter.id);
    if (!draftMatter) throw new Error("expected matter to exist");
    await memoryMatterRepository.updateMatter({ ...draftMatter, controllerType: "PUBLIC_AGENCY" });

    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(500);

    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("DRAFT");

    const storedAssessment = await memoryAssessmentRepository.getAssessmentByMatterId(matter.id);
    expect(storedAssessment).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Row 5 — LLM unavailable
// ---------------------------------------------------------------------------

row("LLM unavailable", () => {
  // Genuinely not exercisable this phase: packages/agent does not exist,
  // and LLM-08/AC-28 (the requirement that owns this row) is Phase 8's job
  // (.planning/ROADMAP.md's Phase 8 entry). This is a named, EXECUTING
  // case that records the gap as it actually stands today, rather than a
  // skipped test that would report green for something never checked.
  it("EDGE-STATE-TABLE: packages/agent does not exist yet, no assessment field anywhere is marked as model-generated, and LLM-08/AC-28 is recorded as outstanding in REQUIREMENTS.md — this row is a recorded gap, owned by Phase 8, not a silent pass", () => {
    const agentPackageDir = path.resolve(REPO_ROOT, "packages", "agent");
    expect(existsSync(agentPackageDir)).toBe(false);

    const bannedAiFieldNames = ["aiGenerated", "aiDrafted", "modelGenerated", "promptVersion", "llmGenerated"];
    const assessmentKeys = Object.keys(AssessmentSchema.shape);
    const lineKeys = Object.keys(AssessmentLineSchema.shape);
    for (const banned of bannedAiFieldNames) {
      expect(assessmentKeys).not.toContain(banned);
      expect(lineKeys).not.toContain(banned);
    }

    const requirementsText = readFileSync(path.join(REPO_ROOT, ".planning", "REQUIREMENTS.md"), "utf8");
    expect(requirementsText).toContain(
      "- [ ] **LLM-08**: With the provider unavailable or returning invalid output, the assessment completes on template text and the UI says so (AC-28)"
    );
    expect(requirementsText).toMatch(/\|\s*LLM-08\s*\|\s*Phase 8\s*\|\s*Pending\s*\|/);
  });
});

// ---------------------------------------------------------------------------
// Row 6 — Zero allowable
// ---------------------------------------------------------------------------

row("Zero allowable", () => {
  it("EDGE-STATE-TABLE: a no-express-authority public-agency matter produces a zero-figure notice stating no fee is charged, and the result headline renders with the identical element/class a non-zero figure would use — an ordinary result, never an error (see tests/routes/notice-outputs.test.ts and result-view.test.tsx for the full DOC-04/SIGNOFF-05 round trip)", async () => {
    const matterResponse = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, jurisdictionCode: "JP", currency: "JPY", reference: nextReference() }, HR_COOKIE)
    );
    const matter = (await matterResponse.json()) as { id: string };

    for (const input of LINE_INPUTS) {
      const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input, HR_COOKIE), {
        params: Promise.resolve({ id: matter.id }),
      });
      expect(response.status).toBe(201);
    }

    // JP-APPI's appliesTo includes PUBLIC_AGENCY with feePosture
    // NO_EXPRESS_AUTHORITY (unlike SG-PDPA/HK-PDPO, both PRIVATE_ORGANISATION
    // -only) — the jurisdiction that actually reaches the branch this row
    // describes, per 07-03-SUMMARY.md's own recorded fixture correction.
    const draftMatter = await memoryMatterRepository.getMatter(matter.id);
    if (!draftMatter) throw new Error("expected matter to exist");
    await memoryMatterRepository.updateMatter({ ...draftMatter, controllerType: "PUBLIC_AGENCY" });

    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);
    const assessment = (await submitResponse.json()) as FixtureAssessment;
    expect(assessment.totals.draftBaseline).toBe(0);

    for (const line of assessment.lines) {
      await strikeLine(line.id);
    }

    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const signedOff = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, matter.id);
    expect(signedOff.totals.finalAmount).toBe(0);
    expect(signedOff.totals.finalAmount).not.toBeNull();

    const pack = resolvePinnedRulePack(signedOff.rulePackId, signedOff.rulePackVersion);
    const notice = buildNoticeDraft({
      template: pack.requestorNoticeTemplate,
      amount: toMinor(0),
      currency: "JPY",
      allowedLines: [],
      matterReference: draftMatter.reference,
      requestReceivedOn: draftMatter.requestReceivedOn,
    });
    expect(notice).toContain("This covers no chargeable items — no fee is charged.");

    const zeroHtml = renderToStaticMarkup(
      React.createElement(ResultView, {
        matterReference: "DSAR-EDGE-ZERO",
        finalAmount: toMinor(0),
        currency: "JPY",
        lawyerName: "Test Lawyer",
        qualification: "Advocate & Solicitor",
        signedAt: "2026-01-01",
        lines: [],
      })
    );
    const nonZeroHtml = renderToStaticMarkup(
      React.createElement(ResultView, {
        matterReference: "DSAR-EDGE-ZERO",
        finalAmount: toMinor(50000),
        currency: "JPY",
        lawyerName: "Test Lawyer",
        qualification: "Advocate & Solicitor",
        signedAt: "2026-01-01",
        lines: [],
      })
    );
    const headlineOpenTag = (html: string): string | undefined =>
      html.match(/<h1[^>]*data-testid="result-headline"[^>]*>/)?.[0];
    expect(headlineOpenTag(zeroHtml)).toBeDefined();
    expect(headlineOpenTag(zeroHtml)).toBe(headlineOpenTag(nonZeroHtml));
  });
});

// ---------------------------------------------------------------------------
// Row 7 — Currency mismatch
// ---------------------------------------------------------------------------

row("Currency mismatch", () => {
  it("EDGE-STATE-TABLE: sub-case (a) — an expense line cannot carry a currency different from its matter's, because ExpenseLineSchema has no currency field at all; the structural guarantee this makes true, proven directly rather than a fabricated refusal (see this file's own header note)", async () => {
    expect(Object.keys(ExpenseLineSchema.shape)).not.toContain("currency");

    const matter = await createMatterWithLines();
    // A crafted request naming a currency the matter does not have — the
    // production code never reads input.currency at all (apps/web/src/
    // server/data/matters.ts's addExpenseLine maps named fields
    // explicitly), so the created line carries no currency property
    // whatsoever, proving there is no mechanism by which one could diverge.
    const craftedLineInput = { ...LINE_INPUTS[0], currency: "JPY" };
    const response = await addLineRoute(
      jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", craftedLineInput, HR_COOKIE),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(response.status).toBe(201);
    const createdLine = (await response.json()) as Record<string, unknown>;
    expect(createdLine).not.toHaveProperty("currency");
  });

  it("EDGE-STATE-TABLE: sub-case (b) — a matter whose currency does not match its jurisdiction's designated currency is refused with 400, naming both currency codes (see tests/routes/intake.test.ts's INTAKE-08 case for the same proof)", async () => {
    const response = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, reference: nextReference(), jurisdictionCode: "SG", currency: "HKD" }, HR_COOKIE)
    );
    expect(response.status).toBe(400);

    const body = (await response.json()) as { issues?: { path: string[]; message: string }[] };
    const currencyIssue = body.issues?.find((issue) => issue.path.includes("currency"));
    expect(currencyIssue).toBeDefined();
    expect(currencyIssue?.message).toContain("HKD");
    expect(currencyIssue?.message).toContain("SGD");
  });
});

// ---------------------------------------------------------------------------
// Completeness (T-07-06-02) — pins the row count at seven and the titles at
// §10.7's own State cells in table order, so a row dropped in a later edit
// reddens this suite rather than silently vanishing.
// ---------------------------------------------------------------------------

describe("EDGE-STATE-TABLE — completeness", () => {
  it("EDGE-STATE-TABLE: exactly seven §10.7 rows are represented, titled and ordered exactly as the PRD's own table", () => {
    expect(registeredRowTitles).toHaveLength(7);
    expect(registeredRowTitles).toEqual(PRD_10_7_STATE_CELLS);
  });
});
