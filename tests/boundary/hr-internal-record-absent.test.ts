// tests/boundary/hr-internal-record-absent.test.ts
//
// ACCESS-05's remaining half, tagged ACCESS-05. 07-01/07-04's own route
// tests already prove the internal-record endpoint itself refuses a
// non-reviewer (403 for HR_PREPARER); this file proves the complementary
// property — that no HR-reachable surface OFFERS the download trigger or
// LEAKS the lawyer's own rationale — as an observed absence, not a
// convention, mirroring tests/boundary/dom-denylist.test.ts's own
// three-half glob+component+canary structure. That file's own header
// records the exact failure mode a scan finding nothing must guard
// against: passing vacuously because it found nothing to scan.
//
// Three halves:
//
//   1. Reachability scan over source — every file under the HR route tree
//      (apps/web/app/hr/**) and every module those files import,
//      transitively, via relative imports only. A workspace-package import
//      (e.g. "@dsar/schemas/...") is a resolution boundary this scan does
//      not cross — it never needs to, since it can never itself resolve to
//      apps/web/src/ui/review/internal-record-download.tsx or the route
//      handler under apps/web/app/api/**, both of which are reached only by
//      relative imports within apps/web. Asserts at least one HR page file
//      was discovered (so the scan cannot pass by walking an empty set) and
//      that none of the reached files' source text names the
//      internal-record endpoint path or the download trigger's label.
//
//   2. Payload scan — drives a real matter through submit, mixed
//      dispositions (a genuine REDUCE and a genuine STRIKE, each carrying a
//      distinctive recorded reason) and sign-off. Then rebuilds exactly
//      what apps/web/app/hr/matters/[id]/page.tsx hands down to
//      ResultView/NoticeBlock for rendering — the derived
//      ResultViewLine[] and the notice draft text, the actual values that
//      cross into what an HR user's browser receives — never the raw
//      Assessment/ExpenseLine objects the page fetches server-side only to
//      DERIVE them. Those raw objects carry lawyerReason by schema
//      (packages/schemas/src/assessment.ts's own module comment: privileged,
//      never leaves /legal/* or the internal record, enforcing that
//      server-side is this phase's job); scanning them directly would prove
//      nothing about the real leak boundary, which is what the page
//      actually renders down to — the same distinction
//      tests/boundary/rsc-payload-leak.test.ts already draws for the "use
//      client" serialisation boundary. Asserts the serialised text contains
//      none of the recorded lawyer-reason strings, does not contain the
//      endpoint path, and DOES contain a real basis string (so the scan is
//      proven to examine populated content, not an empty object).
//
//   3. Canary — the identical matcher, run over the legal-side payload (the
//      raw Assessment.lines, which DO carry lawyerReason), DOES find the
//      recorded reasons. Without this half, halves one and two would pass
//      identically whether the matcher works or is entirely broken.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatMinor } from "@dsar/schemas/money";
import { EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";
import type { Minor } from "@dsar/schemas/primitives";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { getAssessmentForLegalReview, getSignedOffAssessmentForHr } from "../../apps/web/src/server/data/assessments.ts";
import { getExpenseLinesForHr, getMatterForLegalReview } from "../../apps/web/src/server/data/matters.ts";
import { resolvePinnedRulePack } from "../../apps/web/src/server/engine-invocation.ts";
import { buildNoticeDraft } from "../../apps/web/src/domain/notice-draft.ts";
import { INTERNAL_RECORD_DOWNLOAD_LABEL } from "../../apps/web/src/ui/review/internal-record-download.tsx";
import type { ResultViewLine } from "../../apps/web/src/ui/hr/result-view.tsx";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const HR_APP_ROOT = path.join(ROOT, "apps", "web", "app", "hr");

// The endpoint path fragment ("...internal-record...", both the route
// segment and the module/file name) and the download label's exact text —
// both markers a reference in an HR-reachable file would have to contain.
const INTERNAL_RECORD_ENDPOINT_MARKER = "internal-record";

// -----------------------------------------------------------------------
// Half one — reachability scan over source
// -----------------------------------------------------------------------

function findSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findSourceFiles(full));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      found.push(full);
    }
  }
  return found;
}

// Matches `import ... from "./relative"` / `import ... from "../relative"`
// (type-only imports included) — the same relative-specifier shape every
// import statement in this codebase already uses (always with an explicit
// .ts/.tsx extension, per this project's own established convention).
const RELATIVE_IMPORT_PATTERN = /import\s+(?:type\s+)?(?:[^"'{}]*(?:\{[^}]*\})?[^"'{}]*from\s+)?["'](\.[^"']+)["']/g;

function extractRelativeImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;
  RELATIVE_IMPORT_PATTERN.lastIndex = 0;
  while ((match = RELATIVE_IMPORT_PATTERN.exec(content)) !== null) {
    const specifier = match[1];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

function resolveImportedFile(fromFile: string, specifier: string): string | null {
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  return existsSync(resolved) ? resolved : null;
}

/** Walks every relative import, transitively, from `roots` — never
 * crossing a workspace-package ("@dsar/...") or bare-specifier
 * ("next/...", "react") import boundary, since only a relative import can
 * ever resolve to a file this scan cares about. */
function collectTransitiveFiles(roots: string[]): Map<string, string> {
  const visited = new Map<string, string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file) || !existsSync(file)) continue;
    const content = readFileSync(file, "utf-8");
    visited.set(file, content);
    for (const specifier of extractRelativeImportSpecifiers(content)) {
      const resolved = resolveImportedFile(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

describe("HR-INTERNAL-RECORD-ABSENT: reachability scan over source (ACCESS-05)", () => {
  it("ACCESS-05: discovers at least one HR page file and finds zero references to the internal-record endpoint or the download label anywhere in the HR route tree's transitive import graph", () => {
    const hrRootFiles = findSourceFiles(HR_APP_ROOT);
    const hrPageFiles = hrRootFiles.filter((file) => file.endsWith("page.tsx"));
    expect(hrPageFiles.length).toBeGreaterThan(0);

    const reached = collectTransitiveFiles(hrRootFiles);
    // Every root file is itself reached (it is its own starting point) —
    // this is what stops the walk collapsing to an empty result silently.
    expect(reached.size).toBeGreaterThanOrEqual(hrRootFiles.length);

    const offenders: string[] = [];
    for (const [file, content] of reached) {
      if (content.includes(INTERNAL_RECORD_ENDPOINT_MARKER) || content.includes(INTERNAL_RECORD_DOWNLOAD_LABEL)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders, `HR-reachable files referencing the internal record: ${offenders.join(", ")}`).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// Halves two and three — payload scan + canary
// -----------------------------------------------------------------------

const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";

function jsonRequest(url: string, method: string, body: unknown, cookie: string): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-HRABSENT-${String(matterCounter).padStart(4, "0")}`;
}

const VALID_MATTER_INPUT = {
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

const LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH", // -> ALLOW
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
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", // -> DISALLOW
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
    categoryCode: "PHOTOCOPY_PRINT", // -> ALLOW_CAPPED
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
    categoryCode: "OTHER_UNCLASSIFIED", // -> FLAG
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

interface FixtureAssessment {
  id: string;
  matterId: string;
  lines: { id: string; verdict: string; disposition: string; engineAmount: number }[];
}

async function buildFixtureAssessment(): Promise<FixtureAssessment> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT, reference: nextReference() }, HR_COOKIE)
  );
  const matter = (await matterResponse.json()) as { id: string };

  for (const input of LINE_INPUTS) {
    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input, HR_COOKIE), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(response.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}, HR_COOKIE), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  return (await submitResponse.json()) as FixtureAssessment;
}

// Distinctive enough that a substring match is meaningful — neither string
// could plausibly appear anywhere else in a generated payload by accident.
const REDUCED_REASON =
  "Cross-checked against internal timesheet reference TCKT-88214-REDUCE-MARKER and confirmed only half the claimed time was chargeable.";
const STRUCK_REASON =
  "This claim duplicates a cost already reimbursed under matter DSAR-2026-0099-STRIKE-MARKER, confirmed via internal ledger review.";
const ACCEPT_REASON = "Sighted the vendor invoice separately and it checks out.";

const DISTINCTIVE_LAWYER_REASONS = [REDUCED_REASON, STRUCK_REASON];

async function dispositionMixedLines(assessment: FixtureAssessment): Promise<void> {
  for (const line of assessment.lines) {
    const body =
      line.verdict === "FLAG"
        ? { action: "STRIKE", reason: STRUCK_REASON }
        : line.verdict === "ALLOW_CAPPED"
          ? { action: "REDUCE", amountMinor: Math.floor(line.engineAmount / 2), reason: REDUCED_REASON }
          : { action: "ACCEPT", reason: ACCEPT_REASON };

    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", body, LEGAL_COOKIE),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }
}

async function signOffFixture(assessmentId: string): Promise<void> {
  const response = await signoffRoute(
    jsonRequest(
      `${ASSESSMENTS_URL}/${assessmentId}/signoff`,
      "POST",
      { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: assessmentId }) }
  );
  expect(response.status).toBe(200);
}

/** Rebuilds exactly what apps/web/app/hr/matters/[id]/page.tsx hands to
 * ResultView/NoticeBlock for rendering — the derived ResultViewLine[] and
 * the notice draft text, the values that actually cross into what an HR
 * user's browser receives. Deliberately never serialises the raw
 * Assessment/ExpenseLine objects fetched to derive them — see this file's
 * own header note on why that would prove nothing about the real leak
 * boundary. */
async function buildHrRenderedPayload(matterId: string): Promise<{ resultLines: ResultViewLine[]; noticeDraft: string }> {
  const assessment = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, matterId);
  const expenseLines = await getExpenseLinesForHr(DEMO_USERS.HR_PREPARER, matterId);
  const expenseLineById = new Map(expenseLines.map((line) => [line.id, line]));

  const resultLines: ResultViewLine[] = assessment.lines.map((line) => {
    const expenseLine = expenseLineById.get(line.expenseLineId);
    const amount: Minor =
      line.disposition === "ACCEPTED"
        ? line.engineAmount
        : line.disposition === "REDUCED" || line.disposition === "ALLOWED_BY_LAWYER"
          ? ((line.lawyerAmount ?? 0) as Minor)
          : (0 as Minor);

    return {
      id: line.id,
      seq: expenseLine?.seq ?? 0,
      categoryLabel: expenseLine ? EXPENSE_CATEGORY_LABELS[expenseLine.categoryCode] : "Unknown category",
      description: expenseLine?.description ?? "",
      struck: line.disposition === "STRUCK",
      amount,
      basis: line.basis,
    };
  });

  const finalAmount = (assessment.totals.finalAmount ?? 0) as Minor;
  const allowedLinesForNotice = resultLines
    .filter((line) => !line.struck)
    .map((line) => ({ description: line.description, amount: line.amount }));

  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
  const noticeDraft = buildNoticeDraft({
    template: pack.requestorNoticeTemplate,
    amount: finalAmount,
    currency: "SGD",
    allowedLines: allowedLinesForNotice,
    matterReference: matterId,
  });

  return { resultLines, noticeDraft };
}

/** The legal-side counterpart — the raw Assessment (which DOES carry
 * lawyerReason per line, by schema) as returned by the same role-gated
 * read the legal review page itself calls. Used only by the canary half. */
async function buildLegalPayload(assessmentId: string, matterId: string): Promise<unknown> {
  const assessment = await getAssessmentForLegalReview(DEMO_USERS.LEGAL_REVIEWER, assessmentId);
  const matter = await getMatterForLegalReview(DEMO_USERS.LEGAL_REVIEWER, matterId);
  return { assessment, matter };
}

describe("HR-INTERNAL-RECORD-ABSENT: payload scan (ACCESS-05)", () => {
  it("ACCESS-05: the serialised HR-rendered payload contains none of the recorded lawyer-reason strings and no endpoint-path reference, over real populated content", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionMixedLines(assessment);
    await signOffFixture(assessment.id);

    const payload = await buildHrRenderedPayload(assessment.matterId);
    const serialised = JSON.stringify(payload);

    for (const reason of DISTINCTIVE_LAWYER_REASONS) {
      expect(serialised).not.toContain(reason);
    }
    expect(serialised).not.toContain(INTERNAL_RECORD_ENDPOINT_MARKER);
    expect(serialised).not.toContain(INTERNAL_RECORD_DOWNLOAD_LABEL);

    // Proves the scan examined real, populated content, not an empty
    // object — a real, non-empty basis string recorded on one of the
    // result lines is present verbatim in the serialised payload.
    const basisSample = payload.resultLines.find((line) => line.basis.length > 0)?.basis;
    expect(basisSample).toBeTruthy();
    expect(serialised).toContain(basisSample);
  });
});

describe("HR-INTERNAL-RECORD-ABSENT: canary (non-vacuity proof)", () => {
  it("ACCESS-05: the same matcher DOES find the recorded lawyer-reason strings in the legal-side payload", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionMixedLines(assessment);
    await signOffFixture(assessment.id);

    const legalPayload = await buildLegalPayload(assessment.id, assessment.matterId);
    const serialised = JSON.stringify(legalPayload);

    for (const reason of DISTINCTIVE_LAWYER_REASONS) {
      expect(serialised).toContain(reason);
    }
  });
});
