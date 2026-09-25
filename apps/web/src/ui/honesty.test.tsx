// apps/web/src/ui/honesty.test.tsx
//
// The rendered half of the five-honesty-properties audit (03.1-05 Task 2),
// tagged HONESTY. Runs under the jsdom "web" project, rendered with
// renderToStaticMarkup (the same technique every colocated component test
// in this directory already uses). Holds four of the five properties
// together in one file — the fifth (the layout's marker position) lives in
// tests/routes/honesty.test.ts instead, because rendering the real root
// layout here would trip apps/web/src/server/server-only.ts's runtime
// guard (jsdom always provides a `window`); see that file's own header
// note.
//
// The negative property (no AI-drafted label or model-suggestion block
// anywhere) deliberately does not quote Annex A's exact marker text
// verbatim — line-card.tsx's own module comment records that a grep for
// that literal string is used elsewhere to prove the phrase appears
// nowhere in this codebase, and quoting it here would make this file trip
// that grep against itself.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentLineSchema, AssessmentSchema, type Assessment, type Verdict } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";
import { CapabilityStatement } from "./capability/capability-statement.tsx";
import { DemoBanner, DEMO_BANNER_TEXT } from "./chrome/demo-banner.tsx";
import { StatusStrip } from "./chrome/status-strip.tsx";
import { NoticeBlockView, NOTICE_DRAFT_WATERMARK } from "./hr/notice-block.tsx";
import { ResultView, type ResultViewLine } from "./hr/result-view.tsx";
import { LineCard } from "./review/line-card.tsx";
import { AssessmentView, type AssessmentViewLineDetail } from "./review/assessment-view.tsx";

const CURRENCY = "SGD" as const;

describe("HONESTY: the capability statement's sixth bullet", () => {
  it("HONESTY: renders exactly six bullets, the sixth being the no-persistent-data sentence verbatim", () => {
    const html = renderToStaticMarkup(
      React.createElement(CapabilityStatement, { children: React.createElement("main", null, "gated content") })
    );

    const bulletCount = (html.match(/<li/g) ?? []).length;
    expect(bulletCount).toBe(6);
    expect(html).toContain(
      "Matters and assessments exist only in this server process&#x27;s memory and are lost on restart or code change."
    );
  });
});

describe("HONESTY: the permanent no-persistent-data marker", () => {
  it("HONESTY: renders the UI-SPEC sentence verbatim and exposes no dismiss control", () => {
    const html = renderToStaticMarkup(React.createElement(DemoBanner));

    expect(html).toContain(DEMO_BANNER_TEXT);
    expect(html).not.toContain("<button");
  });
});

describe("HONESTY: the pack-status cell reports the real status", () => {
  it("HONESTY: renders the committed pack's real DRAFT status, and the engine boundary's coerced ACTIVE value appears nowhere in the markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusStrip, {
        matterReference: "DSAR-2026-0001",
        jurisdictionName: "Singapore",
        rulePackId: "SG-PDPA",
        rulePackVersion: "2026.09.1",
        packStatus: "DRAFT",
        authoredByDisplayName: null,
        reviewedByDisplayName: null,
        reviewedOn: null,
        daysUntilReviewDue: 400,
      })
    );

    expect(html).toContain("DRAFT");
    expect(html).not.toContain("ACTIVE");
  });
});

describe("HONESTY: the notice's draft watermark", () => {
  it("HONESTY: renders verbatim, as text inside the same copyable block as the draft — not a decorative overlay excluded from a selection or copy", () => {
    const draft = "Reference: DSAR-2026-0142\nAmount: SGD 466.40";
    const html = renderToStaticMarkup(
      React.createElement(NoticeBlockView, {
        draft,
        noticeSentAt: null,
        pending: false,
        error: null,
        onMarkSent: () => {},
      })
    );

    const watermarkIndex = html.indexOf(NOTICE_DRAFT_WATERMARK);
    const draftIndex = html.indexOf("Reference: DSAR-2026-0142");
    const blockStart = html.indexOf('data-testid="notice-block"');
    const blockEnd = html.indexOf('data-testid="notice-boundary-note"');

    expect(watermarkIndex).toBeGreaterThan(-1);
    // Both the watermark and the draft text sit inside the same
    // data-testid="notice-block" container, ahead of the boundary note —
    // proof it is markup a selection over the block would include, not a
    // CSS-positioned stamp drawn on top of (and excluded from) it.
    expect(watermarkIndex).toBeGreaterThan(blockStart);
    expect(watermarkIndex).toBeLessThan(draftIndex);
    expect(draftIndex).toBeLessThan(blockEnd);
  });
});

describe("HONESTY: no AI-drafted label or model-suggestion block anywhere in this phase", () => {
  // Negative markers a real language-model-provenance feature (Phase 8,
  // packages/agent) would introduce — deliberately not Annex A's own
  // marker text (see this file's header note).
  const AI_PROVENANCE_MARKERS = [/badge\s+ai\b/i, /data-testid="ai-provenance"/, /data-testid="category-suggestion"/];

  function assertNoAiProvenance(html: string, screenName: string): void {
    for (const marker of AI_PROVENANCE_MARKERS) {
      expect(html, `${screenName} unexpectedly matched ${marker}`).not.toMatch(marker);
    }
  }

  it("HONESTY: a flagged line card carries no language-model-provenance badge or category-suggestion block", () => {
    const line = AssessmentLineSchema.parse({
      id: "assessment-line-1",
      expenseLineId: "expense-line-1",
      verdict: "FLAG" as const,
      engineAmount: 0,
      appliedRuleId: "SG-PDPA.OTHER_UNCLASSIFIED",
      appliedCap: null,
      basis: "This category has no authored rule; Legal decides.",
      citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" },
      flagReasons: [{ code: "UNCATEGORISED" as const, message: "This line has not been categorised." }],
      disposition: "PENDING" as const,
      lawyerAmount: null,
      lawyerReason: null,
      dispositionedBy: null,
      dispositionedAt: null,
    });

    const html = renderToStaticMarkup(
      React.createElement(LineCard, {
        line,
        seq: 6,
        categoryLabel: "Something else (always referred to Legal)",
        description: "Miscellaneous cost not covered by any other category",
        quantity: 1,
        unit: "FIXED",
        unitRate: 4500 as Minor,
        claimedAmount: 4500 as Minor,
        currency: CURRENCY,
        verificationStatus: "NEEDS_VERIFICATION",
      })
    );

    assertNoAiProvenance(html, "LineCard");
  });

  it("HONESTY: the full review screen (matter/pack rails, every card, totals rail) carries no language-model-provenance badge or category-suggestion block", () => {
    const specs: { id: string; verdict: Verdict; engineAmount: number; ruleId: string }[] = [
      { id: "line-allow", verdict: "ALLOW", engineAmount: 16000, ruleId: "SG-PDPA.STAFF_TIME_SEARCH" },
      { id: "line-flag", verdict: "FLAG", engineAmount: 0, ruleId: "SG-PDPA.OTHER_UNCLASSIFIED" },
    ];
    const assessment: Assessment = AssessmentSchema.parse({
      id: "assessment-1",
      matterId: "matter-1",
      rulePackId: "SG-PDPA",
      rulePackVersion: "2026.09.1",
      engineVersion: "0.1.0",
      computedAt: "2026-09-18T00:00:00Z",
      lines: specs.map((spec) => ({
        id: spec.id,
        expenseLineId: `${spec.id}-expense`,
        verdict: spec.verdict,
        engineAmount: spec.engineAmount,
        appliedRuleId: spec.ruleId,
        appliedCap: null,
        basis: `Basis for ${spec.ruleId}.`,
        citation: { instrument: "Personal Data Protection Regulations 2021", provision: "reg.7" },
        flagReasons: spec.verdict === "FLAG" ? [{ code: "UNCATEGORISED" as const, message: "Why this needs you." }] : [],
        disposition: "PENDING" as const,
        lawyerAmount: null,
        lawyerReason: null,
        dispositionedBy: null,
        dispositionedAt: null,
      })),
      matterLevelFlags: [],
      totals: {
        claimedTotal: 16000,
        draftBaseline: 16000,
        disallowedTotal: 0,
        flaggedTotal: 0,
        restingOnUnverifiedRules: 16000,
        finalAmount: null,
      },
      signOff: null,
    });
    const lineDetails: AssessmentViewLineDetail[] = specs.map((spec, index) => ({
      assessmentLineId: spec.id,
      seq: index,
      categoryLabel: `Category for ${spec.id}`,
      description: `Description for ${spec.id}`,
      quantity: 1,
      unit: "FIXED",
      unitRate: 1000 as Minor,
      claimedAmount: 1000 as Minor,
      verificationStatus: "NEEDS_VERIFICATION",
    }));

    const html = renderToStaticMarkup(
      React.createElement(AssessmentView, {
        assessment,
        currency: CURRENCY,
        lineDetails,
        matterFlags: [],
        advisoryDeadline: null,
        matter: {
          reference: "DSAR-2026-0001",
          jurisdictionName: "Singapore",
          legalEntity: "Acme Pte Ltd",
          controllerType: "PRIVATE_ORGANISATION",
          requestReceivedOn: "2026-08-20",
          requestorClass: "FORMER_EMPLOYEE",
          identityVerified: true,
          identityVerifiedNote: null,
          scopeClarified: true,
        },
        pack: {
          packId: "SG-PDPA",
          version: "2026.09.1",
          status: "DRAFT",
          feePosture: "PERMITTED_REASONABLE",
          authoredByDisplayName: null,
          reviewedByDisplayName: null,
          reviewedOn: null,
          reviewDueOn: "2027-03-12",
          openQuestions: [],
        },
      })
    );

    assertNoAiProvenance(html, "AssessmentView");
  });

  it("HONESTY: the HR result screen carries no language-model-provenance badge or category-suggestion block", () => {
    const lines: ResultViewLine[] = [
      {
        id: "line-1",
        seq: 1,
        categoryLabel: "Staff time — locating and retrieving the data",
        description: "Searching HRIS, shared drives and archived mail",
        struck: false,
        amount: 16000 as Minor,
        basis: "Locating and retrieving the requested data is a service provided to enable the response.",
      },
      {
        id: "line-2",
        seq: 6,
        categoryLabel: "Something else (always referred to Legal)",
        description: "Miscellaneous cost not covered by any other category",
        struck: true,
        amount: 0 as Minor,
        basis: "This category has no authored rule; Legal decides.",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(ResultView, {
        matterReference: "DSAR-2026-0001",
        finalAmount: 16000 as Minor,
        currency: CURRENCY,
        lawyerName: "Roger Lui — Legal, Singapore",
        qualification: "Advocate & Solicitor, Singapore",
        signedAt: "2026-09-18T12:00:00Z",
        lines,
      })
    );

    assertNoAiProvenance(html, "ResultView");
  });

  it("HONESTY: the notice block carries no language-model-provenance badge or category-suggestion block", () => {
    const html = renderToStaticMarkup(
      React.createElement(NoticeBlockView, {
        draft: "Reference: DSAR-2026-0001\nAmount: SGD 160.00",
        noticeSentAt: null,
        pending: false,
        error: null,
        onMarkSent: () => {},
      })
    );

    assertNoAiProvenance(html, "NoticeBlockView");
  });
});
