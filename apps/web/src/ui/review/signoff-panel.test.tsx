// apps/web/src/ui/review/signoff-panel.test.tsx
//
// Colocated, renderToStaticMarkup — the pure *View component only.
// Tagged SIGNOFF.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MatterFlag } from "@dsar/schemas/primitives";
import { SignOffPanelView, SIGN_OFF_BLOCKING_REASON, SIGN_OFF_CTA } from "./signoff-panel.tsx";
import type { ReviewTallies } from "../../domain/review-tallies.ts";

const TALLIES: ReviewTallies = {
  accepted: 2,
  reduced: 1,
  struck: 1,
  lawyerAllowed: 1,
  lawyerAllowedAmount: 4500 as never,
};

const LITIGATION_FLAG: MatterFlag = {
  id: "LITIGATION_POSTURE",
  code: "LITIGATION_POSTURE",
  message: "This requestor is in a known dispute with the company.",
  requiresAcknowledgement: true,
};

const ATTESTATION_TEXT =
  "I am reviewing this fee assessment as a qualified lawyer for Singapore. Rule pack SG-PDPA 2026.09.1, reviewed not yet recorded.";

function renderPanel(overrides: Partial<Parameters<typeof SignOffPanelView>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(SignOffPanelView, {
      tallies: TALLIES,
      finalAmount: 26640 as never,
      currency: "SGD",
      flagsRequiringAck: [LITIGATION_FLAG],
      acknowledged: new Set<string>(),
      onToggleAck: () => {},
      attestationText: ATTESTATION_TEXT,
      reviewedOnNotRecorded: true,
      lawyerName: "Marcus Tan — Legal, Singapore",
      qualification: "",
      onQualificationChange: () => {},
      error: null,
      pending: false,
      onSubmit: () => {},
      ...overrides,
    })
  );
}

describe("SIGNOFF", () => {
  it("SIGNOFF: renders the four decision counts and the final figure from the tallies", () => {
    const html = renderPanel();

    expect(html).toContain('data-testid="signoff-accepted"');
    expect(html).toContain(">2<");
    expect(html).toContain(">1<");
    // Never assert a currency-symbol prefix ("SGD"/"$") — Intl's
    // currencyDisplay output is environment-dependent (packages/schemas's
    // own money.test.ts only ever asserts the numeric substring).
    expect(html).toContain("266.40");
  });

  it("SIGNOFF: the panel renders disabled with its blocking reason while any acknowledgement is unchecked", () => {
    const html = renderPanel({ acknowledged: new Set() });

    expect(html).toMatch(/data-testid="signoff-submit"[^>]*disabled/);
    expect(html).toContain(SIGN_OFF_BLOCKING_REASON);
  });

  it("SIGNOFF: the panel enables once every acknowledgement is checked", () => {
    const html = renderPanel({ acknowledged: new Set(["LITIGATION_POSTURE"]) });

    expect(html).not.toMatch(/data-testid="signoff-submit"[^>]*disabled/);
    expect(html).not.toContain(SIGN_OFF_BLOCKING_REASON);
    expect(html).toContain(SIGN_OFF_CTA);
  });

  it("SIGNOFF: renders the attestation text in full plus the not-recorded review-date note", () => {
    const html = renderPanel();

    expect(html).toContain(ATTESTATION_TEXT);
    expect(html).toContain('data-testid="signoff-reviewed-on-note"');
  });

  it("SIGNOFF: on failure renders the sign-off failure string inline without a navigation", () => {
    const html = renderPanel({ error: "qualification is required" });

    expect(html).toContain("Sign-off failed — qualification is required");
    expect(html).toContain("still in Legal Review");
  });
});
