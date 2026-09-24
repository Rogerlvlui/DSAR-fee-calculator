import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttestationsPanel, type AttestationsValue } from "./attestations-panel.tsx";

const value: AttestationsValue = {
  identityVerified: false,
  scopeClarified: false,
  isKnownDisputeOrLitigation: false,
};

describe("ATTESTATIONS: AttestationsPanel", () => {
  it("associates each checkbox with its visible statement and help text", () => {
    const html = renderToStaticMarkup(React.createElement(AttestationsPanel, { value, onChange: () => {} }));
    const names = ["identityVerified", "scopeClarified", "isKnownDisputeOrLitigation"];
    for (const name of names) {
      expect(html).toMatch(new RegExp(`<label class="attestation-item"><input[^>]*name="${name}"[^>]*><span><strong>[^<]{20,}`));
    }
    expect(html).not.toContain('name="identityVerifiedNote"');
  });
});
