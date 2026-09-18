// apps/web/src/ui/capability/capability-statement.test.tsx
//
// Rendered with renderToStaticMarkup for the markup assertions (the same
// technique apps/web/src/ui/chrome/status-strip.test.tsx already uses in
// this repo); the exported confirmation predicate is called directly for
// the three enabling-rule cases. Every test name is tagged CAPABILITY.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilityStatement, isConfirmationPhraseConfirmed } from "./capability-statement.tsx";

function renderStatement(): string {
  return renderToStaticMarkup(
    React.createElement(CapabilityStatement, { children: React.createElement("main", null, "gated content") })
  );
}

describe("CAPABILITY: CapabilityStatement markup", () => {
  it("CAPABILITY: renders exactly six bullets, each with its bolded lead phrase intact", () => {
    const html = renderStatement();

    const bulletCount = (html.match(/<li/g) ?? []).length;
    expect(bulletCount).toBe(6);

    expect(html).toContain("<b>not know the law</b>");
    expect(html).toContain("<b>not decide anything</b>");
    expect(html).toContain("<b>cannot see your matter</b>");
    expect(html).toContain("<b>refuse to decide</b>");
    expect(html).toContain("No AI language model drafts any part of this build");
  });

  it("CAPABILITY: renders the sixth bullet's no-persistent-data sentence verbatim, in the same list-item structure", () => {
    const html = renderStatement();

    expect(html).toContain("<b>holds no persistent data</b>");
    expect(html).toContain(
      "Matters and assessments exist only in this server process&#x27;s memory and are lost on restart or code change."
    );
  });

  it("CAPABILITY: renders the closing why-layered paragraph explaining why a one-time click-through is not the only disclosure", () => {
    const html = renderStatement();

    expect(html).toContain(
      "A one-time click-through is read once and never again, so it is not the only disclosure."
    );
  });
});

describe("CAPABILITY: isConfirmationPhraseConfirmed", () => {
  it("CAPABILITY: the continue control is disabled when the input is empty", () => {
    expect(isConfirmationPhraseConfirmed("")).toBe(false);
  });

  it("CAPABILITY: the continue control is enabled when the input holds the confirmation phrase, case- and whitespace-insensitively", () => {
    expect(isConfirmationPhraseConfirmed("  I UNDERSTAND  ")).toBe(true);
  });

  it("CAPABILITY: the continue control is disabled when the input holds any other text", () => {
    expect(isConfirmationPhraseConfirmed("i agree")).toBe(false);
  });
});
