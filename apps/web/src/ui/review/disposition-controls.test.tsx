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
import { DispositionControlsView, REASON_COUNTER_FAILURE_TEXT } from "./disposition-controls.tsx";

function renderControls(
  verdict: Verdict,
  pending = false,
  overrides: { reason?: string; attemptedSubmit?: boolean; amountMajor?: string } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(DispositionControlsView, {
      verdict,
      currency: "SGD",
      reason: overrides.reason ?? "",
      amountMajor: overrides.amountMajor ?? "",
      attemptedSubmit: overrides.attemptedSubmit ?? false,
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

function actionButton(html: string, action: string): string {
  const match = html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*>`));
  if (!match) throw new Error(`no ${action} button rendered`);
  return match[0];
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

  it("DISPOSITION-CONTROLS: an amount-taking action stays disabled, with a visible reason, until an amount above zero is entered", () => {
    const cases: [Verdict, string, string][] = [
      ["FLAG", "allow_with_amount", "use Strike"],
      ["DISALLOW", "allow_anyway", "use Accept"],
      ["ALLOW", "reduce", "use Strike"],
    ];
    for (const [verdict, action, alternative] of cases) {
      for (const amountMajor of ["", "0", "0.00", "0.001", "-5", "abc"]) {
        const html = renderControls(verdict, false, { amountMajor });
        expect(actionButton(html, action)).toContain("disabled");
        expect(html).toContain('data-testid="disposition-amount-hint"');
        expect(html).toContain(alternative);
      }
      const ready = renderControls(verdict, false, { amountMajor: "12.50" });
      expect(actionButton(ready, action)).not.toContain("disabled");
      expect(ready).not.toContain('data-testid="disposition-amount-hint"');
    }
  });

  it("DISPOSITION-CONTROLS: the amount rule never disables actions that take no amount", () => {
    const html = renderControls("FLAG");
    expect(actionButton(html, "strike")).not.toContain("disabled");
    expect(actionButton(html, "ask-hr")).not.toContain("disabled");
  });

  it("DISPOSITION-CONTROLS: an attempted submit with a reason that exactly matches a stop-list entry renders the stock-phrase copy, not the generic length-failure text", () => {
    const html = renderControls("ALLOW", false, { reason: "as above", attemptedSubmit: true });
    // React HTML-escapes apostrophes (&#x27;) in rendered text — assert on
    // apostrophe-free substrings of the UI-SPEC copy rather than the exact
    // literal string.
    expect(html).toContain("stock phrase, not a reason");
    expect(html).toContain("as above");
    expect(html).not.toContain(REASON_COUNTER_FAILURE_TEXT.replace(/'/g, "&#x27;"));
  });

  it("DISPOSITION-CONTROLS: an attempted submit with a too-short, non-stock-phrase reason still renders the generic length-failure text", () => {
    const html = renderControls("ALLOW", false, { reason: "too short", attemptedSubmit: true });
    expect(html).toContain(REASON_COUNTER_FAILURE_TEXT.replace(/'/g, "&#x27;"));
  });
});
