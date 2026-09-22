// apps/web/src/ui/hr/info-request-panel.test.tsx
//
// Colocated, renderToStaticMarkup — the pure *View component only.
// Tagged INFO-REQUEST.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InfoRequestPanelView, type InfoRequestPanelQuery } from "./info-request-panel.tsx";

const QUERIES: InfoRequestPanelQuery[] = [
  {
    id: "req-1",
    lineLabel: "Line 5 · Third-party payroll / tax vendor charge",
    query: "Please supply the vendor invoice reference for this line.",
    raisedAt: "2026-09-18T10:00:00Z",
  },
  {
    id: "req-2",
    lineLabel: "Line 6 · Something else — referred to Legal",
    query: "What was this meeting actually for?",
    raisedAt: "2026-09-19T09:30:00Z",
  },
];

function render(overrides: Partial<Parameters<typeof InfoRequestPanelView>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(InfoRequestPanelView, {
      queries: QUERIES,
      pending: false,
      error: null,
      onResubmit: () => {},
      ...overrides,
    })
  );
}

describe("INFO-REQUEST", () => {
  it("INFO-REQUEST: renders every outstanding query with the line it was raised against and the date raised", () => {
    const html = render();

    expect(html).toContain("Line 5 · Third-party payroll / tax vendor charge");
    expect(html).toContain("Please supply the vendor invoice reference for this line.");
    expect(html).toContain("2026-09-18T10:00:00Z");
    expect(html).toContain("Line 6 · Something else — referred to Legal");
    expect(html).toContain("What was this meeting actually for?");
    expect(html).toContain("2026-09-19T09:30:00Z");
  });

  it("INFO-REQUEST: the re-submit control disables while pending", () => {
    const html = render({ pending: true });

    expect(html).toMatch(/data-testid="info-request-resubmit"[^>]*disabled/);
  });

  it("INFO-REQUEST: renders an inline error without hiding the query list", () => {
    const html = render({ error: "Something went wrong." });

    expect(html).toContain('data-testid="info-request-error"');
    expect(html).toContain('data-testid="info-request-list"');
  });
});
