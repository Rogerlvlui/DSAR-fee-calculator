// apps/web/app/globals.css.test.ts
//
// Colocated with the stylesheet it tests. Runs under the "web" vitest
// project (jsdom environment — see vitest.config.ts), which gives this
// file a real `document`/CSS-selector engine (jsdom's own, the same one
// `querySelector`/`querySelectorAll` run through in a browser) with no need
// to import the `jsdom` package directly — that package ships no bundled
// type declarations and importing it would need its own new-dependency
// legitimacy checkpoint (see line-card.test.tsx's header note on the same
// point for @testing-library). Tagged GLOBALS-CSS.
//
// Regression-guards 260922-jr4-REVIEW.md's Critical findings, proven
// against the real selector engine / a real PostCSS compile rather than a
// string match on the source, so a future edit that reintroduces a bug
// (even via different syntax) fails here.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";

const GLOBALS_CSS_PATH = path.resolve(fileURLToPath(import.meta.url), "../globals.css");

describe("GLOBALS-CSS", () => {
  it("GLOBALS-CSS CR-01: the confirmed-tint selector matches only decided line cards, never a still-PENDING one", () => {
    const raw = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const ruleMatch = /article\.card\[data-disposition[^{]*\{/.exec(raw);
    expect(ruleMatch).not.toBeNull();
    const selector = ruleMatch![0].replace(/\s*\{$/, "").trim();

    document.body.innerHTML = [
      '<article class="card" data-disposition="PENDING"></article>',
      '<article class="card" data-disposition="ACCEPTED"></article>',
      '<article class="card" data-disposition="REDUCED"></article>',
      '<article class="card" data-disposition="STRUCK"></article>',
      '<article class="card" data-disposition="ALLOWED_BY_LAWYER"></article>',
    ].join("\n");

    const matchedDispositions = Array.from(document.querySelectorAll(selector)).map((el) =>
      el.getAttribute("data-disposition")
    );

    expect(matchedDispositions).not.toContain("PENDING");
    expect(matchedDispositions.sort()).toEqual(["ACCEPTED", "ALLOWED_BY_LAWYER", "REDUCED", "STRUCK"].sort());
  });

  it("GLOBALS-CSS CR-02: a rule exists for .summary-row[data-indent] and applies a non-zero spacing-token indent", async () => {
    const source = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const result = await postcss([tailwindPostcss()]).process(source, {
      from: GLOBALS_CSS_PATH,
    });
    const css = result.css;

    const ruleMatch = /\.summary-row\[data-indent="true"\]\s*\{[^}]*\}/.exec(css);
    expect(ruleMatch).not.toBeNull();
    expect(ruleMatch![0]).toMatch(/padding-inline-start:\s*var\(--spacing-\w+\)/);

    document.body.innerHTML = [
      '<div class="summary-row" data-indent="true"></div>',
      '<div class="summary-row"></div>',
    ].join("\n");
    const indented = document.querySelectorAll('.summary-row[data-indent="true"]');
    expect(indented.length).toBe(1);
  });

  // 07.1-01 Task 1 / UI-SPEC Color's verdict-colour correction: the everyday
  // DISALLOW pill must resolve to Deny (grey, #565f6c), never Destructive/Stop
  // (red, #a32020) — anchored on the literal resolved hex so a future
  // accidental revert (even one that renames a token rather than reverting
  // the selector) fails loudly here. The compiled @theme block declares
  // each --color-* custom property's literal hex (see CSS-PIPELINE's own
  // "(a)" case for the same pattern); this test resolves the pill rule's
  // `color: var(--color-*)` reference against that declared value directly,
  // rather than string-matching the rule text for a hex Tailwind's compiler
  // never inlines into a hand-authored declaration.
  it("GLOBALS-CSS CR-03: the DISALLOW pill rule resolves to the Deny hex, not the Stop hex", async () => {
    const source = readFileSync(GLOBALS_CSS_PATH, "utf-8");
    const result = await postcss([tailwindPostcss()]).process(source, {
      from: GLOBALS_CSS_PATH,
    });
    const css = result.css;

    const tokenValues = new Map<string, string>();
    for (const match of css.matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
      tokenValues.set(match[1]!, match[2]!.toLowerCase());
    }
    expect(tokenValues.get("--color-deny")).toBe("#565f6c");
    expect(tokenValues.get("--color-stop")).toBe("#a32020");

    const ruleMatch = /article\[data-verdict="DISALLOW"\]\s*\.pill\s*\{[^}]*\}/.exec(css);
    expect(ruleMatch).not.toBeNull();
    const rule = ruleMatch![0];

    const colorDeclMatch = /(?<!background-)color:\s*var\((--color-[\w-]+)\)/.exec(rule);
    expect(colorDeclMatch).not.toBeNull();
    const referencedToken = colorDeclMatch![1]!;

    expect(tokenValues.get(referencedToken)).toBe("#565f6c");
    expect(tokenValues.get(referencedToken)).not.toBe("#a32020");
  });
});
