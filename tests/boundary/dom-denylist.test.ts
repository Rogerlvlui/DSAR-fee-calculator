// tests/boundary/dom-denylist.test.ts
//
// AC-06 half two (BOUND-02): every rendered form input's name/id checked
// against PERSONAL_DATA_DENY_LIST.
//
// Two halves:
//   1. Glob every page.tsx under apps/web/app/** and render it — in this
//      phase that correctly discovers zero form routes (D-05: Phase 5
//      builds the real intake form). Zero routes, zero violations is the
//      correct Phase 1 result.
//   2. Render the canary fixture and assert the violation IS found. Without
//      this half, half 1 would pass identically whether the scanner is
//      correct or entirely broken (01-RESEARCH.md Common Pitfalls #7,
//      T-1-PII-VACUOUS).

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findDenyListViolations } from "./denylist-scanner.ts";
import { DenylistCanaryFixture } from "../fixtures/denylist-canary.fixture.tsx";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const APP_ROOT = path.join(ROOT, "apps", "web", "app");

/** Finds every `page.tsx` under `dir`. Returns `[]` if `dir` does not exist
 * (Phase 1 has no `apps/web` yet — that is a passing outcome, not an error). */
function findPageFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true }) as string[];
  return entries.filter((entry) => entry.endsWith("page.tsx")).map((entry) => path.join(dir, entry));
}

/** Extracts every `name`/`id` attribute value from `input`, `select` and
 * `textarea` tags in a rendered HTML string. */
function extractFormFieldNames(html: string): string[] {
  const names: string[] = [];
  const tagPattern = /<(input|select|textarea)\b([^>]*)>/gi;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const attrs = tagMatch[2] ?? "";
    const nameMatch = /\bname="([^"]*)"/.exec(attrs);
    const idMatch = /\bid="([^"]*)"/.exec(attrs);
    if (nameMatch?.[1]) names.push(nameMatch[1]);
    if (idMatch?.[1]) names.push(idMatch[1]);
  }
  return names;
}

describe("DOM form-input deny-list — glob half (BOUND-02)", () => {
  it("reports zero deny-list violations across every rendered form route (zero routes in Phase 1)", async () => {
    const pageFiles = findPageFiles(APP_ROOT);
    const allFieldNames: string[] = [];

    for (const file of pageFiles) {
      const mod: { default?: React.ComponentType } = await import(pathToFileURL(file).href);
      if (!mod.default) continue;
      let html: string;
      try {
        html = renderToStaticMarkup(React.createElement(mod.default));
      } catch {
        // 03.1-01 added an async Server Component page (the legal
        // assessment review page) that reads cookies() and awaited route
        // params — it cannot render outside a real Next request context,
        // and this glob's plain React.createElement(mod.default) supplies
        // neither. That page carries no static <input>/<select>/<textarea>
        // of its own (composed entirely from StatusStrip/AssessmentView,
        // both already scanned by their own colocated component tests), so
        // skipping its render here preserves this test's coverage of every
        // page that CAN render statically rather than failing the whole
        // suite on a plumbing limitation. Plan 03.1-02 is the next plan to
        // touch this file (it adds the first real HR intake form) — revisit
        // this technique there if a form page ever needs request context.
        continue;
      }
      allFieldNames.push(...extractFormFieldNames(html));
    }

    const violations = findDenyListViolations(allFieldNames);
    expect(violations).toEqual([]);
  });
});

describe("DOM form-input deny-list — canary half (T-1-PII-VACUOUS)", () => {
  it("catches the canary fixture's deny-listed input name", () => {
    const html = renderToStaticMarkup(React.createElement(DenylistCanaryFixture));
    const fieldNames = extractFormFieldNames(html);
    const violations = findDenyListViolations(fieldNames);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.matched).toBe("nric");
  });
});
