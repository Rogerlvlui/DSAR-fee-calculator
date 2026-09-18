// apps/web/src/domain/notice-draft.ts
//
// buildNoticeDraft() renders the requestor-facing notice draft (PRD §10.4,
// §10.5(b)) as plain structured text. It renders the pack's own
// `requestorNoticeTemplate` verbatim — the only sanctioned source of this
// wording is counsel's own authored template (T-03.1-25) — and, where that
// template still carries the UNAUTHORED marker (this demo's real committed
// SG-PDPA pack), renders a not-yet-authored statement instead of inventing
// a letter. The wording of a fee notice is counsel's to author; a demo that
// supplied one anyway would be inventing a legal position, which is the one
// thing this product exists not to do.
//
// The draft carries no legal reasoning, no rule citations, and no reference
// to any tool or model — it is a business letter (PRD §10.5(b)). Pure and
// lives under src/domain/ so it needs no server import to test or reuse.

import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import type { CurrencyCode, Minor } from "@dsar/schemas/primitives";
import { formatMinor } from "@dsar/schemas/money";

export interface NoticeDraftAllowedLine {
  description: string;
  amount: Minor;
}

export interface BuildNoticeDraftInput {
  template: string;
  amount: Minor;
  currency: CurrencyCode;
  allowedLines: readonly NoticeDraftAllowedLine[];
  matterReference: string;
}

// Rendered in place of the pack's template whenever that template still
// carries the UNAUTHORED marker — a clear statement that counsel has not
// yet authored the requestor-facing wording for this jurisdiction. Contains
// no invented legal position, no figure of its own beyond what the caller
// already computed, and no reference to any tool.
export const NOTICE_NOT_YET_AUTHORED_STATEMENT =
  "Counsel has not yet authored the requestor-facing wording for this jurisdiction. " +
  "This draft states the amount and what it covers only; the notice text itself is still pending authoring.";

function isUnauthoredTemplate(template: string): boolean {
  return template.includes(UNAUTHORED_TOKEN);
}

function itemisation(allowedLines: readonly NoticeDraftAllowedLine[], currency: CurrencyCode): string {
  if (allowedLines.length === 0) {
    return "This covers no chargeable items — no fee is charged.";
  }
  return allowedLines.map((line) => `- ${line.description}: ${formatMinor(line.amount, currency)}`).join("\n");
}

// Structured plain text, never HTML — this text is rendered inside a
// copy-to-clipboard block (apps/web/src/ui/hr/notice-block.tsx), never via
// dangerouslySetInnerHTML.
export function buildNoticeDraft({
  template,
  amount,
  currency,
  allowedLines,
  matterReference,
}: BuildNoticeDraftInput): string {
  const wording = isUnauthoredTemplate(template) ? NOTICE_NOT_YET_AUTHORED_STATEMENT : template;

  return [
    `Reference: ${matterReference}`,
    `Amount: ${formatMinor(amount, currency)}`,
    "",
    "What this covers:",
    itemisation(allowedLines, currency),
    "",
    wording,
  ].join("\n");
}
