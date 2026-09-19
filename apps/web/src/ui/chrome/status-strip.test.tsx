// apps/web/src/ui/chrome/status-strip.test.tsx
//
// Colocated tests for StatusStrip and DemoBanner — both tagged STATUS-STRIP
// per this plan's testing convention. Rendered with renderToStaticMarkup
// (react-dom/server), the same technique tests/boundary/dom-denylist.test.ts
// already uses in this repo, and asserted against the returned markup
// string.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusStrip, PACK_STATUS_DISCLOSURE } from "./status-strip.tsx";
import { DemoBanner, DEMO_BANNER_TEXT } from "./demo-banner.tsx";

describe("STATUS-STRIP: StatusStrip", () => {
  it("STATUS-STRIP: reports the pack's real DRAFT status and never the coerced ACTIVE value", () => {
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

  it("STATUS-STRIP: renders the pack-status disclosure microcopy verbatim", () => {
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

    expect(html).toContain(PACK_STATUS_DISCLOSURE);
  });

  function renderStrip(overrides: Partial<React.ComponentProps<typeof StatusStrip>> = {}): string {
    return renderToStaticMarkup(
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
        ...overrides,
      })
    );
  }

  it("STATUS-STRIP: a null reviewedOn renders 'Not yet reviewed' in the Reviewed cell", () => {
    const html = renderStrip({ reviewedOn: null });
    expect(html).toContain("Not yet reviewed");
  });

  it("STATUS-STRIP: a non-null reviewedOn renders that date verbatim in the Reviewed cell", () => {
    const html = renderStrip({ reviewedOn: "2026-01-15" });
    expect(html).toContain("2026-01-15");
  });

  it("STATUS-STRIP: daysUntilReviewDue greater than 30 renders 'Current' in the Review due cell", () => {
    const html = renderStrip({ daysUntilReviewDue: 31 });
    expect(html).toContain("Current");
  });

  it("STATUS-STRIP: daysUntilReviewDue of exactly 30 renders the due-soon state, not 'Current'", () => {
    const html = renderStrip({ daysUntilReviewDue: 30 });
    expect(html).toContain("Due in 30 days");
    expect(html).not.toContain(">Current<");
  });

  it("STATUS-STRIP: a negative daysUntilReviewDue renders the stale state, distinct from due-soon", () => {
    const html = renderStrip({ daysUntilReviewDue: -1 });
    expect(html).toContain("Stale — past its review date");
  });

  it("STATUS-STRIP: the pre-existing Pack status cell and PACK_STATUS_DISCLOSURE are still rendered unchanged with the two new props supplied", () => {
    const html = renderStrip({ packStatus: "DRAFT", reviewedOn: null, daysUntilReviewDue: 400 });
    expect(html).toContain('data-testid="pack-status-cell"');
    expect(html).toContain(PACK_STATUS_DISCLOSURE);
    expect(html).toContain("DRAFT");
  });
});

describe("STATUS-STRIP: DemoBanner", () => {
  it("STATUS-STRIP: renders the no-persistent-data marker sentence verbatim and carries no dismiss control", () => {
    const html = renderToStaticMarkup(React.createElement(DemoBanner));

    expect(html).toContain(DEMO_BANNER_TEXT);
    expect(html).not.toContain("<button");
  });
});
