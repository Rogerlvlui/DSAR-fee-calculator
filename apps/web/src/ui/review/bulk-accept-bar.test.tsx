// apps/web/src/ui/review/bulk-accept-bar.test.tsx
//
// Colocated, renderToStaticMarkup — renders BulkAcceptBarView directly
// (the pure half), matching disposition-controls.test.tsx's own precedent
// for a component whose stateful sibling calls useRouter(). Tagged
// BULK-ACCEPT.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BulkAcceptBarView, BULK_ACCEPT_NOTE, BULK_ACCEPT_REASON_FAILURE_TEXT, bulkAcceptLabel } from "./bulk-accept-bar.tsx";

function renderBar(
  eligibleLineIds: string[],
  overrides: { reason?: string; attemptedSubmit?: boolean } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(BulkAcceptBarView, {
      eligibleLineIds,
      reason: overrides.reason ?? "",
      attemptedSubmit: overrides.attemptedSubmit ?? false,
      error: null,
      pending: false,
      onReasonChange: () => {},
      onSubmit: () => {},
    })
  );
}

describe("BULK-ACCEPT", () => {
  it("BULK-ACCEPT: at zero eligible lines, the control renders with a zero in its label and carries the disabled attribute", () => {
    const html = renderBar([]);
    expect(html).toContain(bulkAcceptLabel(0));
    expect(html).toMatch(/data-testid="bulk-accept-button"[^>]*disabled/);
  });

  it("BULK-ACCEPT: given one eligible line, the count is one and the control is enabled", () => {
    const html = renderBar(["line-1"]);
    expect(html).toContain(bulkAcceptLabel(1));
    expect(html).not.toMatch(/data-testid="bulk-accept-button"[^>]*disabled/);
  });

  it("BULK-ACCEPT: the note about what bulk accept is not available for renders verbatim in both the zero and non-zero states", () => {
    expect(renderBar([])).toContain(BULK_ACCEPT_NOTE);
    expect(renderBar(["line-1"])).toContain(BULK_ACCEPT_NOTE);
  });

  it("BULK-ACCEPT: the count comes from the eligibleLineIds prop, proven by rendering the same component with two different counts", () => {
    const zero = renderBar([]);
    const two = renderBar(["line-1", "line-2"]);
    expect(zero).toContain(bulkAcceptLabel(0));
    expect(two).toContain(bulkAcceptLabel(2));
    expect(zero).not.toBe(two);
  });

  it("BULK-ACCEPT: the control still renders (rather than disappearing) at zero", () => {
    const html = renderBar([]);
    expect(html).toContain('data-testid="bulk-accept-bar"');
    expect(html).toContain('data-testid="bulk-accept-button"');
  });

  it("BULK-ACCEPT: an attempted submit with a reason that exactly matches a stop-list entry renders the stock-phrase copy, not the generic length-failure text", () => {
    const html = renderBar(["line-1"], { reason: "as above", attemptedSubmit: true });
    expect(html).toContain("stock phrase, not a reason");
    expect(html).toContain("as above");
    expect(html).not.toContain(BULK_ACCEPT_REASON_FAILURE_TEXT.replace(/'/g, "&#x27;"));
  });

  it("BULK-ACCEPT: an attempted submit with a too-short, non-stock-phrase reason still renders the generic length-failure text", () => {
    const html = renderBar(["line-1"], { reason: "too short", attemptedSubmit: true });
    expect(html).toContain(BULK_ACCEPT_REASON_FAILURE_TEXT.replace(/'/g, "&#x27;"));
  });
});
