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
// An authored template may carry three placeholders. [amount] and [date] are
// filled from figures this system already holds (the assessed fee; the date
// the request was received). [Name] is never filled: this system must be
// incapable of holding the requestor's name (NS-4), so HR types it in their
// own mailbox.
//
// The draft carries no legal reasoning, no rule citations, and no reference
// to any tool or model — it is a business letter (PRD §10.5(b)). Pure and
// lives under src/domain/ so it needs no server import to test or reuse.

import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import type { CurrencyCode, Minor } from "@dsar/schemas/primitives";
import { formatMinorWithCode } from "@dsar/schemas/money";
import { formatIsoCalendarDate } from "./display-date.ts";

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
  /** ISO calendar date the request was received; fills the template's [date]. */
  requestReceivedOn: string;
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
  return allowedLines.map((line) => `- ${line.description}: ${formatMinorWithCode(line.amount, currency)}`).join("\n");
}

// DOC-03/AC-17 — the requestor notice must carry no rule identifier, no
// statutory citation, no pack-authored basis string, and no mention of AI
// or of this tool. buildNoticeDraft() above is already structurally safe
// (it only ever touches template/amount/currency/allowedLines/
// matterReference — never a ruleId, citation or basis), but AC-17 names an
// explicit regex assertion, and a mechanism that has never been observed
// catching anything is not evidence of anything (this project's own
// standing gate-integrity discipline, Phase 2). The basis-string check
// AC-17 also names is deliberately NOT a pattern here — it takes the
// pinned pack's own categoryRules[].basis values as input, which this pure
// module has no pack to read, so callers (tests/routes/notice-outputs.test.ts)
// perform that substring check directly against the pinned pack.
export interface Ac17Violation {
  label: string;
  match: string;
}

interface Ac17ForbiddenPattern {
  label: string;
  pattern: RegExp;
}

// Rule-identifier shape: an uppercase jurisdiction-and-instrument prefix, a
// dot, then an uppercase underscore-separated token — derived from the real
// committed packs' own ruleId values (e.g. "HK-PDPO.STAFF_TIME_SEARCH",
// "SG-PDPA.STAFF_TIME_SEARCH"), not an invented general shape.
const RULE_IDENTIFIER_PATTERN = /\b[A-Z]{2}-[A-Z]+\.[A-Z]+(?:_[A-Z]+)*\b/g;

// Statutory-citation shape: derived directly from packages/rulepacks/HK-PDPO
// and packages/rulepacks/SG-PDPA's real citations[] entries — provision
// strings of the form "s.28(2)-(3)", "s.19", "reg.7" (instrument+provision
// citations), plus the two real packs' own instrument names/abbreviations,
// rather than a guessed general legal-citation grammar.
const STATUTORY_CITATION_PATTERN =
  /\b(?:s|reg)\.\s?\d+[A-Za-z]?(?:\(\d+[A-Za-z]?\))*(?:-\(\d+[A-Za-z]?\))?\b|\bPersonal Data Protection (?:Act|Regulations)\b|\bPersonal Data \(Privacy\) Ordinance\b|\bPDPO\b|\bPDPA\b/g;

// Tool-or-model mention: the product's own name (the full phrase this app
// renders as its title, apps/web/app/layout.tsx / app-header.tsx — never the
// bare "DSAR" token alone, which is also this system's own matter-reference
// prefix, e.g. "DSAR-2026-0142", and would false-positive on every notice's
// own reference line), the words for artificial intelligence and for a
// language model, and the generic word for an assistant of that kind.
// Case-insensitive on word boundaries — this is requestor-facing copy, not
// the department's own proper noun the engine-language matcher's
// case-sensitivity exists to protect (STATE.md, Phase 02 P07).
const TOOL_OR_MODEL_MENTION_PATTERN =
  /\bDSAR Fee Assessment\b|\bartificial intelligence\b|\bAI\b|\blanguage model\b|\bLLM\b|\bassistant\b|\bchatbot\b/gi;

export const AC17_FORBIDDEN_PATTERNS: readonly Ac17ForbiddenPattern[] = [
  { label: "rule-identifier", pattern: RULE_IDENTIFIER_PATTERN },
  { label: "citation", pattern: STATUTORY_CITATION_PATTERN },
  { label: "tool-or-model-mention", pattern: TOOL_OR_MODEL_MENTION_PATTERN },
];

/** Pure — applies every AC17_FORBIDDEN_PATTERNS entry to `text` and returns
 * every matched substring with its label, empty array when clean. */
export function findAc17Violations(text: string): Ac17Violation[] {
  const violations: Ac17Violation[] = [];
  for (const { label, pattern } of AC17_FORBIDDEN_PATTERNS) {
    // A fresh RegExp per call — a shared `g`-flagged RegExp carries
    // `lastIndex` state across calls, which would silently skip matches on
    // the second and later invocations against the same module-level
    // pattern object.
    const scoped = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(scoped)) {
      violations.push({ label, match: match[0] });
    }
  }
  return violations;
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
  requestReceivedOn,
}: BuildNoticeDraftInput): string {
  const wording = isUnauthoredTemplate(template)
    ? NOTICE_NOT_YET_AUTHORED_STATEMENT
    : template
        .replaceAll("[amount]", formatMinorWithCode(amount, currency))
        .replaceAll("[date]", formatIsoCalendarDate(requestReceivedOn));

  return [
    `Reference: ${matterReference}`,
    `Amount: ${formatMinorWithCode(amount, currency)}`,
    "",
    "What this covers:",
    itemisation(allowedLines, currency),
    "",
    wording,
  ].join("\n");
}
