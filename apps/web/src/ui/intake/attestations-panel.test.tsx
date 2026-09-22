// apps/web/src/ui/intake/attestations-panel.test.tsx
//
// First test file for this component. Rendered with renderToStaticMarkup,
// the same technique every colocated component test in this directory
// already uses. Tagged ATTESTATIONS.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttestationsPanel, IDENTITY_NOTE_WARNING, type AttestationsValue } from "./attestations-panel.tsx";

function value(overrides: Partial<AttestationsValue> = {}): AttestationsValue {
  return {
    identityVerified: false,
    identityVerifiedNote: "",
    scopeClarified: false,
    isKnownDisputeOrLitigation: false,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<AttestationsValue> = {}, noteMaxLength = 200): string {
  return renderToStaticMarkup(
    React.createElement(AttestationsPanel, {
      value: value(overrides),
      onChange: () => {},
      noteMaxLength,
    })
  );
}

describe("ATTESTATIONS: AttestationsPanel", () => {
  it("ATTESTATIONS: renders the three attestation checkboxes", () => {
    const html = renderPanel();
    expect(html).toContain('name="identityVerified"');
    expect(html).toContain('name="scopeClarified"');
    expect(html).toContain('name="isKnownDisputeOrLitigation"');
  });

  it("ATTESTATIONS: renders the existing static IDENTITY_NOTE_WARNING regardless of note contents", () => {
    const html = renderPanel({ identityVerifiedNote: "" });
    expect(html).toContain('data-testid="identity-note-warning"');
    expect(html).toContain("NRIC/FIN or any personal data here");
    // Sanity: the imported constant is the same sentence, modulo the
    // apostrophe React's SSR HTML-escapes as &#x27;.
    expect(IDENTITY_NOTE_WARNING).toContain("NRIC/FIN or any personal data here");
  });

  it("ATTESTATIONS: identityVerifiedNote renders both the existing static warning and the new live warning when the note matches a pattern", () => {
    const html = renderPanel({ identityVerifiedNote: "contact jane.doe@example.com" });
    expect(html).toContain('data-testid="identity-note-warning"');
    expect(html).toContain("NRIC/FIN or any personal data here");
    expect(html).toContain('data-testid="identity-note-pattern-warning"');
    expect(html).toContain("email address");
  });

  it("ATTESTATIONS: no live pattern warning renders when the note does not match any pattern", () => {
    const html = renderPanel({ identityVerifiedNote: "verified via employee badge scan" });
    expect(html).not.toContain('data-testid="identity-note-pattern-warning"');
  });

  it("ATTESTATIONS: the note character counter reads the noteMaxLength prop, not a re-imported constant", () => {
    const html = renderPanel({ identityVerifiedNote: "abcde" }, 200);
    expect(html).toContain("5 / 200 characters");
  });
});
