// tests/routes/pack-lifecycle-signoff.test.ts
//
// Route-level tests for PACK-08/AC-41b, tagged PACK-ACTIVATION-SIGNOFF.
// Reuses tests/routes/signoff.test.ts's own fixture-building technique
// (create matter, add lines, submit, disposition every line) rather than
// inventing a second builder. Implements D-02 (07-CONTEXT.md): only one
// real LEGAL_REVIEWER demo persona exists, so the positive/negative split
// is driven by varying the synthetic PACK_ACTIVATED event's own actor
// (written directly through the memory-backed pack-lifecycle writer),
// while every sign-off attempt uses the same real LEGAL_REVIEWER cookie.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { newUlid } from "../../apps/web/src/server/ids.ts";
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";
import { packActivatedPayload, packEditedPayload } from "@dsar/audit/payload-builders";
import type { UserRef } from "@dsar/schemas/primitives";

const MATTERS_URL = "http://localhost/api/matters";
const SIGNOFF_URL = "http://localhost/api/assessments";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

function jsonRequest(url: string, method: string, body: unknown, cookie: string = LEGAL_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

let matterCounter = 0;

function nextReference(): string {
  matterCounter += 1;
  return `DSAR-PACKACT-${String(matterCounter).padStart(4, "0")}`;
}

// The same four-line composition tests/routes/signoff.test.ts's own
// LINE_INPUTS uses, not a smaller invented set — a single- or two-line
// matter concentrates one line's claimed share above the engine's own
// MATERIALITY cross-line threshold (>= 40% of the total), forcing a FLAG
// verdict regardless of the category's own ALLOW treatment. This exact
// four-line mix is already proven to keep three lines genuinely
// ALLOW/DISALLOW/ALLOW_CAPPED, with only the fourth (OTHER_UNCLASSIFIED)
// FLAGged for its own, unrelated categorisation reason.
const LINE_INPUTS = [
  {
    categoryCode: "STAFF_TIME_SEARCH", // -> ALLOW, 16000
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
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", // -> DISALLOW, engine 0
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
    categoryCode: "PHOTOCOPY_PRINT", // -> ALLOW_CAPPED, claimed 3300, cap 2640
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
    categoryCode: "OTHER_UNCLASSIFIED", // -> FLAG, 4500
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
  rulePackId: string;
  rulePackVersion: string;
  lines: { id: string; verdict: string; disposition: string }[];
  matterLevelFlags: { id: string; requiresAcknowledgement: boolean }[];
}

// Builds and fully dispositions a real, ready-to-sign-off assessment — no
// LITIGATION_POSTURE flag on this fixture, so acknowledgedFlags stays
// empty and PACK-08's own check is the only thing left to prove.
async function buildReadyAssessment(): Promise<FixtureAssessment> {
  const matterInput = {
    reference: nextReference(),
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

  const matterResponse = await createMatterRoute(jsonRequest(MATTERS_URL, "POST", matterInput, HR_COOKIE));
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
  const assessment = (await submitResponse.json()) as FixtureAssessment;

  for (const line of assessment.lines) {
    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", {
        action: line.verdict === "FLAG" ? "STRIKE" : "ACCEPT",
        reason: "Sighted the vendor invoice separately and it checks out.",
      }),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }

  return assessment;
}

const SIGNOFF_INPUT = {
  qualification: "Advocate & Solicitor, Singapore",
  acknowledgedFlags: [],
  attestation: true,
};

function distinctActor(): UserRef {
  return {
    id: newUlid(),
    displayName: "A Different Reviewer",
    email: "different.reviewer@example.invalid",
  };
}

async function attemptSignOff(assessmentId: string): Promise<Response> {
  return signoffRoute(jsonRequest(`${SIGNOFF_URL}/${assessmentId}/signoff`, "POST", SIGNOFF_INPUT), {
    params: Promise.resolve({ id: assessmentId }),
  });
}

describe("PACK-ACTIVATION-SIGNOFF", () => {
  it("PACK-ACTIVATION-SIGNOFF: the actor who last activated the pinned pack version is refused at 403, naming the pack id and version and pointing to another reviewer", async () => {
    const assessment = await buildReadyAssessment();

    await memoryPackLifecycleEventWriter.append({
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      actor: DEMO_USERS.LEGAL_REVIEWER.user, // same actor who will attempt sign-off
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("DRAFT", "ACTIVE"),
    });

    const response = await attemptSignOff(assessment.id);
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain(assessment.rulePackId);
    expect(body.error).toContain(assessment.rulePackVersion);
    expect(body.error).toContain("another reviewer");

    const stored = await memoryAssessmentRepository.getAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");
  });

  it("PACK-ACTIVATION-SIGNOFF: a different activator's id does not block sign-off, using the same signing cookie", async () => {
    const assessment = await buildReadyAssessment();

    await memoryPackLifecycleEventWriter.append({
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      actor: distinctActor(),
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("DRAFT", "ACTIVE"),
    });

    const response = await attemptSignOff(assessment.id);
    expect(response.status).toBe(200);
  });

  it("PACK-ACTIVATION-SIGNOFF: no PACK_ACTIVATED event at all for the pinned pack id and version does not block sign-off", async () => {
    const assessment = await buildReadyAssessment();

    const response = await attemptSignOff(assessment.id);
    expect(response.status).toBe(200);
  });

  it("PACK-ACTIVATION-SIGNOFF: a later activation by a different actor supersedes an earlier one by the signing actor — sign-off proceeds", async () => {
    const assessment = await buildReadyAssessment();

    await memoryPackLifecycleEventWriter.append({
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      actor: DEMO_USERS.LEGAL_REVIEWER.user,
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("DRAFT", "ACTIVE"),
    });
    await memoryPackLifecycleEventWriter.append({
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      actor: distinctActor(),
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("ACTIVE", "ACTIVE"),
    });

    const response = await attemptSignOff(assessment.id);
    expect(response.status).toBe(200);
  });

  it("PACK-ACTIVATION-SIGNOFF: a PACK_EDITED event by the signing actor does not block sign-off — only PACK_ACTIVATED blocks", async () => {
    const assessment = await buildReadyAssessment();

    await memoryPackLifecycleEventWriter.append({
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      actor: DEMO_USERS.LEGAL_REVIEWER.user,
      actorRole: "RULEPACK_AUTHOR",
      at: new Date().toISOString(),
      type: "PACK_EDITED",
      payload: packEditedPayload("requestorNoticeTemplate"),
    });

    const response = await attemptSignOff(assessment.id);
    expect(response.status).toBe(200);
  });
});
