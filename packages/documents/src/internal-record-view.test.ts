// packages/documents/src/internal-record-view.test.ts
//
// Pure-module tests — no @react-pdf/renderer instantiated anywhere in this
// file. Also carries a source-scan assertion (matching this codebase's own
// established technique, e.g. tests/boundary/rsc-payload-leak.test.ts) that
// internal-record-view.ts itself imports neither the renderer package nor
// anything resolving under apps/web (this plan's must_haves).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AssessmentSchema, type Assessment } from "@dsar/schemas/assessment";
import { MatterSchema, type Matter } from "@dsar/schemas/matter";
import type { LoadableRulePack } from "@dsar/schemas/rule-pack";
import {
  buildInternalRecordView,
  INTERNAL_RECORD_FOOTER_TEMPLATE,
  renderInternalRecordFooter,
  type InternalRecordFooter,
} from "./internal-record-view.ts";

const SOURCE_PATH = fileURLToPath(new URL("./internal-record-view.ts", import.meta.url));
const SOURCE_TEXT = readFileSync(SOURCE_PATH, "utf8");

// Only actual `import ... from "..."` statement lines are scanned — the
// module's own prose comments legitimately discuss "apps/web" and
// "@react-pdf/renderer" by name (explaining why neither is imported), and a
// whole-file substring match would false-positive on that prose.
const IMPORT_LINES = SOURCE_TEXT.split("\n").filter((line) => /^\s*import\b.*\bfrom\b/.test(line));

describe("DOC-05 internal-record-view purity", () => {
  it("imports no renderer package and nothing resolving under apps/web", () => {
    expect(IMPORT_LINES.length).toBeGreaterThan(0);
    for (const line of IMPORT_LINES) {
      expect(line).not.toContain("@react-pdf/renderer");
      expect(line).not.toContain("apps/web");
    }
  });
});

const FOOTER: InternalRecordFooter = {
  packId: "SG-PDPA",
  packVersion: "2026.09.1",
  engineVersion: "0.1.0",
  lawyerName: "Marcus Tan",
  qualification: "Advocate & Solicitor, Singapore",
  date: "2026-09-20T10:00:00.000Z",
};

describe("renderInternalRecordFooter", () => {
  it("substitutes every placeholder — no unsubstituted token remains", () => {
    const rendered = renderInternalRecordFooter(FOOTER);
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(rendered).toContain("SG-PDPA");
    expect(rendered).toContain("2026.09.1");
    expect(rendered).toContain("0.1.0");
    expect(rendered).toContain("Marcus Tan");
    expect(rendered).toContain("Advocate & Solicitor, Singapore");
    expect(rendered).toContain("2026-09-20T10:00:00.000Z");
  });

  it("carries PRD §10.5(a)'s own not-legal-advice sentence, verbatim", () => {
    expect(INTERNAL_RECORD_FOOTER_TEMPLATE).toContain("Not legal advice to any third party.");
  });
});

function buildFixtureAssessment(overrides: Partial<ReturnType<typeof AssessmentSchema.parse>> = {}): Assessment {
  return AssessmentSchema.parse({
    id: "assessment-1",
    matterId: "matter-1",
    rulePackId: "SG-PDPA",
    rulePackVersion: "2026.09.1",
    engineVersion: "0.1.0",
    computedAt: "2026-09-20T09:00:00Z",
    lines: [],
    matterLevelFlags: [],
    totals: {
      claimedTotal: 27500,
      draftBaseline: 18640,
      disallowedTotal: 8860,
      flaggedTotal: 0,
      restingOnUnverifiedRules: 18640,
      finalAmount: 18640,
    },
    signOff: {
      lawyer: {
        id: "01K5GSD0RVWRPBKRDPTJTHDN93",
        displayName: "Marcus Tan — Legal, Singapore",
        email: "marcus.tan@example.invalid",
      },
      lawyerName: "Marcus Tan",
      qualification: "Advocate & Solicitor, Singapore",
      signedAt: "2026-09-20T10:00:00Z",
      finalAmount: 18640,
      acknowledgedFlags: [],
      attestation: true,
      attestationVersion: "SIGNOFF-ATTESTATION-2026.09",
    },
    ...overrides,
  });
}

const FIXTURE_MATTER: Matter = MatterSchema.parse({
  id: "01K5GSD0MATTERXQX2RZB4FDK1",
  reference: "DSAR-0001",
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
  status: "SIGNED_OFF",
  createdBy: {
    id: "01K5GSD0HRPREPXQX2RZB4FDKV",
    displayName: "Priya Nair — HR Shared Services",
    email: "priya.nair@example.invalid",
  },
  createdAt: "2026-09-01T00:00:00Z",
});

// buildInternalRecordView does not yet read `pack` (reserved for 07-04's
// dense table) — an empty cast is sufficient here and avoids constructing a
// full LoadableRulePack fixture this test does not need.
const FIXTURE_PACK = {} as LoadableRulePack;

describe("buildInternalRecordView", () => {
  it("returns a footer whose packId, packVersion and engineVersion equal the assessment's own pinned and stamped values, not the current pack's", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView(assessment, FIXTURE_MATTER, FIXTURE_PACK);

    expect(view.footer.packId).toBe(assessment.rulePackId);
    expect(view.footer.packVersion).toBe(assessment.rulePackVersion);
    expect(view.footer.engineVersion).toBe(assessment.engineVersion);
    expect(view.footer.lawyerName).toBe(assessment.signOff?.lawyerName);
    expect(view.footer.qualification).toBe(assessment.signOff?.qualification);
    expect(view.footer.date).toBe(assessment.signOff?.signedAt);
  });

  it("builds the title from UI-SPEC's exact copy", () => {
    const assessment = buildFixtureAssessment();
    const view = buildInternalRecordView(assessment, FIXTURE_MATTER, FIXTURE_PACK);
    expect(view.title).toBe(`Internal fee assessment record — ${FIXTURE_MATTER.reference}`);
    expect(view.matterReference).toBe(FIXTURE_MATTER.reference);
  });

  it("throws before building anything when the assessment carries no sign-off record", () => {
    const assessment = buildFixtureAssessment({ signOff: null });
    expect(() => buildInternalRecordView(assessment, FIXTURE_MATTER, FIXTURE_PACK)).toThrow();
  });
});
