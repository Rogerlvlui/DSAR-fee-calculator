// apps/web/src/ui/intake/autosave-indicator.test.tsx
//
// First test file for this component. Rendered with renderToStaticMarkup,
// tagged AUTOSAVE-INDICATOR. The relative-time test supplies a fixed `now`
// rather than depending on real wall-clock time, so it cannot flake.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutosaveIndicator, AUTOSAVE_FAILED_SENTENCE } from "./autosave-indicator.tsx";

function render(status: "idle" | "saving" | "saved" | "error", savedAt: number | null, now?: number): string {
  return renderToStaticMarkup(
    React.createElement(AutosaveIndicator, now === undefined ? { status, savedAt } : { status, savedAt, now })
  );
}

describe("AUTOSAVE-INDICATOR: AutosaveIndicator", () => {
  it("AUTOSAVE-INDICATOR: idle or saving renders 'Saving…'", () => {
    expect(render("idle", null)).toContain("Saving…");
    expect(render("saving", null)).toContain("Saving…");
  });

  it("AUTOSAVE-INDICATOR: saved renders 'Saved just now' when savedAt is within the last 60 seconds of a supplied now", () => {
    const now = 1_000_000;
    const savedAt = now - 30_000;
    expect(render("saved", savedAt, now)).toContain("Saved just now");
  });

  it("AUTOSAVE-INDICATOR: saved renders 'Saved {n} minutes ago' beyond 60 seconds", () => {
    const now = 1_000_000;
    const savedAt = now - 3 * 60_000;
    expect(render("saved", savedAt, now)).toContain("Saved 3 minutes ago");
  });

  it("AUTOSAVE-INDICATOR: error renders the UI-SPEC's verbatim failure sentence", () => {
    expect(render("error", null)).toContain(AUTOSAVE_FAILED_SENTENCE);
  });
});
