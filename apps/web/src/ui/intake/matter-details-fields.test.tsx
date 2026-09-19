// apps/web/src/ui/intake/matter-details-fields.test.tsx
//
// First dedicated test file for this component. Rendered with
// renderToStaticMarkup, tagged MATTER-DETAILS.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MatterDetailsFields,
  canOfferExpenseEntry,
  type MatterDetailsJurisdictionPack,
  type MatterDetailsValue,
} from "./matter-details-fields.tsx";

function value(overrides: Partial<MatterDetailsValue> = {}): MatterDetailsValue {
  return {
    reference: "DSAR-2026-0001",
    jurisdictionCode: "SG",
    legalEntity: "Acme Pte Ltd",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: "2026-08-20",
    requestorClass: "FORMER_EMPLOYEE",
    ...overrides,
  };
}

function pack(overrides: Partial<MatterDetailsJurisdictionPack> = {}): MatterDetailsJurisdictionPack {
  return {
    jurisdictionCode: "SG",
    jurisdictionName: "Singapore",
    packId: "SG-PDPA",
    version: "2026.09.1",
    displayStatus: "DRAFT",
    daysUntilReviewDue: 400,
    feePosture: { PRIVATE_ORGANISATION: "PERMITTED_REASONABLE", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    ...overrides,
  };
}

function renderFields(overrides: Partial<MatterDetailsJurisdictionPack> = {}, valueOverrides: Partial<MatterDetailsValue> = {}): string {
  return renderToStaticMarkup(
    React.createElement(MatterDetailsFields, {
      value: value(valueOverrides),
      onChange: () => {},
      currency: "SGD",
      jurisdictionPack: pack(overrides),
    })
  );
}

describe("MATTER-DETAILS: jurisdiction pack status readout", () => {
  it("MATTER-DETAILS: renders 'Active' inline the moment a jurisdictionPack prop with displayStatus ACTIVE is supplied", () => {
    const html = renderFields({ displayStatus: "ACTIVE" });
    expect(html).toContain('data-testid="jurisdiction-pack-status"');
    expect(html).toContain(">Active<");
  });

  it("MATTER-DETAILS: renders the due-soon variant's copy naming the day count for ACTIVE_REVIEW_DUE_SOON", () => {
    const html = renderFields({ displayStatus: "ACTIVE_REVIEW_DUE_SOON", daysUntilReviewDue: 12 });
    expect(html).toContain("Active — review due in 12 days");
  });

  it("MATTER-DETAILS: renders the stale variant's copy for STALE", () => {
    const html = renderFields({ displayStatus: "STALE" });
    expect(html).toContain("Stale — past its review date. New matters in this jurisdiction cannot be submitted.");
  });

  it("MATTER-DETAILS: renders 'Draft — not yet authored for this jurisdiction' for DRAFT", () => {
    const html = renderFields({ displayStatus: "DRAFT" });
    expect(html).toContain("Draft — not yet authored for this jurisdiction");
  });

  it("MATTER-DETAILS: renders 'No usable rule pack — contact Legal' for NO_USABLE_PACK, replacing the heads-up posture warning rather than rendering alongside it", () => {
    const html = renderFields({
      displayStatus: "NO_USABLE_PACK",
      packId: null,
      version: null,
      feePosture: null,
      daysUntilReviewDue: null,
    });
    expect(html).toContain('data-testid="no-usable-pack-notice"');
    expect(html).toContain("No usable rule pack — contact Legal");
    expect(html).not.toContain('data-testid="heads-up-warning"');
  });

  it("MATTER-DETAILS: switching to a jurisdiction whose posture is heads-up-eligible renders the heads-up warning, not the no-usable-pack notice", () => {
    const html = renderFields({
      displayStatus: "DRAFT",
      feePosture: { PRIVATE_ORGANISATION: "NO_EXPRESS_AUTHORITY", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    });
    expect(html).toContain('data-testid="heads-up-warning"');
    expect(html).not.toContain('data-testid="no-usable-pack-notice"');
  });
});

describe("MATTER-DETAILS: canOfferExpenseEntry", () => {
  it("MATTER-DETAILS: false when displayStatus is NO_USABLE_PACK", () => {
    expect(canOfferExpenseEntry(pack({ displayStatus: "NO_USABLE_PACK", feePosture: null }), "PRIVATE_ORGANISATION")).toBe(
      false
    );
  });

  it("MATTER-DETAILS: false when the resolved posture is a heads-up posture", () => {
    const headsUpPack = pack({
      feePosture: { PRIVATE_ORGANISATION: "PROHIBITED", PUBLIC_AGENCY: "PROHIBITED" },
    });
    expect(canOfferExpenseEntry(headsUpPack, "PRIVATE_ORGANISATION")).toBe(false);
  });

  it("MATTER-DETAILS: true for a usable pack with a permitted posture", () => {
    expect(canOfferExpenseEntry(pack(), "PRIVATE_ORGANISATION")).toBe(true);
  });

  // 05-REVIEW-ADDENDUM.md WR-01: canOfferExpenseEntry previously fell
  // through to `true` for a STALE pack even though
  // jurisdictionStatusLabel() renders "New matters in this jurisdiction
  // cannot be submitted" for that exact state — currently latent (no
  // committed pack is ever STALE yet), proven directly here with a
  // hand-built STALE fixture rather than waiting on a real stale pack.
  it("MATTER-DETAILS: false when displayStatus is STALE, even with an otherwise permitted posture (WR-01)", () => {
    expect(canOfferExpenseEntry(pack({ displayStatus: "STALE" }), "PRIVATE_ORGANISATION")).toBe(false);
  });
});
