// apps/web/src/ui/review/stale-pack-notice.test.tsx
//
// Colocated, renderToStaticMarkup — the pure View component only. Tagged
// STALE-PACK-NOTICE.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StalePackNoticeView, STALE_PACK_NOTICE_HEADING, stalePackNoticeBody } from "./stale-pack-notice.tsx";

function render(overrides: Partial<React.ComponentProps<typeof StalePackNoticeView>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(StalePackNoticeView, {
      packId: "SG-PDPA",
      version: "2026.09.1",
      reviewDueOn: "2026-06-15",
      ...overrides,
    })
  );
}

describe("STALE-PACK-NOTICE", () => {
  it("STALE-PACK-NOTICE: renders the pack id, the version and the review-due date in the body", () => {
    const html = render();
    expect(html).toContain("SG-PDPA");
    expect(html).toContain("2026.09.1");
    expect(html).toContain("2026-06-15");
  });

  it("STALE-PACK-NOTICE: renders the heading words, so the state is never colour-only", () => {
    const html = render();
    expect(html).toContain(STALE_PACK_NOTICE_HEADING);
    expect(html).toContain('data-testid="stale-pack-notice-heading"');
  });

  it("STALE-PACK-NOTICE: the body text exactly matches stalePackNoticeBody's own output", () => {
    const html = render({ packId: "HK-PDPO", version: "2026.09.1", reviewDueOn: "2027-01-01" });
    const expectedBody = stalePackNoticeBody({ packId: "HK-PDPO", version: "2026.09.1", reviewDueOn: "2027-01-01" });
    expect(html).toContain(expectedBody);
  });

  it("STALE-PACK-NOTICE: the container carries the destructive token classes, not the warn token classes", () => {
    const html = render();
    expect(html).toMatch(/data-testid="stale-pack-notice"[^>]*class="[^"]*text-stop[^"]*"/);
    expect(html).toMatch(/data-testid="stale-pack-notice"[^>]*class="[^"]*bg-stop-wash[^"]*"/);
    expect(html).not.toMatch(/data-testid="stale-pack-notice"[^>]*class="[^"]*text-warn[^"]*"/);
    expect(html).not.toMatch(/data-testid="stale-pack-notice"[^>]*class="[^"]*bg-warn-wash[^"]*"/);
  });
});
