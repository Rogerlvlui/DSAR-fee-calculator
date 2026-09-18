// apps/web/src/ui/hr/notice-block.test.tsx
//
// Colocated, renderToStaticMarkup — the pure *View component only.
// Tagged HR-RESULT.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NoticeBlockView, NOTICE_BOUNDARY_NOTE, NOTICE_DRAFT_WATERMARK } from "./notice-block.tsx";

const SAMPLE_DRAFT = [
  "Reference: DSAR-2026-0142",
  "Amount: SGD 160.00",
  "",
  "What this covers:",
  "- Staff time locating and retrieving records: SGD 160.00",
  "",
  "Sample authored wording — a genuinely long line to prove the block never truncates it: " +
    "this sentence keeps going well past a single-line width on purpose, so a naive truncation rule would clip it.",
].join("\n");

function render(overrides: Partial<Parameters<typeof NoticeBlockView>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(NoticeBlockView, {
      draft: SAMPLE_DRAFT,
      noticeSentAt: null,
      pending: false,
      error: null,
      onMarkSent: () => {},
      ...overrides,
    })
  );
}

describe("HR-RESULT", () => {
  it("HR-RESULT: renders the draft watermark as text inside the same block as the draft, not a decorative overlay", () => {
    const html = render();
    const watermarkIndex = html.indexOf(NOTICE_DRAFT_WATERMARK);
    const draftIndex = html.indexOf("Reference: DSAR-2026-0142");

    expect(watermarkIndex).toBeGreaterThan(-1);
    expect(draftIndex).toBeGreaterThan(-1);
    expect(watermarkIndex).toBeLessThan(draftIndex);
    // Same containing block, not a separately-positioned overlay element.
    expect(html).toContain('data-testid="notice-block"');
  });

  it("HR-RESULT: renders the no-email boundary note verbatim", () => {
    const html = render();
    expect(html).toContain(NOTICE_BOUNDARY_NOTE);
  });

  it("HR-RESULT: never truncates the draft, however long it is", () => {
    const html = render();
    expect(html).toContain(SAMPLE_DRAFT.split("\n").at(-1)!);
    expect(html).not.toContain("text-overflow");
    expect(html).not.toContain("…");
  });

  it("HR-RESULT: shows the mark-sent control before sending and the recorded date after", () => {
    const beforeHtml = render({ noticeSentAt: null });
    expect(beforeHtml).toContain('data-testid="notice-mark-sent"');
    expect(beforeHtml).not.toContain('data-testid="notice-sent-confirmation"');

    const afterHtml = render({ noticeSentAt: "2026-09-20T00:00:00Z" });
    expect(afterHtml).toContain('data-testid="notice-sent-confirmation"');
    expect(afterHtml).toContain("2026-09-20T00:00:00Z");
    expect(afterHtml).not.toContain('data-testid="notice-mark-sent"');
  });
});
