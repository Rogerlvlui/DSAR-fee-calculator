// tests/routes/signoff.test.ts
//
// Route-level tests for the sign-off endpoint, tagged SIGNOFF. Drives the
// real route handlers with real Request objects over a real four-line
// matter through the real engine and the real committed SG-PDPA pack — the
// same technique tests/routes/disposition.test.ts already established.
// isKnownDisputeOrLitigation is set on the fixture matter so the assessment
// carries a real matter flag requiring acknowledgement (LITIGATION_POSTURE,
// per packages/engine's own derived-flag rule) without inventing a fixture
// pack — every relevant assertion runs against the real pack as committed.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { memoryAssessmentRepository } from "../../apps/web/src/server/repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import { resolvePinnedRulePack } from "../../apps/web/src/server/engine-invocation.ts";
import { renderAttestation, ATTESTATION_TEMPLATE_VERSION } from "../../apps/web/src/domain/attestation.ts";

const MATTERS_URL = "http://localhost/api/matters";
const SIGNOFF_URL = "http://localhost/api/assessments";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;
const DPO_COOKIE = `${DEMO_ROLE_COOKIE}=DPO_ADMIN`;

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
  return `DSAR-SIGNOFF-${String(matterCounter).padStart(4, "0")}`;
}

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
  lines: { id: string; verdict: string; engineAmount: number; disposition: string }[];
  matterLevelFlags: { id: string; requiresAcknowledgement: boolean }[];
}

async function buildFixtureAssessment(): Promise<FixtureAssessment> {
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
    isKnownDisputeOrLitigation: true, // -> LITIGATION_POSTURE, requiresAcknowledgement: true
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
  return (await submitResponse.json()) as FixtureAssessment;
}

function findLine(assessment: FixtureAssessment, verdict: string) {
  const line = assessment.lines.find((candidate) => candidate.verdict === verdict);
  if (!line) throw new Error(`fixture has no ${verdict} line`);
  return line;
}

const GOOD_REASON = "Sighted the vendor invoice separately and it checks out.";

async function dispositionAllLines(assessment: FixtureAssessment): Promise<void> {
  const allow = findLine(assessment, "ALLOW");
  const disallow = findLine(assessment, "DISALLOW");
  const capped = findLine(assessment, "ALLOW_CAPPED");
  const flag = findLine(assessment, "FLAG");

  for (const [line, body] of [
    [allow, { action: "ACCEPT", reason: GOOD_REASON }],
    [disallow, { action: "ACCEPT", reason: GOOD_REASON }],
    [capped, { action: "ACCEPT", reason: GOOD_REASON }],
    [flag, { action: "STRIKE", reason: GOOD_REASON }],
  ] as const) {
    const response = await dispositionRoute(
      jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", body),
      { params: Promise.resolve({ id: line.id }) }
    );
    expect(response.status).toBe(200);
  }
}

async function storedAssessment(id: string) {
  return memoryAssessmentRepository.getAssessment(id);
}

const VALID_SIGNOFF_INPUT = {
  qualification: "Advocate & Solicitor, Singapore",
  acknowledgedFlags: ["LITIGATION_POSTURE"],
  attestation: true,
};

describe("SIGNOFF", () => {
  it("SIGNOFF: sign-off with any line still pending is refused at 409, naming every outstanding line by seq, the matter stays in legal review, and the record and final amount are absent", async () => {
    const assessment = await buildFixtureAssessment();

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    // LINE_INPUTS is added in order, and ExpenseLine.seq is 0-indexed
    // (apps/web/src/server/data/matters.ts's addExpenseLine: `seq:
    // existingLines.length`) — the fixture's four lines carry seq 0..3.
    expect(body.error).toBe("Sign-off refused — 4 line(s) still need a decision: lines 0, 1, 2, 3.");

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
    expect(stored?.totals.finalAmount).toBeNull();
    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("LEGAL_REVIEW");
  });

  it("SIGNOFF: sign-off with exactly one line still pending names that single line and no other", async () => {
    const assessment = await buildFixtureAssessment();
    const allow = findLine(assessment, "ALLOW");
    const disallow = findLine(assessment, "DISALLOW");
    const capped = findLine(assessment, "ALLOW_CAPPED");
    // Leave the FLAG line (seq 3, the fourth line added) PENDING — dispose
    // the other three.
    for (const line of [allow, disallow, capped]) {
      const response = await dispositionRoute(
        jsonRequest(`http://localhost/api/assessment-lines/${line.id}/disposition`, "POST", {
          action: "ACCEPT",
          reason: GOOD_REASON,
        }),
        { params: Promise.resolve({ id: line.id }) }
      );
      expect(response.status).toBe(200);
    }

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Sign-off refused — 1 line(s) still need a decision: lines 3.");
  });

  it("SIGNOFF: an unacknowledged matter flag that requires acknowledgement is refused at 409, naming the flag", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        acknowledgedFlags: [],
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("LITIGATION_POSTURE");

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("SIGNOFF: zero acknowledgement-requiring flags plus an empty acknowledgedFlags array signs off at 200", async () => {
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
      isKnownDisputeOrLitigation: false, // -> no LITIGATION_POSTURE flag
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
    expect(assessment.matterLevelFlags.filter((flag) => flag.requiresAcknowledgement)).toHaveLength(0);
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        acknowledgedFlags: [],
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);
  });

  it("SIGNOFF: the same real flag id listed twice in acknowledgedFlags still signs off at 200", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        acknowledgedFlags: ["LITIGATION_POSTURE", "LITIGATION_POSTURE"],
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);
  });

  it("SIGNOFF: an acknowledgement list naming a flag the assessment does not carry is refused", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        acknowledgedFlags: ["LITIGATION_POSTURE", "NOT_A_REAL_FLAG"],
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("SIGNOFF: sign-off with the attestation not affirmed is refused", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        attestation: false,
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("SIGNOFF: sign-off with an empty qualification is refused", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "   ",
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  // WR-02 (07-REVIEW.md): qualification was the only sign-off free-text
  // field with no upper bound at all — now capped at FREE_TEXT_LIMITS.qualification (200).
  it("WR-02: sign-off with a qualification exceeding the 200-character cap is refused and stores nothing", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "A".repeat(201),
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("WR-02: sign-off with a qualification at exactly the 200-character cap is accepted", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "A".repeat(200),
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff?.qualification).toBe("A".repeat(200));
  });

  it("SIGNOFF: sign-off carrying the HR role cookie is refused with 403, changes nothing, and the body carries no assessment content (ACCESS-04)", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("assessment");
    expect(body).not.toHaveProperty("attestationText");

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("SIGNOFF: sign-off carrying the DPO_ADMIN role cookie is refused with 403 on the same endpoint (ACCESS-04)", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT, DPO_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(403);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("SIGNOFF: a successful sign-off writes the final amount as the tallies' integer sum, sets the matter signed off, and records provenance", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { assessment: FixtureAssessment & { totals: { finalAmount: number } } };

    // ALLOW (16000, accepted) + DISALLOW (0, accepted) + ALLOW_CAPPED (2640, accepted) + FLAG (struck, 0).
    expect(body.assessment.totals.finalAmount).toBe(18640);

    const matter = await memoryMatterRepository.getMatter(assessment.matterId);
    expect(matter?.status).toBe("SIGNED_OFF");

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff?.qualification).toBe("Advocate & Solicitor, Singapore");
    expect(stored?.signOff?.acknowledgedFlags).toEqual(["LITIGATION_POSTURE"]);
    expect(stored?.signOff?.attestation).toBe(true);
    expect(stored?.signOff?.attestationVersion).toBe(ATTESTATION_TEMPLATE_VERSION);
    expect(stored?.signOff?.attestationVersion).not.toBe(stored?.rulePackVersion);
    expect(stored?.signOff?.attestationVersion.length).toBeGreaterThan(0);
    expect(stored?.signOff?.lawyer).toBeTruthy();
    expect(stored?.signOff?.signedAt).toBeTruthy();
  });

  it("SIGNOFF-04: every one of SignOff's eight fields is populated and correctly typed on the stored record, and pinned provenance survives sign-off unchanged", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const beforeStored = await storedAssessment(assessment.id);
    const rulePackIdBefore = beforeStored?.rulePackId;
    const rulePackVersionBefore = beforeStored?.rulePackVersion;
    const engineVersionBefore = beforeStored?.engineVersion;

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedAssessment(assessment.id);
    const signOff = stored?.signOff;
    expect(signOff).toBeTruthy();
    expect(signOff?.lawyer).toEqual(DEMO_USERS.LEGAL_REVIEWER.user);
    expect(signOff?.lawyerName).toBe(DEMO_USERS.LEGAL_REVIEWER.user.displayName);
    expect(signOff?.qualification).toBe(VALID_SIGNOFF_INPUT.qualification);
    expect(Number.isNaN(Date.parse(signOff?.signedAt ?? ""))).toBe(false);
    expect(Number.isInteger(signOff?.finalAmount)).toBe(true);
    expect(signOff?.acknowledgedFlags).toEqual(VALID_SIGNOFF_INPUT.acknowledgedFlags);
    expect(signOff?.attestation).toBe(true);
    expect(signOff?.attestationVersion).toBe(ATTESTATION_TEMPLATE_VERSION);

    // Sign-off never re-pins an assessment to a newer pack.
    expect(stored?.rulePackId).toBe(rulePackIdBefore);
    expect(stored?.rulePackVersion).toBe(rulePackVersionBefore);
    expect(stored?.engineVersion).toBe(engineVersionBefore);
  });

  it("SIGNOFF-04: the stored finalAmount is an integer and equals totals.finalAmount, so the two places it lives can never disagree", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedAssessment(assessment.id);
    expect(Number.isInteger(stored?.signOff?.finalAmount)).toBe(true);
    expect(stored?.totals.finalAmount).toBe(stored?.signOff?.finalAmount);
  });

  it("SIGNOFF-04: a one-character qualification is accepted and stored verbatim", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "Q",
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff?.qualification).toBe("Q");
  });

  it("SIGNOFF-04: a whitespace-only qualification is refused at 400 and stores nothing", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "   \t  ",
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(400);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff).toBeNull();
  });

  it("SIGNOFF-04: a whitespace-padded qualification is stored trimmed, never the raw padded submission", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "  Advocate & Solicitor, Singapore  ",
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);

    const stored = await storedAssessment(assessment.id);
    expect(stored?.signOff?.qualification).toBe("Advocate & Solicitor, Singapore");
  });

  it("SIGNOFF: the returned attestation text is built from the shared renderer, names the jurisdiction and pack, and carries no stale-pack sentence for this pack", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const response = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { attestationText: string; assessment: FixtureAssessment };

    const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
    const expected = renderAttestation({
      jurisdiction: pack.jurisdiction.name,
      packId: pack.packId,
      packVersion: pack.version,
      reviewedOn: pack.reviewedOn,
      packIsStale: false,
    });

    expect(body.attestationText).toBe(expected);
    expect(body.attestationText).toContain("Singapore");
    expect(body.attestationText).toContain("SG-PDPA");
    expect(body.attestationText).toContain(pack.version);
    expect(body.attestationText).not.toContain("past its review date");
  });

  it("SIGNOFF: a second sign-off on an already signed-off assessment is refused with a conflict status and leaves the first record untouched", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);

    const first = await signoffRoute(jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT), {
      params: Promise.resolve({ id: assessment.id }),
    });
    expect(first.status).toBe(200);
    const firstStored = await storedAssessment(assessment.id);

    const second = await signoffRoute(
      jsonRequest(`${SIGNOFF_URL}/${assessment.id}/signoff`, "POST", {
        ...VALID_SIGNOFF_INPUT,
        qualification: "A different qualification entirely",
      }),
      { params: Promise.resolve({ id: assessment.id }) }
    );
    expect(second.status).toBe(409);

    const secondStored = await storedAssessment(assessment.id);
    expect(secondStored?.signOff).toEqual(firstStored?.signOff);
  });
});
