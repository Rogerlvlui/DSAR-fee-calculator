// apps/web/src/domain/notice-draft.test.tsx
//
// Colocated under the "web" vitest project — the ".tsx" extension is
// required for vitest.config.ts's "web" project glob to pick this file up
// at all (that project's include is "apps/web/**/*.test.tsx"; "routes" only
// matches "tests/routes/**/*.test.ts"), even though nothing here renders
// JSX. Tagged HR-RESULT, matching this task's other component tests.

import { describe, expect, it } from "vitest";
import {
  buildNoticeDraft,
  NOTICE_NOT_YET_AUTHORED_STATEMENT,
  type NoticeDraftAllowedLine,
} from "./notice-draft.ts";

const CURRENCY = "SGD" as const;
const ALLOWED_LINES: NoticeDraftAllowedLine[] = [
  { description: "Staff time locating and retrieving records", amount: 16000 as never },
  { description: "Photocopying the response pack", amount: 2640 as never },
];

describe("HR-RESULT", () => {
  it("HR-RESULT: buildNoticeDraft renders an authored template verbatim", () => {
    const draft = buildNoticeDraft({
      template: "Dear Sir/Madam, this is our estimate of the fee for your request.",
      amount: 18640 as never,
      currency: CURRENCY,
      allowedLines: ALLOWED_LINES,
      matterReference: "DSAR-2026-0142",
    });

    expect(draft).toContain("Dear Sir/Madam, this is our estimate of the fee for your request.");
    expect(draft).not.toContain("Counsel has not yet authored");
  });

  it("HR-RESULT: buildNoticeDraft renders the not-yet-authored statement instead of inventing a letter when the template carries the UNAUTHORED marker", () => {
    const draft = buildNoticeDraft({
      template: "UNAUTHORED — counsel must author the requestor-facing fee notice for this jurisdiction before this pack can reach ACTIVE.",
      amount: 0 as never,
      currency: CURRENCY,
      allowedLines: [],
      matterReference: "DSAR-2026-0142",
    });

    expect(draft).toContain(NOTICE_NOT_YET_AUTHORED_STATEMENT);
    expect(draft).not.toContain("UNAUTHORED");
  });

  it("HR-RESULT: buildNoticeDraft renders the amount and an itemisation of every allowed line", () => {
    const draft = buildNoticeDraft({
      template: "Sample authored wording.",
      amount: 18640 as never,
      currency: CURRENCY,
      allowedLines: ALLOWED_LINES,
      matterReference: "DSAR-2026-0142",
    });

    // Never assert a currency-symbol prefix ("SGD"/"$") — Intl's
    // currencyDisplay output is environment-dependent (packages/schemas's
    // own money.test.ts only ever asserts the numeric substring).
    expect(draft).toContain("186.40");
    expect(draft).toContain("Staff time locating and retrieving records");
    expect(draft).toContain("160.00");
    expect(draft).toContain("Photocopying the response pack");
    expect(draft).toContain("26.40");
  });

  it("HR-RESULT: buildNoticeDraft states plainly that no fee is charged when there are no allowed lines", () => {
    const draft = buildNoticeDraft({
      template: "Sample authored wording.",
      amount: 0 as never,
      currency: CURRENCY,
      allowedLines: [],
      matterReference: "DSAR-2026-0142",
    });

    expect(draft).toContain("no fee is charged");
  });

  it("HR-RESULT: buildNoticeDraft carries no rule identifier, citation or tooling reference", () => {
    const draft = buildNoticeDraft({
      template: "Sample authored wording.",
      amount: 18640 as never,
      currency: CURRENCY,
      allowedLines: ALLOWED_LINES,
      matterReference: "DSAR-2026-0142",
    });

    expect(draft).not.toMatch(/SG-PDPA\./);
    expect(draft).not.toMatch(/PDPA 2012|Personal Data Protection Regulations/);
    expect(draft).not.toMatch(/engine|LLM|AI-drafted/i);
  });
});
