// apps/web/src/ui/hr/notice-block.test.tsx
//
// Colocated, renderToStaticMarkup — the pure *View component only.
// Tagged HR-RESULT.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NoticeBlock, NOTICE_BOUNDARY_NOTE, NOTICE_DRAFT_WATERMARK } from "./notice-block.tsx";

const SENT_INSTANT = "2026-09-20T14:32:07.000Z";

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

function render(overrides: Partial<Parameters<typeof NoticeBlock>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(NoticeBlock, {
      draft: SAMPLE_DRAFT,
      noticeSentAt: null,
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

  // Product-owner decision, 2026-09-30: no "Mark notice sent" button.
  it("HR-RESULT: renders no mark-sent button, and shows the recorded date only once a send is on record", () => {
    const beforeHtml = render({ noticeSentAt: null });
    expect(beforeHtml).not.toContain("<button");
    expect(beforeHtml).not.toContain("Mark notice sent");
    expect(beforeHtml).not.toContain('data-testid="notice-sent-confirmation"');

    const afterHtml = render({ noticeSentAt: SENT_INSTANT });
    expect(afterHtml).toContain('data-testid="notice-sent-confirmation"');
    expect(afterHtml).toContain("2026-09-20");
  });

  // DOC-02: the watermark is queryable exactly while the notice is still a
  // draft, and gone the moment it is marked sent — never both, never
  // neither.
  it("HR-RESULT: the DRAFT watermark is queryable when noticeSentAt is null and not queryable once it is set", () => {
    const beforeHtml = render({ noticeSentAt: null });
    expect(beforeHtml).toContain('data-testid="notice-watermark"');

    const afterHtml = render({ noticeSentAt: SENT_INSTANT });
    expect(afterHtml).not.toContain('data-testid="notice-watermark"');
  });

  it("HR-RESULT: the draft text stays queryable both before and after the notice is marked sent", () => {
    const beforeHtml = render({ noticeSentAt: null });
    const afterHtml = render({ noticeSentAt: SENT_INSTANT });

    expect(beforeHtml).toContain('data-testid="notice-draft-text"');
    expect(afterHtml).toContain('data-testid="notice-draft-text"');
  });

  // SIGNOFF-06: the preparer reads a calendar date, never a wall-clock
  // instant that would read like a transmission timestamp for something
  // this tool never transmitted.
  it("HR-RESULT: the sent confirmation carries only the calendar date, with no colon-separated clock time", () => {
    const html = render({ noticeSentAt: SENT_INSTANT });
    const confirmationMatch = html.match(/<p data-testid="notice-sent-confirmation">([^<]*)<\/p>/);
    expect(confirmationMatch).not.toBeNull();
    const confirmationText = confirmationMatch![1]!;

    expect(confirmationText).toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(confirmationText).not.toMatch(/\d{2}:\d{2}/);
  });

  it("HR-RESULT: the tool-emails-nobody boundary note renders in both the not-sent and sent states", () => {
    const beforeHtml = render({ noticeSentAt: null });
    const afterHtml = render({ noticeSentAt: SENT_INSTANT });

    expect(beforeHtml).toContain('data-testid="notice-boundary-note"');
    expect(afterHtml).toContain('data-testid="notice-boundary-note"');
    expect(beforeHtml).toContain(NOTICE_BOUNDARY_NOTE);
    expect(afterHtml).toContain(NOTICE_BOUNDARY_NOTE);
  });
});
