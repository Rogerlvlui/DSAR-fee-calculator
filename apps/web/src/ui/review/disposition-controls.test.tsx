// apps/web/src/ui/review/disposition-controls.test.tsx
//
// Colocated, renderToStaticMarkup — state-driven behaviour (which controls
// render, whether they're disabled) is tested by rendering with the
// corresponding props, not by simulating a click (no interaction harness
// is installed in this repo, matching expense-line-repeater.test.tsx's own
// precedent). Tagged DISPOSITION-CONTROLS.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Verdict } from "@dsar/schemas/assessment";
import { DispositionControlsView } from "./disposition-controls.tsx";

function renderControls(verdict: Verdict, pending = false): string {
  return renderToStaticMarkup(
    React.createElement(DispositionControlsView, {
      verdict,
      currency: "SGD",
      reason: "",
      amountMajor: "",
      attemptedSubmit: false,
      error: null,
      pending,
      onReasonChange: () => {},
      onAmountChange: () => {},
      onSubmit: () => {},
    })
  );
}

/** Extracts the `data-action` values of every rendered
 * data-testid="disposition-action" element, in document order. */
function offeredActions(html: string): string[] {
  return [...html.matchAll(/data-testid="disposition-action" data-action="([a-z_-]+)"/g)].map(
    (match) => match[1]!
  );
}

describe("DISPOSITION-CONTROLS", () => {
  it("DISPOSITION-CONTROLS: a supported (ALLOW) line offers exactly accept, reduce and strike", () => {
    const html = renderControls("ALLOW");
    expect(offeredActions(html).sort()).toEqual(["accept", "reduce", "strike"]);
  });

  it("DISPOSITION-CONTROLS: a capped (ALLOW_CAPPED) line offers exactly accept, reduce and strike", () => {
    const html = renderControls("ALLOW_CAPPED");
    expect(offeredActions(html).sort()).toEqual(["accept", "reduce", "strike"]);
  });

  it("DISPOSITION-CONTROLS: a flagged line offers exactly allow-with-amount, strike and ask-hr", () => {
    const html = renderControls("FLAG");
    expect(offeredActions(html).sort()).toEqual(["allow_with_amount", "ask-hr", "strike"]);
  });

  it("DISPOSITION-CONTROLS: a not-supported (DISALLOW) line offers exactly accept and allow-anyway", () => {
    const html = renderControls("DISALLOW");
    expect(offeredActions(html).sort()).toEqual(["accept", "allow_anyway"]);
  });

  it("DISPOSITION-CONTROLS: the pending prop disables every action control", () => {
    const html = renderControls("ALLOW", true);
    const buttonBlocks = [...html.matchAll(/<button[^>]*data-testid="disposition-action"[^>]*>/g)].map(
      (match) => match[0]
    );
    expect(buttonBlocks.length).toBeGreaterThan(0);
    for (const block of buttonBlocks) {
      expect(block).toContain("disabled");
    }
  });
});
