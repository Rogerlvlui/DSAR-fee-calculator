// apps/web/src/ui/review/flat-fee-choice.test.tsx
//
// Colocated, renderToStaticMarkup — renders FlatFeeChoiceView directly (the
// pure half), matching disposition-controls.test.tsx's own precedent for a
// component whose stateful sibling calls useRouter(). Tagged FLAT-FEE-CHOICE.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FlatFeeComparison } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";
import { FlatFeeChoiceView } from "./flat-fee-choice.tsx";

const CURRENCY = "HKD" as const;

const COMPARISON_NOT_EXCEEDING: FlatFeeComparison = {
  flatFeeAmount: 10000 as Minor,
  itemisedDirectCostAmount: 20000 as Minor,
  flatFeeExceedsItemisedCost: false,
};

const COMPARISON_EXCEEDING: FlatFeeComparison = {
  flatFeeAmount: 10000 as Minor,
  itemisedDirectCostAmount: 1000 as Minor,
  flatFeeExceedsItemisedCost: true,
};

function renderChoice(props: {
  flatFeeComparison: FlatFeeComparison | null;
  flatFeeVerificationStatus?: "VERIFIED" | "NEEDS_VERIFICATION" | null;
  selected?: "ITEMISED" | "FLAT" | null;
  pending?: boolean;
  error?: string | null;
}): string {
  return renderToStaticMarkup(
    React.createElement(FlatFeeChoiceView, {
      flatFeeComparison: props.flatFeeComparison,
      flatFeeVerificationStatus: props.flatFeeVerificationStatus ?? null,
      currency: CURRENCY,
      selected: props.selected ?? null,
      pending: props.pending ?? false,
      error: props.error ?? null,
      onSelect: () => {},
      onSubmit: () => {},
    })
  );
}

describe("FLAT-FEE-CHOICE", () => {
  it("FLAT-FEE-CHOICE: renders nothing when flatFeeComparison is null", () => {
    const html = renderChoice({ flatFeeComparison: null });
    expect(html).toBe("");
  });

  it("FLAT-FEE-CHOICE: renders both radios with their interpolated amounts when present", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_NOT_EXCEEDING });
    expect(html).toContain("How should this fee be charged?");
    expect(html).toContain("HK$200.00");
    expect(html).toContain("HK$100.00");
  });

  it("FLAT-FEE-CHOICE: the flat radio is disabled and the blocked note renders when flatFeeExceedsItemisedCost is true", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_EXCEEDING });
    expect(html).toMatch(/data-testid="flat-fee-radio-flat"[^>]*disabled/);
    expect(html).toContain("Blocked");
    expect(html).toContain("exceeds itemised direct cost");
  });

  it("FLAT-FEE-CHOICE: neither radio is disabled when flatFeeExceedsItemisedCost is false", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_NOT_EXCEEDING });
    expect(html).not.toMatch(/data-testid="flat-fee-radio-flat"[^>]*disabled/);
    expect(html).not.toMatch(/data-testid="flat-fee-radio-itemised"[^>]*disabled/);
    expect(html).not.toContain("Blocked");
  });

  it("FLAT-FEE-CHOICE: the unverified marker renders beside the flat option when flatFeeVerificationStatus is NEEDS_VERIFICATION", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_NOT_EXCEEDING, flatFeeVerificationStatus: "NEEDS_VERIFICATION" });
    expect(html).toContain("unverified rule");
  });

  it("FLAT-FEE-CHOICE: the unverified marker and the blocked note coexist when both are true simultaneously — neither replaces the other", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_EXCEEDING, flatFeeVerificationStatus: "NEEDS_VERIFICATION" });
    expect(html).toContain("unverified rule");
    expect(html).toContain("Blocked");
    expect(html).toMatch(/data-testid="flat-fee-radio-flat"[^>]*disabled/);
  });

  it("FLAT-FEE-CHOICE: does not render the unverified marker when flatFeeVerificationStatus is VERIFIED", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_NOT_EXCEEDING, flatFeeVerificationStatus: "VERIFIED" });
    expect(html).not.toContain("unverified rule");
  });

  it("FLAT-FEE-CHOICE: renders the submit-failure copy inline when an error is present", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_NOT_EXCEEDING, error: "network error" });
    expect(html).toContain("wasn");
    expect(html).toContain("network error");
    expect(html).toContain("previous choice");
  });

  it("FLAT-FEE-CHOICE: both radios render disabled while pending", () => {
    const html = renderChoice({ flatFeeComparison: COMPARISON_NOT_EXCEEDING, pending: true });
    expect(html).toMatch(/data-testid="flat-fee-radio-itemised"[^>]*disabled/);
  });
});
