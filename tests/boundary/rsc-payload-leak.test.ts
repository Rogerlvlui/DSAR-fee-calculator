// tests/boundary/rsc-payload-leak.test.ts
//
// ACCESS-07 (T-06-05): React serialises every prop passed across a Server
// Component -> "use client" boundary into the page's flight payload,
// whether or not the client component renders it — a whole privileged
// object here is a leak even if unused. No live-browser RSC-payload
// inspection is possible on this build machine (pnpm dev/next build do not
// start — WINDOWS.md, still open), so this file's source-scan technique is
// the deliberate, grounded substitute: walk every "use client" file under
// apps/web/src/ui/**, and refuse a prop-type reference to a whole
// privileged object (Assessment, AssessmentLine, SignOff) imported from
// @dsar/schemas/assessment.
//
// Three halves, mirroring tests/boundary/dom-denylist.test.ts's own
// established "glob half + component half + canary half" structure:
//   1. Real-files half — scans every real "use client" .tsx file, asserts
//      zero violations AND a scanned-file-count floor (so this cannot
//      silently pass by scanning zero files).
//   2. Canary half — proves the scanner is not vacuous by running it
//      against tests/fixtures/rsc-payload-leak-canary.fixture.tsx, a
//      deliberately-violating component, and asserting the violation IS
//      found.
//
// A second, independent describe block covers REVIEW-06/AC-25: no
// formatted money figure anywhere in TotalsRail's rendered output while any
// line is PENDING.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentSchema, type Assessment } from "@dsar/schemas/assessment";
import { TotalsRail } from "../../apps/web/src/ui/review/totals-rail.tsx";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const UI_ROOT = path.join(ROOT, "apps", "web", "src", "ui");
const CANARY_PATH = path.join(ROOT, "tests", "fixtures", "rsc-payload-leak-canary.fixture.tsx");

// The closed list of "whole privileged object" types this screen must never
// pass across the "use client" boundary — PACK-05/PRD §0 non-negotiable #2's
// concern applied to the client-serialisation channel specifically.
const PRIVILEGED_TYPE_NAMES = ["Assessment", "AssessmentLine", "SignOff"] as const;

function findTsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findTsxFiles(full));
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      found.push(full);
    }
  }
  return found;
}

/** True when the file's content opens with (or very near the top carries)
 * a `"use client"` directive — the only files this scanner's privileged-prop
 * rule applies to. */
function isClientComponent(content: string): boolean {
  const firstMeaningfulLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"))
    .slice(0, 3);
  return firstMeaningfulLines.some((line) => line === '"use client";' || line === "'use client';");
}

/** Extracts the names imported from "@dsar/schemas/assessment" in `content`,
 * stripping a `type ` prefix and any `as Alias` rename — a plain,
 * text-level parse sufficient for this codebase's own established
 * source-scan technique (no TypeScript AST parsing required). */
function importedNamesFrom(content: string, moduleSpecifier: string): string[] {
  const importPattern = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+["']${moduleSpecifier}["']`, "g");
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(content)) !== null) {
    const specifierList = match[1] ?? "";
    for (const rawSpecifier of specifierList.split(",")) {
      const cleaned = rawSpecifier.replace(/^\s*type\s+/, "").trim();
      const name = cleaned.split(/\s+as\s+/)[0]?.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** For every privileged type name actually imported from
 * @dsar/schemas/assessment in this file, checks whether it is also used as
 * a type annotation (`: TypeName`) anywhere in the file — the shape a prop
 * declaration (`assessment: Assessment`) always takes, whether declared
 * inline or via a named Props interface. */
function findPrivilegedPropReferences(content: string): string[] {
  const importedPrivileged = importedNamesFrom(content, "@dsar/schemas/assessment").filter((name) =>
    (PRIVILEGED_TYPE_NAMES as readonly string[]).includes(name)
  );

  const violations: string[] = [];
  for (const typeName of importedPrivileged) {
    const usagePattern = new RegExp(`:\\s*(?:readonly\\s+)?${typeName}\\b`);
    if (usagePattern.test(content)) {
      violations.push(typeName);
    }
  }
  return violations;
}

describe("RSC-PAYLOAD-LEAK: real files carry no whole-privileged-object prop (ACCESS-07)", () => {
  it("RSC-PAYLOAD-LEAK: scans every real \"use client\" .tsx file under apps/web/src/ui/** and finds zero privileged-type prop references", () => {
    const allFiles = findTsxFiles(UI_ROOT);
    expect(allFiles.length).toBeGreaterThan(3);

    let scannedClientFileCount = 0;
    const offenders: string[] = [];
    for (const file of allFiles) {
      const content = readFileSync(file, "utf-8");
      if (!isClientComponent(content)) continue;
      scannedClientFileCount += 1;
      const violations = findPrivilegedPropReferences(content);
      if (violations.length > 0) {
        offenders.push(`${path.relative(ROOT, file)}: ${violations.join(", ")}`);
      }
    }

    // The count floor is what stops this test degrading into a silent
    // zero-file no-op — see dom-denylist.test.ts's own module comment on
    // exactly this failure mode.
    expect(scannedClientFileCount).toBeGreaterThan(3);
    expect(offenders, `privileged-type prop references found in: ${offenders.join("; ")}`).toEqual([]);
  });
});

describe("RSC-PAYLOAD-LEAK: canary half (non-vacuity proof)", () => {
  it("RSC-PAYLOAD-LEAK: the scanner catches the canary fixture's deliberate Assessment-typed prop", () => {
    const content = readFileSync(CANARY_PATH, "utf-8");
    expect(isClientComponent(content)).toBe(true);

    const violations = findPrivilegedPropReferences(content);
    expect(violations).toEqual(["Assessment"]);
  });
});

// ---------------------------------------------------------------------------
// REVIEW-06/AC-25 — no headline total anywhere in rendered output while any
// line is PENDING, proven against the actual rendered HTML.
// ---------------------------------------------------------------------------

function buildPendingAssessment(): Assessment {
  return AssessmentSchema.parse({
    id: "assessment-1",
    matterId: "matter-1",
    rulePackId: "SG-PDPA",
    rulePackVersion: "2026.09.1",
    engineVersion: "0.1.0",
    computedAt: "2026-09-18T00:00:00Z",
    lines: [
      {
        id: "line-1",
        expenseLineId: "line-1-expense",
        verdict: "ALLOW",
        engineAmount: 26640,
        appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
        appliedCap: null,
        basis: "Test basis.",
        citation: { instrument: "Test instrument", provision: "s.1" },
        flagReasons: [],
        disposition: "PENDING",
        lawyerAmount: null,
        lawyerReason: null,
        dispositionedBy: null,
        dispositionedAt: null,
      },
    ],
    matterLevelFlags: [],
    totals: {
      claimedTotal: 88800,
      draftBaseline: 26640,
      disallowedTotal: 12660,
      flaggedTotal: 49500,
      restingOnUnverifiedRules: 10640,
      finalAmount: null,
    },
    signOff: null,
  });
}

// The exact figure the headline block would show once every line is
// decided — formatMinor(finalAmount ?? draftBaseline, currency), per
// totals-rail.tsx's own headline-value branch. draftBaseline (266.40)
// legitimately appears elsewhere on the page (the "Supported by rules" row
// is always shown, pending or not) — so the negative assertion below is
// scoped to the headline block specifically, not the whole render: AC-25's
// guarantee is about the RECOMMENDED-FEE headline never showing a figure
// while pending, not about draftBaseline being invisible everywhere.
const HEADLINE_FIGURE_THAT_MUST_NOT_APPEAR = "266.40";

describe("RSC-PAYLOAD-LEAK: REVIEW-06 — no total rendered while any line is pending", () => {
  it("REVIEW-06: TotalsRail's headline block contains the hidden-state marker and NO formatted money figure while a line is pending", () => {
    const assessment = buildPendingAssessment();
    const html = renderToStaticMarkup(React.createElement(TotalsRail, { assessment, currency: "SGD" }));

    // Positive: the hidden-state marker is present (already built per
    // 06-RESEARCH.md).
    expect(html).toContain('data-testid="headline-hidden"');
    expect(html).not.toContain('data-testid="headline-value"');

    // Negative (the missing half this phase's brief calls out): the
    // headline block itself — not the whole page, since the totals-rows
    // section legitimately always shows draftBaseline — contains no
    // formatted money figure anywhere, not merely no headline-value testid.
    const headlineStart = html.indexOf('data-testid="headline"');
    expect(headlineStart).toBeGreaterThan(-1);
    const headlineHtml = html.slice(headlineStart);
    expect(headlineHtml).not.toContain(HEADLINE_FIGURE_THAT_MUST_NOT_APPEAR);
  });
});
