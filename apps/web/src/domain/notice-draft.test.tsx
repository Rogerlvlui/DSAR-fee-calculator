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
  findAc17Violations,
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

  // DOC-03/AC-17 — the actual regex assertion, over every reachable notice
  // variant. Each case is named separately rather than looped over one
  // fixture, per the plan's own acceptance criteria.
  describe("HR-RESULT: findAc17Violations — every reachable notice variant is clean", () => {
    it("HR-RESULT: an authored-template notice carries zero AC-17 violations", () => {
      const draft = buildNoticeDraft({
        template: "This notice explains the fee for responding to your data access request.",
        amount: 18640 as never,
        currency: CURRENCY,
        allowedLines: ALLOWED_LINES,
        matterReference: "DSAR-2026-0142",
      });

      expect(findAc17Violations(draft)).toEqual([]);
    });

    it("HR-RESULT: an unauthored-marker-template notice carries zero AC-17 violations", () => {
      const draft = buildNoticeDraft({
        template:
          "UNAUTHORED — counsel must author the requestor-facing fee notice for this jurisdiction before this pack can reach ACTIVE.",
        amount: 18640 as never,
        currency: CURRENCY,
        allowedLines: ALLOWED_LINES,
        matterReference: "DSAR-2026-0142",
      });

      expect(findAc17Violations(draft)).toEqual([]);
    });

    it("HR-RESULT: a zero-allowed-lines notice carries zero AC-17 violations", () => {
      const draft = buildNoticeDraft({
        template: "This notice explains the fee for responding to your data access request.",
        amount: 0 as never,
        currency: CURRENCY,
        allowedLines: [],
        matterReference: "DSAR-2026-0142",
      });

      expect(findAc17Violations(draft)).toEqual([]);
    });
  });

  // A scan that has never been observed catching anything is not evidence
  // of anything (this project's own standing gate-integrity discipline,
  // Phase 2) — proves the scan has teeth before trusting it above.
  it("HR-RESULT: findAc17Violations names all three violation kinds for a deliberately dirty input", () => {
    const dirty =
      "This determination applied rule HK-PDPO.STAFF_TIME_SEARCH under PDPO s.28(2)-(3), " +
      "drafted with the help of our AI assistant.";

    const violations = findAc17Violations(dirty);
    const labels = violations.map((violation) => violation.label);

    expect(labels).toContain("rule-identifier");
    expect(labels).toContain("citation");
    expect(labels).toContain("tool-or-model-mention");
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});
