// tests/routes/internal-record.test.ts
//
// Route-level tests for the internal-record PDF endpoint, tagged
// INTERNAL-RECORD. Drives the real GET handler with a real Request over a
// real signed-off four-line matter, built the same way
// tests/routes/signoff.test.ts already builds one: create matter, add
// lines, submit, disposition every line, sign off.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { GET as internalRecordRoute } from "../../apps/web/app/api/assessments/[id]/internal-record/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";

const MATTERS_URL = "http://localhost/api/matters";
const ASSESSMENTS_URL = "http://localhost/api/assessments";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;
const HR_COOKIE = `${DEMO_ROLE_COOKIE}=HR_PREPARER`;

// The literal five-byte PDF signature every well-formed PDF body opens
// with — asserted as raw bytes, not merely "the file is non-empty".
const PDF_MAGIC_HEADER = "%PDF-";

function jsonRequest(url: string, method: string, body: unknown, cookie: string = LEGAL_COOKIE): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

function getRequest(url: string, cookie: string): Request {
  return new Request(url, { method: "GET", headers: { cookie } });
}

let matterCounter = 0;

function nextReference(): string {
  matterCounter += 1;
  return `DSAR-INTREC-${String(matterCounter).padStart(4, "0")}`;
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
  lines: { id: string; verdict: string; disposition: string }[];
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

const VALID_SIGNOFF_INPUT = {
  qualification: "Advocate & Solicitor, Singapore",
  acknowledgedFlags: [],
  attestation: true,
};

async function signOffFixture(assessment: FixtureAssessment): Promise<void> {
  const response = await signoffRoute(
    jsonRequest(`${ASSESSMENTS_URL}/${assessment.id}/signoff`, "POST", VALID_SIGNOFF_INPUT),
    { params: Promise.resolve({ id: assessment.id }) }
  );
  expect(response.status).toBe(200);
}

describe("INTERNAL-RECORD", () => {
  it("INTERNAL-RECORD: a signed-off assessment requested by LEGAL_REVIEWER returns 200, the PDF content type, and a body starting with the PDF magic header", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${assessment.id}/internal-record`, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");

    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii")).toBe(PDF_MAGIC_HEADER);
  });

  it("INTERNAL-RECORD: the same request carrying the HR_PREPARER cookie returns 403 with a JSON error body and no PDF bytes", async () => {
    const assessment = await buildFixtureAssessment();
    await dispositionAllLines(assessment);
    await signOffFixture(assessment);

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${assessment.id}/internal-record`, HR_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("INTERNAL-RECORD: an assessment whose signOff field is null returns 409 and produces no document at all", async () => {
    const assessment = await buildFixtureAssessment();
    // Deliberately not dispositioned or signed off — every line is still
    // PENDING and assessment.signOff is null.

    const response = await internalRecordRoute(
      getRequest(`${ASSESSMENTS_URL}/${assessment.id}/internal-record`, LEGAL_COOKIE),
      { params: Promise.resolve({ id: assessment.id }) }
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).not.toBe("application/pdf");
  });
});
