// apps/web/src/ui/intake/intake-form.test.tsx
//
// Colocated, rendered with renderToStaticMarkup, tagged INTAKE-FORM.
// State-driven behaviour is tested by rendering each sub-component with
// the corresponding props, not by simulating typing — the same approach
// expense-line-repeater.test.tsx uses. computeIntakeDisabledReason is
// tested directly, matching capability-statement.test.tsx's precedent for
// exported pure predicates.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MatterDetailsFields, headsUpMessage, type MatterDetailsValue } from "./matter-details-fields.tsx";
import { AttestationsPanel, IDENTITY_NOTE_WARNING, type AttestationsValue } from "./attestations-panel.tsx";
import { ClaimFooter, CLAIM_NOT_FEE_SENTENCE } from "./claim-footer.tsx";
import { computeIntakeDisabledReason } from "./intake-form.tsx";

const MATTER_DETAILS: MatterDetailsValue = {
  reference: "DSAR-2026-0001",
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-08-20",
  requestorClass: "FORMER_EMPLOYEE",
};

describe("INTAKE-FORM: heads-up posture warning", () => {
  it("INTAKE-FORM: a fee posture recording no express authority renders the heads-up warning verbatim", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatterDetailsFields, {
        value: MATTER_DETAILS,
        onChange: () => {},
        currency: "SGD",
        feePosture: "NO_EXPRESS_AUTHORITY",
      })
    );

    expect(html).toContain(headsUpMessage("Singapore"));
  });

  it("INTAKE-FORM: a permitted-reasonable posture renders no warning", () => {
    const html = renderToStaticMarkup(
      React.createElement(MatterDetailsFields, {
        value: MATTER_DETAILS,
        onChange: () => {},
        currency: "SGD",
        feePosture: "PERMITTED_REASONABLE",
      })
    );

    expect(html).not.toContain('data-testid="heads-up-warning"');
  });
});

describe("INTAKE-FORM: attestations panel", () => {
  const VALUE: AttestationsValue = {
    identityVerified: false,
    identityVerifiedNote: "",
    scopeClarified: false,
    isKnownDisputeOrLitigation: false,
  };

  it("INTAKE-FORM: renders the do-not-enter-personal-data warning under the identity note field, and the note field's maximum length equals the frozen limit", () => {
    const html = renderToStaticMarkup(
      React.createElement(AttestationsPanel, { value: VALUE, onChange: () => {}, noteMaxLength: 200 })
    );

    // React escapes the apostrophe in IDENTITY_NOTE_WARNING's "requestor's"
    // to the numeric entity when rendering a text node — compare against
    // the same escaping renderToStaticMarkup produces.
    const escapedWarning = IDENTITY_NOTE_WARNING.replace(/'/g, "&#x27;");
    expect(html).toContain(escapedWarning);
    expect(html).toContain('maxLength="200"');
  });
});

describe("INTAKE-FORM: claim footer", () => {
  it("INTAKE-FORM: renders the claim-not-the-fee sentence verbatim alongside the running total", () => {
    const html = renderToStaticMarkup(
      React.createElement(ClaimFooter, {
        claimedTotalMinor: 88800,
        currency: "SGD",
        disabledReason: null,
        submitting: false,
        onSubmit: () => {},
      })
    );

    const claimNotFeeBlock = html.match(/data-testid="claim-not-fee">(.*?)<\/div>/s)?.[1] ?? "";
    const plainText = claimNotFeeBlock
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .replace(/&#x27;/g, "'")
      .trim();
    expect(plainText).toBe(CLAIM_NOT_FEE_SENTENCE);
    expect(html).toContain("$888.00");
  });
});

describe("INTAKE-FORM: computeIntakeDisabledReason", () => {
  it("INTAKE-FORM: names incomplete matter details as the specific unmet condition", () => {
    expect(
      computeIntakeDisabledReason({
        matterDetailsValid: false,
        identityVerified: true,
        scopeClarified: true,
        lines: [],
      })
    ).toBe("Complete the required matter details above.");
  });

  it("INTAKE-FORM: names the unaddressed identity attestation as the specific unmet condition", () => {
    expect(
      computeIntakeDisabledReason({
        matterDetailsValid: true,
        identityVerified: false,
        scopeClarified: true,
        lines: [],
      })
    ).toBe("Confirm the requestor's identity has been verified.");
  });

  it("INTAKE-FORM: names having no cost lines as the specific unmet condition", () => {
    expect(
      computeIntakeDisabledReason({
        matterDetailsValid: true,
        identityVerified: true,
        scopeClarified: true,
        lines: [],
      })
    ).toBe("Add at least one cost line.");
  });

  it("INTAKE-FORM: names an invalid line as the specific unmet condition", () => {
    expect(
      computeIntakeDisabledReason({
        matterDetailsValid: true,
        identityVerified: true,
        scopeClarified: true,
        lines: [{ categoryCode: "STAFF_TIME_SEARCH", description: "", quantity: 4, rateMajor: "40.00" }],
      })
    ).toBe("Fix the highlighted cost line before submitting.");
  });

  it("INTAKE-FORM: returns null once every condition is met", () => {
    expect(
      computeIntakeDisabledReason({
        matterDetailsValid: true,
        identityVerified: true,
        scopeClarified: true,
        lines: [{ categoryCode: "STAFF_TIME_SEARCH", description: "Search", quantity: 4, rateMajor: "40.00" }],
      })
    ).toBeNull();
  });
});
