// tests/routes/audit-trail.test.ts
//
// Route-level tests proving every remaining Phase 3.1 status-literal call
// site now leaves a provenance-complete audit record behind, tagged
// AUDIT-TRAIL. Drives the real route handlers with real Request objects
// over the real committed SG-PDPA pack, the same technique
// tests/routes/workflow-tracer.test.ts established. Every count assertion
// here counts records of a NAMED event type, never a matter's total record
// count, per 04-04-PLAN.md's own instruction — a later plan in this phase
// adding a further event type must not break an assertion that was never
// about it.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as infoRequestRoute } from "../../apps/web/app/api/matters/[id]/info-request/route.ts";
import { POST as resubmitRoute } from "../../apps/web/app/api/matters/[id]/resubmit/route.ts";
import { POST as recomputeRoute } from "../../apps/web/app/api/assessments/[id]/recompute/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { getAssessmentForLegalReview, bulkAcceptLines } from "../../apps/web/src/server/data/assessments.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import { elapsedReviewMs } from "@dsar/audit/review-session";
import { ENGINE_VERSION } from "@dsar/engine";

const MATTERS_URL = "http://localhost/api/matters";
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
  return `DSAR-AUDITTRAIL-${String(matterCounter).padStart(4, "0")}`;
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

const ONE_LINE_INPUT = {
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
};

interface FixtureAssessment {
  id: string;
  matterId: string;
  lines: { id: string; verdict: string; expenseLineId: string }[];
}

async function createMatterWithOneLine(overrides: Partial<typeof VALID_MATTER_INPUT_BASE> = {}): Promise<{ id: string }> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, ...overrides, reference: nextReference() })
  );
  const matter = (await matterResponse.json()) as { id: string };

  const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", ONE_LINE_INPUT), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(lineResponse.status).toBe(201);

  return matter;
}

function eventsOfType(events: Awaited<ReturnType<typeof memoryAuditEventWriter.listByMatter>>, type: string) {
  return events.filter((event) => event.type === type);
}

describe("AUDIT-TRAIL", () => {
  it("AUDIT-TRAIL: a successful submission leaves exactly one SUBMITTED and one COMPUTED record, each carrying full provenance", async () => {
    const matter = await createMatterWithOneLine();

    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const submitted = eventsOfType(events, "SUBMITTED");
    const computed = eventsOfType(events, "COMPUTED");
    expect(submitted).toHaveLength(1);
    expect(computed).toHaveLength(1);

    for (const event of [submitted[0]!, computed[0]!]) {
      expect(event.matterId).toBe(matter.id);
      expect(event.actor.id).toEqual(expect.any(String));
      expect(event.actorRole).toBe("HR_PREPARER");
      expect(event.at).toEqual(expect.any(String));
      expect(event.rulePackVersion).toBe("2026.09.1");
      expect(event.engineVersion).toBe(ENGINE_VERSION);
    }
    expect(submitted[0]!.payload.before).toBe("DRAFT");
    expect(submitted[0]!.payload.after).toBe("COMPUTING");
    expect(computed[0]!.payload.before).toBe("COMPUTING");
    expect(computed[0]!.payload.after).toBe("LEGAL_REVIEW");
  });

  it("AUDIT-TRAIL: when the engine throws, the matter lands back in draft, a COMPUTE_FAILED record carries the reason, and no assessment is stored", async () => {
    // PUBLIC_AGENCY is not in the committed SG-PDPA pack's appliesTo list —
    // the SUBMIT guard does not check controllerType (only the engine's own
    // precondition does), so this passes the guard and fails inside
    // assessMatter() itself, exercising the real rollback path.
    //
    // The matter is created and its one line added as PRIVATE_ORGANISATION,
    // then mutated to PUBLIC_AGENCY directly on the repository (the same
    // post-creation-mutation technique this file's own info-request/
    // recompute rollback tests below already use) — not via
    // createMatterWithOneLine's controllerType override — because
    // 05-REVIEW-ADDENDUM.md's security-finding fix now rejects adding a
    // cost line to a PUBLIC_AGENCY matter in SG at the API layer
    // (NO_EXPRESS_AUTHORITY is a blocking posture). Reaching the engine's
    // own appliesTo precondition failure this test exercises therefore
    // requires the controller type to change AFTER the line already
    // exists, exactly as the parallel resubmit/recompute rollback tests do.
    const matter = await createMatterWithOneLine();
    const draftMatter = await memoryMatterRepository.getMatter(matter.id);
    if (!draftMatter) throw new Error("expected matter to exist");
    await memoryMatterRepository.updateMatter({ ...draftMatter, controllerType: "PUBLIC_AGENCY" });

    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(500);

    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("DRAFT");

    const storedAssessment = await memoryAssessmentRepository.getAssessmentByMatterId(matter.id);
    expect(storedAssessment).toBeNull();

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const failed = eventsOfType(events, "COMPUTE_FAILED");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.payload.before).toBe("COMPUTING");
    expect(typeof failed[0]!.payload.after).toBe("string");
    expect((failed[0]!.payload.after as string).length).toBeGreaterThan(0);
  });

  it("AUDIT-TRAIL: a resubmission after an information request leaves a SUBMITTED record and a COMPUTED record, and the stored assessment keeps its identity", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    await infoRequestRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/info-request`,
        "POST",
        { assessmentLineId: assessment.lines[0]!.id, query: "Can you confirm the vendor invoiced this line?" },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );

    const resubmitResponse = await resubmitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/resubmit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(resubmitResponse.status).toBe(200);
    const recomputed = (await resubmitResponse.json()) as FixtureAssessment;
    expect(recomputed.id).toBe(assessment.id);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    // Two SUBMITTED (the original submission, then the resubmission) and
    // two COMPUTED (the original computation, then the recompute) — counted
    // by type, so this does not assume anything about the INFO_REQUESTED
    // event another plan's task adds to the same log.
    expect(eventsOfType(events, "SUBMITTED")).toHaveLength(2);
    expect(eventsOfType(events, "COMPUTED")).toHaveLength(2);
  });

  it("AUDIT-TRAIL: reading an assessment for review records the moment it was first opened, and reading it again does not move that moment", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    await getAssessmentForLegalReview(DEMO_USERS.LEGAL_REVIEWER, assessment.id);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // A second read must NOT move the recorded origin — if it did, the
    // elapsed figure measured now would be close to zero instead of at
    // least the ~20ms that has genuinely passed since the first read.
    await getAssessmentForLegalReview(DEMO_USERS.LEGAL_REVIEWER, assessment.id);
    const elapsed = elapsedReviewMs(assessment.id, new Date().toISOString());
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });

  it("AUDIT-TRAIL: dispositioning a line writes exactly one LINE_DISPOSITIONED record carrying the line id, the prior and new disposition, and a non-negative integer elapsed figure", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;
    const line = assessment.lines[0]!;

    // The single-line fixture's one line always FLAGs on cross-line
    // materiality (it is 100% of the claim) — STRIKE, not ACCEPT, is the
    // permitted action for a FLAG-verdict line (VERDICT_ACTIONS).
    const dispositionResponse = await dispositionRoute(
      jsonRequest(
        `http://localhost/api/assessment-lines/${line.id}/disposition`,
        "POST",
        { action: "STRIKE", reason: "Sighted the underlying records and it checks out." },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(dispositionResponse.status).toBe(200);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const dispositioned = eventsOfType(events, "LINE_DISPOSITIONED");
    expect(dispositioned).toHaveLength(1);
    expect(dispositioned[0]!.payload.entityId).toBe(line.id);
    expect(dispositioned[0]!.payload.before).toBe("PENDING");
    expect(dispositioned[0]!.payload.after).toBe("STRUCK");
    expect(Number.isInteger(dispositioned[0]!.payload.elapsedReviewMs)).toBe(true);
    expect(dispositioned[0]!.payload.elapsedReviewMs).toBeGreaterThanOrEqual(0);
  });

  it("AUDIT-TRAIL: an elapsed figure taken after a decision is a non-negative integer and is at least as large as the time actually elapsed in the test", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;
    const line = assessment.lines[0]!;

    await getAssessmentForLegalReview(DEMO_USERS.LEGAL_REVIEWER, assessment.id);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const dispositionResponse = await dispositionRoute(
      jsonRequest(
        `http://localhost/api/assessment-lines/${line.id}/disposition`,
        "POST",
        { action: "STRIKE", reason: "Sighted the underlying records and it checks out." },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(dispositionResponse.status).toBe(200);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const dispositioned = eventsOfType(events, "LINE_DISPOSITIONED");
    const figure = dispositioned[0]!.payload.elapsedReviewMs;
    expect(Number.isInteger(figure)).toBe(true);
    expect(figure).toBeGreaterThanOrEqual(0);
    expect(figure!).toBeGreaterThanOrEqual(25);
  });

  it("AUDIT-TRAIL: a refused disposition writes no record at all", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;
    const line = assessment.lines[0]!;

    const dispositionResponse = await dispositionRoute(
      jsonRequest(
        `http://localhost/api/assessment-lines/${line.id}/disposition`,
        "POST",
        { action: "STRIKE", reason: "too short" },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(dispositionResponse.status).toBe(400);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    expect(eventsOfType(events, "LINE_DISPOSITIONED")).toHaveLength(0);
  });

  it("AUDIT-TRAIL: accepting several lines at once writes one LINE_DISPOSITIONED record per line, each naming its own line id, sharing one elapsed figure", async () => {
    // The real committed SG-PDPA pack has no VERIFIED rule at all, so the
    // real pipeline can never produce a bulk-accept-eligible line
    // (tests/routes/disposition.test.ts's own BULK-ACCEPT suite already
    // documents this). bulkAcceptLines's optional `pack` override (added
    // this plan, mirroring listBulkAcceptableLineIds's existing one) is
    // what makes this provable — every production call site still omits it.
    const matterResponse = await createMatterRoute(
      jsonRequest(MATTERS_URL, "POST", { ...VALID_MATTER_INPUT_BASE, reference: nextReference() })
    );
    const matter = (await matterResponse.json()) as { id: string };
    for (const input of [ONE_LINE_INPUT, { ...ONE_LINE_INPUT, categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE" }]) {
      const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", input), {
        params: Promise.resolve({ id: matter.id }),
      });
      expect(lineResponse.status).toBe(201);
    }
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(submitResponse.status).toBe(200);
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    const stored = await memoryAssessmentRepository.getAssessment(assessment.id);
    if (!stored) throw new Error("expected the fixture assessment to be stored");
    const patchedLines = stored.lines.map((line) => ({
      ...line,
      verdict: "ALLOW" as const,
      disposition: "PENDING" as const,
      appliedRuleId: "TEST.VERIFIED_RULE",
    }));
    await memoryAssessmentRepository.updateAssessment({ ...stored, lines: patchedLines });
    const eligibleLineIds = patchedLines.map((line) => line.id);

    const fixturePack = {
      categoryRules: [{ ruleId: "TEST.VERIFIED_RULE", verificationStatus: "VERIFIED" }],
    } as unknown as Parameters<typeof bulkAcceptLines>[3];

    const updated = await bulkAcceptLines(
      DEMO_USERS.LEGAL_REVIEWER,
      assessment.id,
      { lineIds: eligibleLineIds, reason: "Sighted the vendor invoice separately and it checks out." },
      fixturePack
    );
    expect(updated).toHaveLength(2);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const dispositioned = eventsOfType(events, "LINE_DISPOSITIONED");
    expect(dispositioned).toHaveLength(2);
    expect(dispositioned.map((event) => event.payload.entityId).sort()).toEqual([...eligibleLineIds].sort());
    for (const event of dispositioned) {
      expect(event.payload.before).toBe("PENDING");
      expect(event.payload.after).toBe("ACCEPTED");
    }
    // A single elapsed reading is taken once for the whole batch.
    expect(dispositioned[0]!.payload.elapsedReviewMs).toBe(dispositioned[1]!.payload.elapsedReviewMs);
  });

  it("AUDIT-TRAIL: signing off transitions through the executor and writes one SIGNED_OFF record carrying the before/after status and an elapsed figure", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;
    const line = assessment.lines[0]!;

    // The single-line fixture always FLAGs (100% materiality) — STRIKE it
    // so every line is dispositioned before sign-off is attempted.
    const dispositionResponse = await dispositionRoute(
      jsonRequest(
        `http://localhost/api/assessment-lines/${line.id}/disposition`,
        "POST",
        { action: "STRIKE", reason: "Sighted the underlying records and it checks out." },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(dispositionResponse.status).toBe(200);

    const signoffResponse = await signoffRoute(
      jsonRequest(
        `http://localhost/api/assessments/${assessment.id}/signoff`,
        "POST",
        { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(signoffResponse.status).toBe(200);

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const signedOff = eventsOfType(events, "SIGNED_OFF");
    expect(signedOff).toHaveLength(1);
    expect(signedOff[0]!.payload.before).toBe("LEGAL_REVIEW");
    expect(signedOff[0]!.payload.after).toBe("SIGNED_OFF");
    expect(Number.isInteger(signedOff[0]!.payload.elapsedReviewMs)).toBe(true);
    expect(signedOff[0]!.payload.elapsedReviewMs).toBeGreaterThanOrEqual(0);
  });

  it("AUDIT-TRAIL: sign-off with any line still pending is still refused, still leaves the matter in legal review, and still writes no record", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    const signoffResponse = await signoffRoute(
      jsonRequest(
        `http://localhost/api/assessments/${assessment.id}/signoff`,
        "POST",
        { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(signoffResponse.status).toBe(400);

    const matterAfter = await memoryMatterRepository.getMatter(matter.id);
    expect(matterAfter?.status).toBe("LEGAL_REVIEW");

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    expect(eventsOfType(events, "SIGNED_OFF")).toHaveLength(0);
  });

  it("AUDIT-TRAIL: asking for information transitions through the executor and writes one INFO_REQUESTED record", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;
    const line = assessment.lines[0]!;

    const response = await infoRequestRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/info-request`,
        "POST",
        { assessmentLineId: line.id, query: "Can you confirm the vendor invoiced this line?" },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );
    expect(response.status).toBe(201);

    const matterAfter = await memoryMatterRepository.getMatter(matter.id);
    expect(matterAfter?.status).toBe("INFO_REQUEST");

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const infoRequested = eventsOfType(events, "INFO_REQUESTED");
    expect(infoRequested).toHaveLength(1);
    expect(infoRequested[0]!.payload.entityId).toBe(line.id);
    expect(infoRequested[0]!.actorRole).toBe("LEGAL_REVIEWER");
  });

  // 04-REVIEW.md CR-01: resubmitAfterInfoRequest and recomputeAgainstCurrentPack
  // originally had no rollback if the engine's recompute threw — a matter
  // was left permanently stranded in COMPUTING. Both now share
  // computeInPlaceOrRollback (matters.ts), the same rollback shape this
  // file's own submitForAssessment test above already proves. controllerType
  // is immutable through every real route once a matter exists, so the only
  // way to make the SECOND engine call fail without also failing the FIRST
  // is a direct repository write between them — the same technique the
  // bulk-accept test elsewhere in this suite already uses to engineer a
  // scenario no real route can reach on its own.
  it("AUDIT-TRAIL: when a resubmission's recompute throws, the matter rolls back to draft and a COMPUTE_FAILED record carries the reason (04-REVIEW.md CR-01)", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    await infoRequestRoute(
      jsonRequest(
        `${MATTERS_URL}/${matter.id}/info-request`,
        "POST",
        { assessmentLineId: assessment.lines[0]!.id, query: "Can you confirm the vendor invoiced this line?" },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: matter.id }) }
    );

    const infoRequestedMatter = await memoryMatterRepository.getMatter(matter.id);
    if (!infoRequestedMatter) throw new Error("expected matter to exist");
    await memoryMatterRepository.updateMatter({ ...infoRequestedMatter, controllerType: "PUBLIC_AGENCY" });

    const resubmitResponse = await resubmitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/resubmit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(resubmitResponse.status).toBe(500);

    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("DRAFT");

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const failed = eventsOfType(events, "COMPUTE_FAILED");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.payload.before).toBe("COMPUTING");
    expect(typeof failed[0]!.payload.after).toBe("string");
    expect((failed[0]!.payload.after as string).length).toBeGreaterThan(0);
  });

  it("AUDIT-TRAIL: when a lawyer-initiated recompute throws, the matter rolls back to draft and a COMPUTE_FAILED record carries the reason (04-REVIEW.md CR-01)", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    const legalReviewMatter = await memoryMatterRepository.getMatter(matter.id);
    if (!legalReviewMatter) throw new Error("expected matter to exist");
    await memoryMatterRepository.updateMatter({ ...legalReviewMatter, controllerType: "PUBLIC_AGENCY" });

    const recomputeResponse = await recomputeRoute(
      jsonRequest(`http://localhost/api/assessments/${assessment.id}/recompute`, "POST", {}, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(recomputeResponse.status).toBe(500);

    const storedMatter = await memoryMatterRepository.getMatter(matter.id);
    expect(storedMatter?.status).toBe("DRAFT");

    const events = await memoryAuditEventWriter.listByMatter(matter.id);
    const failed = eventsOfType(events, "COMPUTE_FAILED");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.payload.before).toBe("COMPUTING");
  });

  // 04-REVIEW.md CR-02: recomputeAgainstCurrentPack never recorded an event
  // for its own RECOMPUTE transition (LEGAL_REVIEW -> COMPUTING) — only the
  // subsequent COMPUTED event was written, indistinguishable from any other
  // path that happens to produce one. It now records a SUBMITTED-type event
  // for that transition, mirroring resubmitAfterInfoRequest's own SUBMITTED
  // record for its RESUBMIT transition.
  it("AUDIT-TRAIL: a lawyer-initiated recompute leaves a SUBMITTED record for its own RECOMPUTE transition, in addition to the COMPUTED record (04-REVIEW.md CR-02)", async () => {
    const matter = await createMatterWithOneLine();
    const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
      params: Promise.resolve({ id: matter.id }),
    });
    const assessment = (await submitResponse.json()) as FixtureAssessment;

    const before = await memoryAuditEventWriter.listByMatter(matter.id);
    const submittedBefore = eventsOfType(before, "SUBMITTED").length;
    const computedBefore = eventsOfType(before, "COMPUTED").length;

    const recomputeResponse = await recomputeRoute(
      jsonRequest(`http://localhost/api/assessments/${assessment.id}/recompute`, "POST", {}, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(recomputeResponse.status).toBe(200);

    const after = await memoryAuditEventWriter.listByMatter(matter.id);
    const submittedAfter = eventsOfType(after, "SUBMITTED");
    const computedAfter = eventsOfType(after, "COMPUTED");
    expect(submittedAfter).toHaveLength(submittedBefore + 1);
    expect(computedAfter).toHaveLength(computedBefore + 1);

    const recomputeSubmitted = submittedAfter[submittedAfter.length - 1]!;
    expect(recomputeSubmitted.payload.before).toBe("LEGAL_REVIEW");
    expect(recomputeSubmitted.payload.after).toBe("COMPUTING");
  });
});
