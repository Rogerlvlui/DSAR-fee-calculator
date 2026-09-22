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
});
