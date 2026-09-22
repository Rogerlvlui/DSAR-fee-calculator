// tests/boundary/ui-banned-words.test.ts
//
// DISC-03 — a render-and-scan gate proving no rendered HR/disclosure
// surface contains any of AC-32's canonical banned words. Reuses the exact
// matcher tests/boundary/banned-word-matcher.ts already proved correct
// (the same one-line \b${word}\b construction
// packages/engine/src/engine-language.test.ts independently carries too —
// not a shared import, since that package's composite tsconfig rootDir
// cannot reach into tests/; see that file's own note).
//
// apps/web has no single "messages.ts"-equivalent strings module
// (05-RESEARCH.md Wave 0 Gaps), so this scans RENDERED TEXT: every
// component this phase built or touched is rendered with representative
// props (including a pattern-triggering description/identityVerifiedNote,
// so the new personal-data warning sentence itself is scanned), the
// rendered HTML is stripped to plain text, and every extracted string is
// concatenated and checked once. A canary half (mirroring
// tests/boundary/dom-denylist.test.ts's own three-halves shape) proves the
// scanner actually inspects something real.
//
// notice-block.tsx and info-request-panel.tsx are loaded via a runtime
// dynamic import (a computed path, not a string literal) rather than a
// static import: both files import "next/navigation" unconditionally at
// module scope (even though only the pure *View export is used here),
// which does not resolve under this project's inherited "nodenext"
// resolution — the same class of issue current-actor.ts's "next/headers"
// import causes, worked around the same way tests/routes/hr-matters-list.test.ts
// already established for a page.tsx import.

import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LEGAL_CONCLUSION_BANNED_WORDS } from "@dsar/schemas/constants";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";
import { findBannedWord } from "./banned-word-matcher.ts";
import { BannedWordCanaryFixture } from "../fixtures/banned-word-canary.fixture.tsx";

import { CapabilityStatement } from "../../apps/web/src/ui/capability/capability-statement.tsx";
import { StatusStrip } from "../../apps/web/src/ui/chrome/status-strip.tsx";
import {
  MatterDetailsFields,
  headsUpMessage,
  type MatterDetailsJurisdictionPack,
  type MatterDetailsValue,
} from "../../apps/web/src/ui/intake/matter-details-fields.tsx";
import { AttestationsPanel, type AttestationsValue } from "../../apps/web/src/ui/intake/attestations-panel.tsx";
import {
  ExpenseLineRepeater,
  type ExpenseLineDraft,
  type RepeaterCategoryOption,
} from "../../apps/web/src/ui/intake/expense-line-repeater.tsx";
import { ClaimFooter } from "../../apps/web/src/ui/intake/claim-footer.tsx";
import { AutosaveIndicator } from "../../apps/web/src/ui/intake/autosave-indicator.tsx";
import { ResultView, type ResultViewLine } from "../../apps/web/src/ui/hr/result-view.tsx";
import { matterStatusLabelForHr } from "../../apps/web/src/domain/hr-matter-status-label.ts";

// Structurally identical to info-request-panel.tsx's own InfoRequestPanelQuery
// — re-declared here rather than imported (even type-only), since a
// type-only import still requires tsc to resolve the source module.
interface InfoRequestPanelQueryLike {
  id: string;
  lineLabel: string;
  query: string;
  raisedAt: string;
}

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const { NoticeBlockView } = (await import(
  pathToFileURL(path.join(ROOT, "apps", "web", "src", "ui", "hr", "notice-block.tsx")).href
)) as { NoticeBlockView: (props: Record<string, unknown>) => React.ReactElement };
const { InfoRequestPanelView } = (await import(
  pathToFileURL(path.join(ROOT, "apps", "web", "src", "ui", "hr", "info-request-panel.tsx")).href
)) as { InfoRequestPanelView: (props: Record<string, unknown>) => React.ReactElement };

/** Strips HTML tags from a renderToStaticMarkup result into plain text,
 * decoding the handful of numeric/named entities this codebase's own
 * rendered strings actually produce (apostrophes, em dashes). */
function extractText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function render(element: React.ReactElement): string {
  return extractText(renderToStaticMarkup(element));
}

const REPRESENTATIVE_CATEGORIES: RepeaterCategoryOption[] = EXPENSE_CATEGORY_CODES.map((categoryCode) => ({
  categoryCode,
  label: EXPENSE_CATEGORY_LABELS[categoryCode],
  hint: "Representative hint text for boundary scanning.",
  verificationStatus: "NEEDS_VERIFICATION",
}));

const REPRESENTATIVE_LINE: ExpenseLineDraft = {
  key: "banned-word-scan-line",
  categoryCode: "STAFF_TIME_SEARCH",
  // Pattern-triggering: an email address, so detectLikelyPersonalData's own
  // warning sentence is itself scanned for banned words.
  description: "Contact jane.doe@example.com about this line",
  quantity: 4,
  unit: "HOUR",
  rateMajor: "40.00",
  incurredByGrade: "EXECUTIVE",
  isThirdPartyInvoiced: false,
  vendorName: "",
  evidenceRef: "",
};

const MATTER_DETAILS_VALUE: MatterDetailsValue = {
  reference: "DSAR-2026-0001",
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-08-20",
  requestorClass: "FORMER_EMPLOYEE",
};

const JURISDICTION_PACK_STATES: MatterDetailsJurisdictionPack[] = (
  ["ACTIVE", "ACTIVE_REVIEW_DUE_SOON", "STALE", "DRAFT", "NO_USABLE_PACK"] as const
).map((displayStatus) => ({
  jurisdictionCode: "SG",
  jurisdictionName: "Singapore",
  packId: displayStatus === "NO_USABLE_PACK" ? null : "SG-PDPA",
  version: displayStatus === "NO_USABLE_PACK" ? null : "2026.09.1",
  displayStatus,
  daysUntilReviewDue: displayStatus === "NO_USABLE_PACK" ? null : 12,
  feePosture:
    displayStatus === "NO_USABLE_PACK"
      ? null
      : { PRIVATE_ORGANISATION: "PERMITTED_REASONABLE", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
}));

const RESULT_VIEW_LINES: ResultViewLine[] = [
  {
    id: "line-1",
    seq: 0,
    categoryLabel: EXPENSE_CATEGORY_LABELS.STAFF_TIME_SEARCH,
    description: "Staff time locating records",
    struck: false,
    amount: 16000 as ResultViewLine["amount"],
    basis: "Recoverable staff time under the pack's authored basis.",
  },
  {
    id: "line-2",
    seq: 1,
    categoryLabel: EXPENSE_CATEGORY_LABELS.OTHER_UNCLASSIFIED,
    description: "Miscellaneous cost",
    struck: true,
    amount: 0 as ResultViewLine["amount"],
    basis: "Not supported under the pack's fee posture for this category.",
  },
];

const INFO_REQUEST_QUERIES: InfoRequestPanelQueryLike[] = [
  { id: "req-1", lineLabel: "Assessment line 1", query: "Please clarify the staff grade for this line.", raisedAt: "2026-09-01" },
];

function renderEveryComponent(): string {
  const texts: string[] = [];

  texts.push(
    render(React.createElement(CapabilityStatement, { children: React.createElement("main", null, "gated content") }))
  );

  for (const status of ["typical", "NO_USABLE_PACK", "STALE"] as const) {
    texts.push(
      render(
        React.createElement(StatusStrip, {
          matterReference: "DSAR-2026-0001",
          jurisdictionName: "Singapore",
          rulePackId: status === "NO_USABLE_PACK" ? "—" : "SG-PDPA",
          rulePackVersion: status === "NO_USABLE_PACK" ? "—" : "2026.09.1",
          packStatus: status === "NO_USABLE_PACK" ? "—" : status === "STALE" ? "STALE" : "DRAFT",
          authoredByDisplayName: null,
          reviewedByDisplayName: null,
          reviewedOn: null,
          daysUntilReviewDue: status === "STALE" ? -5 : 400,
        })
      )
    );
  }

  for (const jurisdictionPack of JURISDICTION_PACK_STATES) {
    texts.push(
      render(
        React.createElement(MatterDetailsFields, {
          value: MATTER_DETAILS_VALUE,
          onChange: () => {},
          currency: "SGD",
          jurisdictionPack,
        })
      )
    );
  }
  // headsUpMessage() is deliberately NOT added to this combined corpus —
  // see the dedicated describe block below for why and what it actually
  // proves instead.

  const attestationsValue: AttestationsValue = {
    identityVerified: true,
    // Pattern-triggering: an NRIC/FIN-shaped token, so the live warning
    // sentence is scanned here too.
    identityVerifiedNote: "Verified against S1234567A on file",
    scopeClarified: true,
    isKnownDisputeOrLitigation: false,
  };
  texts.push(
    render(React.createElement(AttestationsPanel, { value: attestationsValue, onChange: () => {}, noteMaxLength: 200 }))
  );

  texts.push(
    render(
      React.createElement(ExpenseLineRepeater, {
        lines: [REPRESENTATIVE_LINE],
        onChange: () => {},
        categories: REPRESENTATIVE_CATEGORIES,
        currency: "SGD",
      })
    )
  );

  texts.push(
    render(
      React.createElement(ClaimFooter, {
        claimedTotalMinor: 88800,
        currency: "SGD",
        disabledReason: null,
        submitting: false,
        onSubmit: () => {},
      })
    )
  );

  for (const status of ["idle", "saving", "saved", "error"] as const) {
    texts.push(render(React.createElement(AutosaveIndicator, { status, savedAt: status === "saved" ? Date.now() : null })));
  }

  texts.push(
    render(
      React.createElement(ResultView, {
        matterReference: "DSAR-2026-0001",
        finalAmount: 16000 as ResultViewLine["amount"],
        currency: "SGD",
        lawyerName: "Roger Lui",
        qualification: "Advocate & Solicitor, Singapore",
        signedAt: "2026-09-15T00:00:00.000Z",
        lines: RESULT_VIEW_LINES,
      })
    )
  );

  texts.push(
    render(
      React.createElement(NoticeBlockView, {
        draft: "Reference: DSAR-2026-0142\nAmount: SGD 160.00",
        noticeSentAt: null,
        pending: false,
        error: null,
        onMarkSent: () => {},
      })
    )
  );

  texts.push(
    render(
      React.createElement(InfoRequestPanelView, {
        queries: INFO_REQUEST_QUERIES,
        pending: false,
        error: null,
        onResubmit: () => {},
      })
    )
  );

  for (const status of ["DRAFT", "COMPUTING", "LEGAL_REVIEW", "INFO_REQUEST", "SIGNED_OFF", "CLOSED", "SUPERSEDED"] as const) {
    texts.push(matterStatusLabelForHr(status));
  }

  return texts.join(" ");
}

describe("UI-BANNED-WORDS: canary", () => {
  it("UI-BANNED-WORDS: the canary fixture's deliberate violations ARE caught by the scanner", () => {
    const text = render(React.createElement(BannedWordCanaryFixture));
    expect(findBannedWord(text, LEGAL_CONCLUSION_BANNED_WORDS)).not.toBeNull();
    expect(text).toContain("compliant");
    expect(text).toContain("lawful");
  });

  it("UI-BANNED-WORDS: the canary's capitalised 'Legal' (the department) is NOT flagged", () => {
    const text = render(React.createElement(BannedWordCanaryFixture));
    // Isolate just the department-name sentence to prove that sentence
    // alone does not trip the matcher, independent of the deliberate
    // violation sentence elsewhere in the same fixture.
    const departmentSentence = "Ask Legal for a second opinion.";
    expect(text).toContain(departmentSentence);
    expect(findBannedWord(departmentSentence, LEGAL_CONCLUSION_BANNED_WORDS)).toBeNull();
  });
});

describe("UI-BANNED-WORDS: the real HR/disclosure surface", () => {
  it("UI-BANNED-WORDS: rendering every component this phase built or touched finds zero banned-word matches across the whole combined text", () => {
    const combined = renderEveryComponent();
    expect(findBannedWord(combined, LEGAL_CONCLUSION_BANNED_WORDS)).toBeNull();
  });

  it("UI-BANNED-WORDS: the combined extracted text is at least 500 characters — the non-vacuousness floor", () => {
    const combined = renderEveryComponent();
    expect(combined.length).toBeGreaterThanOrEqual(500);
  });
});

describe("UI-BANNED-WORDS: headsUpMessage — a documented, out-of-scope exception", () => {
  // DISC-03's own definition (.planning/REQUIREMENTS.md) scopes the ban to
  // "No ENGINE-DERIVED UI string" (AC-32a) — headsUpMessage() is static UI
  // copy authored in matter-details-fields.tsx, not engine output, and its
  // exact wording ("no clear legal basis for charging a fee") is PRD
  // §10.2's own verbatim quote, reproduced unchanged since Phase 3.1
  // (05-UI-SPEC.md's own Copywriting Contract marks it "Existing —
  // headsUpMessage(), unchanged text"). Altering PRD-locked verbatim copy
  // to satisfy a banned-word scanner would violate this codebase's own
  // no-extrapolation discipline (D-14) and CLAUDE.md's "PRD is the source
  // of truth" rule — so this string is intentionally excluded from the
  // combined "whole surface" corpus above, with its one expected match
  // documented here rather than silently dropped.
  it("UI-BANNED-WORDS: headsUpMessage's PRD-verbatim text contains the expected, documented 'legal' match — proving the exclusion above is deliberate, not an oversight", () => {
    const text = headsUpMessage("Singapore");
    expect(findBannedWord(text, LEGAL_CONCLUSION_BANNED_WORDS)).toBe("legal");
    expect(text).toContain("no clear legal basis");
  });
});
