// apps/web/src/ui/review/internal-record-download.test.tsx
//
// Colocated, renderToStaticMarkup — the pure View component only, never
// the stateful wrapper (fetch is unavailable under a bare static render,
// the same reason every other component in this directory is split this
// way). Tagged INTERNAL-RECORD-DOWNLOAD.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  InternalRecordDownloadView,
  INTERNAL_RECORD_DOWNLOAD_LABEL,
  internalRecordDownloadFailure,
  filenameFromContentDisposition,
} from "./internal-record-download.tsx";

function render(overrides: Partial<React.ComponentProps<typeof InternalRecordDownloadView>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(InternalRecordDownloadView, {
      pending: false,
      error: null,
      onDownload: () => {},
      ...overrides,
    })
  );
}

function extractButtonLabel(html: string): string {
  const match = /<button[^>]*data-testid="internal-record-download-button"[^>]*>([^<]*)<\/button>/.exec(html);
  if (!match) throw new Error("internal-record-download-button not found in rendered HTML");
  return match[1] ?? "";
}

describe("INTERNAL-RECORD-DOWNLOAD", () => {
  it("INTERNAL-RECORD-DOWNLOAD: not pending, no error -> an enabled button carrying the exact Copywriting Contract label", () => {
    const html = render();
    expect(extractButtonLabel(html)).toBe(INTERNAL_RECORD_DOWNLOAD_LABEL);
    expect(html).not.toMatch(/data-testid="internal-record-download-button"[^>]*disabled/);
  });

  it("INTERNAL-RECORD-DOWNLOAD: pending -> the button is disabled and its text is byte-identical to the not-pending render", () => {
    const notPendingHtml = render({ pending: false });
    const pendingHtml = render({ pending: true });

    expect(pendingHtml).toMatch(/data-testid="internal-record-download-button"[^>]*disabled/);
    expect(extractButtonLabel(pendingHtml)).toBe(extractButtonLabel(notPendingHtml));
  });

  it("INTERNAL-RECORD-DOWNLOAD: no spinner or progress element renders in either state", () => {
    expect(render({ pending: false })).not.toMatch(/spinner|progressbar/i);
    expect(render({ pending: true })).not.toMatch(/spinner|progressbar/i);
  });

  it("INTERNAL-RECORD-DOWNLOAD: an error prop renders the failure sentence inline with an alert role, beside the trigger", () => {
    const html = render({ error: "Request failed with status 500" });
    expect(html).toContain('role="alert"');
    expect(html).toContain(internalRecordDownloadFailure("Request failed with status 500"));
    // Beside the trigger — inside the same container, not a separate
    // overlay/modal element.
    expect(html).toMatch(/data-testid="internal-record-download"/);
  });

  it("INTERNAL-RECORD-DOWNLOAD: with an error set, no download-bearing element is present — no file is offered", () => {
    const html = render({ error: "Request failed with status 500" });
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/\shref=/);
    expect(html).not.toMatch(/\sdownload=/);
  });
});

describe("INTERNAL-RECORD-DOWNLOAD: filenameFromContentDisposition", () => {
  it("INTERNAL-RECORD-DOWNLOAD: extracts the quoted filename from a real content-disposition header", () => {
    expect(filenameFromContentDisposition('attachment; filename="DSAR-2026-0142-internal-record.pdf"')).toBe(
      "DSAR-2026-0142-internal-record.pdf"
    );
  });

  it("INTERNAL-RECORD-DOWNLOAD: falls back to a generic name for a missing header, never throwing", () => {
    expect(filenameFromContentDisposition(null)).toBe("internal-record.pdf");
  });

  it("INTERNAL-RECORD-DOWNLOAD: falls back to a generic name for a malformed header, never throwing", () => {
    expect(filenameFromContentDisposition("attachment")).toBe("internal-record.pdf");
  });
});
