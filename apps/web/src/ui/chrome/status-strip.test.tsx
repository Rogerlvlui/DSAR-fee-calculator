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
      })
    );

    expect(html).toContain(PACK_STATUS_DISCLOSURE);
  });
});

describe("STATUS-STRIP: DemoBanner", () => {
  it("STATUS-STRIP: renders the no-persistent-data marker sentence verbatim and carries no dismiss control", () => {
    const html = renderToStaticMarkup(React.createElement(DemoBanner));

    expect(html).toContain(DEMO_BANNER_TEXT);
    expect(html).not.toContain("<button");
  });
});
