// apps/web/src/ui/review/recompute-confirm.test.tsx
//
// Colocated, renderToStaticMarkup — renders RecomputeConfirmView directly
// (the pure half), matching disposition-controls.test.tsx's own precedent.
// Tagged RECOMPUTE-CONFIRM.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecomputeConfirmView, shouldRenderRecomputeBanner } from "./recompute-confirm.tsx";

function renderBanner(props: {
  expanded?: boolean;
  pending?: boolean;
  error?: string | null;
}): string {
  return renderToStaticMarkup(
    React.createElement(RecomputeConfirmView, {
      pinnedVersion: "2026.09.1",
      newVersion: "2026.10.1",
      expanded: props.expanded ?? false,
      pending: props.pending ?? false,
      error: props.error ?? null,
      onExpand: () => {},
      onCancel: () => {},
      onConfirm: () => {},
    })
  );
}

describe("RECOMPUTE-CONFIRM", () => {
  it("RECOMPUTE-CONFIRM: collapsed by default, showing only the heading/body naming pinnedVersion/newVersion", () => {
    const html = renderBanner({});
    expect(html).toContain("2026.10.1");
    expect(html).toContain("is now active");
    expect(html).toContain("2026.09.1");
    expect(html).not.toContain("clear every disposition");
    expect(html).not.toContain("Yes, recompute");
  });

  it("RECOMPUTE-CONFIRM: expanded shows the discard-warning copy plus both buttons", () => {
    const html = renderBanner({ expanded: true });
    expect(html).toContain("clear every disposition recorded so far");
    expect(html).toContain("Yes, recompute and clear dispositions");
    expect(html).toContain("Cancel");
  });

  it("RECOMPUTE-CONFIRM: never renders a dialog, modal, or portal — structurally in-place", () => {
    const collapsedHtml = renderBanner({});
    const expandedHtml = renderBanner({ expanded: true });
    expect(collapsedHtml).not.toContain("<dialog");
    expect(expandedHtml).not.toContain("<dialog");
  });

  it("RECOMPUTE-CONFIRM: renders the submit-failure copy inline when an error is present, and stays expanded", () => {
    const html = renderBanner({ expanded: true, error: "engine threw" });
    expect(html).toContain("Recompute failed");
    expect(html).toContain("engine threw");
    expect(html).toContain("have not been changed");
    // Still expanded — the discard warning and both buttons remain visible.
    expect(html).toContain("Yes, recompute and clear dispositions");
  });

  it("RECOMPUTE-CONFIRM: both action buttons render disabled while pending", () => {
    const html = renderBanner({ expanded: true, pending: true });
    expect(html).toMatch(/data-testid="recompute-confirm-button"[^>]*disabled/);
  });
});

describe("RECOMPUTE-CONFIRM: shouldRenderRecomputeBanner (gating, both directions)", () => {
  it("RECOMPUTE-CONFIRM: a genuine version mismatch shows the banner", () => {
    expect(shouldRenderRecomputeBanner("2026.09.1", "2026.10.1")).toBe(true);
  });

  it("RECOMPUTE-CONFIRM: identical versions (today's real case for every committed pack) show nothing", () => {
    expect(shouldRenderRecomputeBanner("2026.09.1", "2026.09.1")).toBe(false);
  });
});
