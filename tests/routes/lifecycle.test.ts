// tests/routes/lifecycle.test.ts
//
// Route-level tests for the closing transition and the intake-side audit
// records, tagged LIFECYCLE. Drives the real route handlers with real
// Request objects over a real four-line matter through the real engine and
// the real committed SG-PDPA pack, following tests/routes/recompute.test.ts's
// established technique. The whole-lifecycle test is this phase's own
// proof: it drives a matter from creation through closure, around the
// information-request branch, and asserts the ordered sequence of
// recorded event types in one comparison — the phase's first and fourth
// success criteria made observable rather than inferred.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute, PUT as replaceLineRoute, DELETE as deleteLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { POST as noticeSentRoute } from "../../apps/web/app/api/matters/[id]/notice-sent/route.ts";
import { POST as infoRequestRoute } from "../../apps/web/app/api/matters/[id]/info-request/route.ts";
import { POST as resubmitRoute } from "../../apps/web/app/api/matters/[id]/resubmit/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import { getSignedOffAssessmentForHr } from "../../apps/web/src/server/data/assessments.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { AuditEventTypeSchema } from "@dsar/schemas/primitives";

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

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
  return `DSAR-LIFECYCLE-${String(matterCounter).padStart(4, "0")}`;
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
  lines: { id: string; verdict: string; engineAmount: number; disposition: string }[];
}

async function createDraftMatter(): Promise<string> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, reference: nextReference() })
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };
  return matter.id;
}

async function addAllLines(matterId: string): Promise<void> {
  for (const input of LINE_INPUTS) {
    const response = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matterId}/lines`, "POST", input), {
      params: Promise.resolve({ id: matterId }),
    });
    expect(response.status).toBe(201);
  }
}

async function submitMatter(matterId: string): Promise<FixtureAssessment> {
  const response = await submitRoute(jsonRequest(`${MATTERS_URL}/${matterId}/submit`, "POST", {}), {
    params: Promise.resolve({ id: matterId }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as FixtureAssessment;
}

function findLine(assessment: FixtureAssessment, verdict: string) {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) throw new Error(`fixture has no ${verdict} line`);
  return line;
}

const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

async function dispositionAllLines(assessment: FixtureAssessment): Promise<void> {
  for (const verdict of ["ALLOW", "DISALLOW", "ALLOW_CAPPED"]) {
    const line = findLine(assessment, verdict);
    const response = await dispositionRoute(
      jsonRequest(
        `http://localhost/api/assessment-lines/${line.id}/disposition`,
        "POST",
        { action: "ACCEPT", reason: GOOD_REASON },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }
  const flag = findLine(assessment, "FLAG");
  const flagResponse = await dispositionRoute(
    jsonRequest(
      `http://localhost/api/assessment-lines/${flag.id}/disposition`,
      "POST",
      { action: "STRIKE", reason: GOOD_REASON },
      LEGAL_COOKIE
    ),
    { params: Promise.resolve({ id: flag.id }) }
  );
  expect(flagResponse.status).toBe(200);
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

describe("LIFECYCLE", () => {
  it("LIFECYCLE: a matter can be driven the whole way from draft to closed, around the information-request branch, entirely through the executor — status after every step, and the ordered event-type sequence as one comparison", async () => {
    const matterId = await createDraftMatter();
    let matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("DRAFT");

    await addAllLines(matterId);
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("DRAFT");

    const firstAssessment = await submitMatter(matterId);
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");

    // The information-request branch, and back.
    const flagLine = findLine(firstAssessment, "FLAG");
    const infoRequestResponse = await infoRequestRoute(
      jsonRequest(
        `${MATTERS_URL}/${matterId}/info-request`,
        "POST",
        { assessmentLineId: flagLine.id, query: "Can you confirm the vendor invoiced this line?" },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(infoRequestResponse.status).toBe(201);
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("INFO_REQUEST");

    const resubmitResponse = await resubmitRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/resubmit`, "POST", {}),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(resubmitResponse.status).toBe(200);
    const secondAssessment = (await resubmitResponse.json()) as FixtureAssessment;
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");

    await dispositionAllLines(secondAssessment);
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");

    const signoffResponse = await signOffFixture(secondAssessment.id);
    expect(signoffResponse.status).toBe(200);
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("SIGNED_OFF");

    const noticeResponse = await noticeSentRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/notice-sent`, "POST", {}),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(noticeResponse.status).toBe(200);
    matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("CLOSED");

    // Phase success criteria 1 and 4, made observable in one comparison:
    // the ordered sequence of recorded event types matches exactly what
    // this walk should have produced — no extra, missing or reordered
    // record passes unnoticed.
    const events = await memoryAuditEventWriter.listByMatter(matterId);
    expect(events.map((event) => event.type)).toEqual([
      "MATTER_CREATED",
      "LINE_ADDED",
      "LINE_ADDED",
      "LINE_ADDED",
      "LINE_ADDED",
      "SUBMITTED",
      "COMPUTED",
      "INFO_REQUESTED",
      "SUBMITTED",
      "COMPUTED",
      "LINE_DISPOSITIONED",
      "LINE_DISPOSITIONED",
      "LINE_DISPOSITIONED",
      "LINE_DISPOSITIONED",
      "SIGNED_OFF",
      "NOTICE_MARKED_SENT",
    ]);
  });

  it("LIFECYCLE: marking the notice sent on a signed-off matter records the date, moves the matter to closed through the executor, and writes a NOTICE_MARKED_SENT record", async () => {
    const matterId = await createDraftMatter();
    await addAllLines(matterId);
    const assessment = await submitMatter(matterId);
    await dispositionAllLines(assessment);
    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const before = await memoryAuditEventWriter.listByMatter(matterId);
    const noticeBefore = before.filter((event) => event.type === "NOTICE_MARKED_SENT").length;

    const noticeResponse = await noticeSentRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/notice-sent`, "POST", {}),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(noticeResponse.status).toBe(200);
    const noticeBody = (await noticeResponse.json()) as { noticeSentAt: string };
    expect(noticeBody.noticeSentAt).toBeTruthy();

    const matter = await memoryMatterRepository.getMatter(matterId);
    expect(matter?.status).toBe("CLOSED");

    const after = await memoryAuditEventWriter.listByMatter(matterId);
    const noticeAfter = after.filter((event) => event.type === "NOTICE_MARKED_SENT").length;
    expect(noticeAfter).toBe(noticeBefore + 1);
  });

  it("LIFECYCLE: the preparer can still read the figure after the matter is closed, and the figure itself is asserted, not merely that the read did not throw", async () => {
    const matterId = await createDraftMatter();
    await addAllLines(matterId);
    const assessment = await submitMatter(matterId);
    await dispositionAllLines(assessment);
    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const noticeResponse = await noticeSentRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/notice-sent`, "POST", {}),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(noticeResponse.status).toBe(200);

    const { DEMO_USERS } = await import("../../apps/web/src/server/data/auth.ts");
    const hrAssessment = await getSignedOffAssessmentForHr(DEMO_USERS.HR_PREPARER, matterId);
    // 16000 (ALLOW, accepted) + 0 (DISALLOW, accepted) + 2640 (ALLOW_CAPPED,
    // accepted) + 0 (FLAG, struck) = 18640 — the same hand-computed figure
    // tests/routes/hr-result.test.ts's identical fixture and dispositions
    // already assert.
    expect(hrAssessment.totals.finalAmount).toBe(18640);
  });

  it("LIFECYCLE: marking the notice sent on a matter that is not signed off is refused, and writes no record", async () => {
    const matterId = await createDraftMatter();
    await addAllLines(matterId);
    await submitMatter(matterId); // LEGAL_REVIEW, not signed off

    const before = await memoryAuditEventWriter.listByMatter(matterId);
    const noticeBefore = before.filter((event) => event.type === "NOTICE_MARKED_SENT").length;

    const response = await noticeSentRoute(jsonRequest(`${MATTERS_URL}/${matterId}/notice-sent`, "POST", {}), {
      params: Promise.resolve({ id: matterId }),
    });
    expect(response.status).toBe(409);

    const after = await memoryAuditEventWriter.listByMatter(matterId);
    expect(after.filter((event) => event.type === "NOTICE_MARKED_SENT").length).toBe(noticeBefore);
  });

  it("LIFECYCLE: marking the notice sent twice is refused the second time, because the matter is no longer signed off", async () => {
    const matterId = await createDraftMatter();
    await addAllLines(matterId);
    const assessment = await submitMatter(matterId);
    await dispositionAllLines(assessment);
    const signoffResponse = await signOffFixture(assessment.id);
    expect(signoffResponse.status).toBe(200);

    const first = await noticeSentRoute(jsonRequest(`${MATTERS_URL}/${matterId}/notice-sent`, "POST", {}), {
      params: Promise.resolve({ id: matterId }),
    });
    expect(first.status).toBe(200);

    const second = await noticeSentRoute(jsonRequest(`${MATTERS_URL}/${matterId}/notice-sent`, "POST", {}), {
      params: Promise.resolve({ id: matterId }),
    });
    expect(second.status).toBe(409);
  });

  it("LIFECYCLE: creating a matter writes one record naming the matter and its birth status", async () => {
    const matterId = await createDraftMatter();

    const events = await memoryAuditEventWriter.listByMatter(matterId);
    const created = events.filter((event) => event.type === "MATTER_CREATED");
    expect(created.length).toBe(1);
    expect(created[0]?.payload.entityId).toBe(matterId);
    expect(created[0]?.payload.after).toBe("DRAFT");
  });

  it("LIFECYCLE: adding, replacing and deleting a cost line each write one record naming that line", async () => {
    const matterId = await createDraftMatter();

    const addResponse = await addLineRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/lines`, "POST", LINE_INPUTS[0]),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(addResponse.status).toBe(201);
    const addedLine = (await addResponse.json()) as { id: string };

    let events = await memoryAuditEventWriter.listByMatter(matterId);
    expect(events.filter((event) => event.type === "LINE_ADDED").length).toBe(1);
    expect(events.find((event) => event.type === "LINE_ADDED")?.payload.entityId).toBe(addedLine.id);

    const replaceResponse = await replaceLineRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/lines`, "PUT", { ...LINE_INPUTS[0], quantity: 8, lineId: addedLine.id }),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(replaceResponse.status).toBe(200);

    events = await memoryAuditEventWriter.listByMatter(matterId);
    expect(events.filter((event) => event.type === "LINE_EDITED").length).toBe(1);
    expect(events.find((event) => event.type === "LINE_EDITED")?.payload.entityId).toBe(addedLine.id);

    const deleteResponse = await deleteLineRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/lines`, "DELETE", { lineId: addedLine.id }),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(deleteResponse.status).toBe(204);

    events = await memoryAuditEventWriter.listByMatter(matterId);
    expect(events.filter((event) => event.type === "LINE_DELETED").length).toBe(1);
    expect(events.find((event) => event.type === "LINE_DELETED")?.payload.entityId).toBe(addedLine.id);
  });

  it("LIFECYCLE: a refused line edit — attempted after the matter has left draft — writes no record, and the log and the stored line are both unchanged", async () => {
    const matterId = await createDraftMatter();
    const addResponse = await addLineRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/lines`, "POST", LINE_INPUTS[0]),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(addResponse.status).toBe(201);
    const addedLine = (await addResponse.json()) as { id: string; quantity: number };

    await addAllLines(matterId); // needs the other three categories to submit cleanly
    await submitMatter(matterId); // matter leaves DRAFT

    const before = await memoryAuditEventWriter.listByMatter(matterId);
    const editedBefore = before.filter((event) => event.type === "LINE_EDITED").length;

    const replaceResponse = await replaceLineRoute(
      jsonRequest(`${MATTERS_URL}/${matterId}/lines`, "PUT", { ...LINE_INPUTS[0], quantity: 99, lineId: addedLine.id }),
      { params: Promise.resolve({ id: matterId }) }
    );
    expect(replaceResponse.status).toBe(409);

    const after = await memoryAuditEventWriter.listByMatter(matterId);
    expect(after.filter((event) => event.type === "LINE_EDITED").length).toBe(editedBefore);

    const lines = await memoryMatterRepository.listExpenseLines(matterId);
    const stillStored = lines.find((line) => line.id === addedLine.id);
    expect(stillStored?.quantity).toBe(addedLine.quantity);
  });

  it("LIFECYCLE: every audit event type is accounted for as either written this phase or deliberately deferred, with no type left out of either list", () => {
    // Written: this phase's code has a working writer call site for every
    // one of these, either the matter-scoped stream (data/matters.ts,
    // data/assessments.ts) or the pack-lifecycle stream (04-03's
    // memoryPackLifecycleEventWriter, proven by its own direct unit tests
    // even though no admin screen exists yet to call it from — the same
    // structural-only treatment REQUIREMENTS.md already gives AUDIT-04).
    const WRITTEN_THIS_PHASE = [
      "MATTER_CREATED",
      "LINE_ADDED",
      "LINE_EDITED",
      "LINE_DELETED",
      "SUBMITTED",
      "COMPUTED",
      "COMPUTE_FAILED",
      "LINE_DISPOSITIONED",
      "INFO_REQUESTED",
      "SIGNED_OFF",
      "NOTICE_MARKED_SENT",
      "SUPERSEDED",
      "PACK_ACTIVATED",
      "PACK_EDITED",
      // 06-07 (REVIEW-11) — setFeeChoice (data/assessments.ts) writes this
      // on every lawyer flat-fee-vs-itemised choice.
      "FEE_CHOICE_SET",
    ].sort();

    // Deferred: deliberately not written by any call site this phase adds,
    // each for a stated reason rather than an unexplained absence.
    const DEFERRED_THIS_PHASE = [
      // No undo affordance exists anywhere in this codebase yet, and
      // ROADMAP.md names no phase that plans one — a genuine gap in the
      // roadmap itself, flagged here rather than assigned to a guessed
      // phase.
      "DISPOSITION_UNDONE",
      // Recorded inside SignOff.acknowledgedFlags (packages/schemas/src/assessment.ts)
      // and signOffPayload's own audit record, not as a separate event —
      // a deliberate design choice made in this phase, not a deferral to
      // a future one.
      "FLAG_ACKNOWLEDGED",
      // AC-30's capability-statement screen belongs to Phase 5 (HR Intake
      // and Disclosure Shell) — no such screen exists yet for an
      // acknowledgement to be recorded from.
      "CAPABILITY_STATEMENT_ACKNOWLEDGED",
    ].sort();

    const allTypes = [...AuditEventTypeSchema.options].sort();
    expect(WRITTEN_THIS_PHASE.length + DEFERRED_THIS_PHASE.length).toBe(allTypes.length);
    expect([...WRITTEN_THIS_PHASE, ...DEFERRED_THIS_PHASE].sort()).toEqual(allTypes);
    // No type appears in both lists.
    const overlap = WRITTEN_THIS_PHASE.filter((type) => DEFERRED_THIS_PHASE.includes(type));
    expect(overlap).toEqual([]);
  });
});
