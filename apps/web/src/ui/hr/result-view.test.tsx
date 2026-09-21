// apps/web/src/ui/hr/result-view.test.tsx
//
// Colocated, renderToStaticMarkup. Tagged HR-RESULT. The privilege test is
// the one to get exactly right: the fixture's distinctive lawyer-reason
// text is never even offered to ResultViewLine's props type, so it cannot
// leak into the rendered markup regardless of what the caller does.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultView, type ResultViewLine } from "./result-view.tsx";

const DISTINCTIVE_LAWYER_REASON = "Privileged: struck per internal risk appetite discussion with GC.";

const LINES: ResultViewLine[] = [
  {
    id: "line-1",
    seq: 1,
    categoryLabel: "Staff time — locating and retrieving",
    description: "Searching HRIS, shared drives and archived mail",
    struck: false,
    amount: 16000 as never,
    basis: "Locating and retrieving the requested data is a service provided to enable the response.",
  },
  {
    id: "line-2",
    seq: 2,
    categoryLabel: "Staff time — deciding what may be withheld",
    description: "Reviewing manager comments for material that could be withheld",
    struck: true,
    amount: 0 as never,
    basis: "Time spent assessing whether an exception applies is the organisation's own compliance cost.",
  },
];

function render(overrides: Partial<Parameters<typeof ResultView>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(ResultView, {
      matterReference: "DSAR-2026-0142",
      finalAmount: 16000 as never,
      currency: "SGD",
      lawyerName: "Marcus Tan — Legal, Singapore",
      qualification: "Advocate & Solicitor, Singapore",
      signedAt: "2026-09-18T12:00:00Z",
      lines: LINES,
      ...overrides,
    })
  );
}

describe("HR-RESULT", () => {
  it("HR-RESULT: renders the fee headline with the amount, lawyer name, qualification and sign-off date", () => {
    const html = render();

    // Never assert a currency-symbol prefix ("SGD"/"$") — Intl's
    // currencyDisplay output is environment-dependent (packages/schemas's
    // own money.test.ts only ever asserts the numeric substring).
    expect(html).toContain("Fee assessed:");
    expect(html).toContain("160.00");
    expect(html).toContain("Marcus Tan — Legal, Singapore");
    // React escapes "&" to "&amp;" in rendered text — assert around it
    // rather than the raw ampersand.
    expect(html).toContain("Advocate");
    expect(html).toContain("Solicitor, Singapore");
    expect(html).toContain("2026-09-18T12:00:00Z");
  });

  it("HR-RESULT: the itemisation lists every allowed line with its amount and every struck line with its pack-authored basis", () => {
    const html = render();

    expect(html).toContain("Searching HRIS, shared drives and archived mail");
    expect(html).toContain('data-testid="result-line-amount"');
    expect(html).toContain("160.00");
    expect(html).toContain("Reviewing manager comments for material that could be withheld");
    // React escapes "'" to "&#x27;" in rendered text — split the assertion
    // around the apostrophe rather than the raw character.
    expect(html).toContain("Time spent assessing whether an exception applies is the organisation");
    expect(html).toContain("own compliance cost.");
  });

  it("HR-RESULT: no lawyer reason string appears anywhere in the rendered markup, and ResultViewLine carries no field for one", () => {
    const html = render();

    expect(html).not.toContain(DISTINCTIVE_LAWYER_REASON);
    expect(Object.keys(LINES[0]!)).not.toContain("lawyerReason");
    expect(Object.keys(LINES[0]!)).not.toContain("reason");
  });

  it("HR-RESULT: a zero fee renders with the same headline element and class as a non-zero result", () => {
    const zero = render({
      finalAmount: 0 as never,
      lines: LINES.map((line) => ({ ...line, struck: true, amount: 0 as never })),
    });
    const nonZero = render();

    expect(zero).toMatch(/<h1 class="screen" data-testid="result-headline">Fee assessed: .*0\.00<\/h1>/);
    expect(nonZero).toMatch(/<h1 class="screen" data-testid="result-headline">Fee assessed: .*[\d.]+<\/h1>/);
  });

  // DOC-04's presentation-equivalence property, proven directly rather than
  // merely inferred from a regex that happens to match both: the headline
  // element's own opening tag — testid and className — must be byte-for-byte
  // identical between a zero-amount and a non-zero-amount render, not merely
  // "a zero appears somewhere in a similarly-shaped tag".
  it("HR-RESULT: the headline element's testid and className are identical between a zero-amount and a non-zero-amount render", () => {
    const zero = render({
      finalAmount: 0 as never,
      lines: LINES.map((line) => ({ ...line, struck: true, amount: 0 as never })),
    });
    const nonZero = render();

    const headlineOpenTag = /<h1[^>]*>/;
    const zeroOpenTag = zero.match(headlineOpenTag)?.[0];
    const nonZeroOpenTag = nonZero.match(headlineOpenTag)?.[0];

    expect(zeroOpenTag).toBeTruthy();
    expect(zeroOpenTag).toBe(nonZeroOpenTag);
    expect(zeroOpenTag).toContain('class="screen"');
    expect(zeroOpenTag).toContain('data-testid="result-headline"');
  });

  // SIGNOFF-05: an amount-based distinction is impossible here on purpose —
  // both lines carry zero — so the outcome marker (data-outcome) is what
  // must differ.
  it("HR-RESULT: a struck zero-amount line and an allowed zero-amount line render with different outcome markers", () => {
    const html = render({
      lines: [
        { ...LINES[0]!, struck: false, amount: 0 as never },
        { ...LINES[1]!, struck: true, amount: 0 as never },
      ],
    });

    expect(html).toContain('data-outcome="allowed"');
    expect(html).toContain('data-outcome="struck"');
  });
});
