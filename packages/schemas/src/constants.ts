// packages/schemas/src/constants.ts
//
// AC-06's ten-token personal-data deny-list and PRD §12.1's four free-text
// length caps. Exported once here and imported everywhere else — a second
// copy anywhere is a defect. Plan 01-03's Prisma-field test and Phase 3.2's
// rendered-DOM test both import `PERSONAL_DATA_DENY_LIST` from this single
// module, so widening the list automatically widens both checks.

// Case-insensitive, non-alphanumerics stripped before comparison at the call
// site (AC-06). The requestor is never named in the system — no column, no
// form input name, may match one of these tokens.
export const PERSONAL_DATA_DENY_LIST = [
  "requestorname",
  "requestername",
  "datasubjectname",
  "nric",
  "fin",
  "passport",
  "requestoremail",
  "dateofbirth",
  "dob",
  "employeeid",
] as const;

// PRD §12.1 free-text field caps: ExpenseLine.description (300),
// ExpenseLine.hrNote (500), Matter.identityVerifiedNote (200),
// AssessmentLine.lawyerReason (1000).
export const FREE_TEXT_LIMITS = {
  description: 300,
  hrNote: 500,
  identityVerifiedNote: 200,
  lawyerReason: 1000,
} as const;

// AC-32(a)'s canonical banned-word list, transcribed verbatim (PRD §10.1 /
// §13 AC-32): "No engine-derived UI string, and no pack-authored `basis`
// string, contains any of the canonical banned words ... asserted by a lint
// rule over the i18n strings file and by pack validation over every
// `basis`." Exported once here — matching this module's own PERSONAL_DATA_
// DENY_LIST precedent — so plan 02-07's engine-language test, Phase 3's
// pack validator, and Phase 5's UI string check all import the SAME list
// rather than each minting its own copy that could drift.
export const LEGAL_CONCLUSION_BANNED_WORDS = [
  "compliant",
  "non-compliant",
  "legal",
  "illegal",
  "lawful",
  "unlawful",
  "approved",
  "safe",
] as const;

// AC-23's canonical reason stop-list, transcribed verbatim (PRD line 910):
// a disposition reason that is, after trimming and case-folding, ENTIRELY
// one of these 11 stock phrases is not a real reason, however long enough
// it clears the ≥10-non-whitespace-character length check on its own
// ("noted" is only 5 characters and would already fail length, but
// "as above" is 7 and "agreed" is 6 — the point is these phrases carry no
// accountability trail regardless of length). Exported once here — matching
// this module's own PERSONAL_DATA_DENY_LIST/LEGAL_CONCLUSION_BANNED_WORDS
// precedent — so apps/web/src/domain/disposition-actions.ts's shared check
// (imported by both the server's authoritative assertSufficientReason and
// the two client reason fields' UX-only counter text) is the only place
// either side ever checks a stock phrase.
export const REASON_STOP_LIST = [
  "ok",
  "okay",
  "fine",
  "agreed",
  "yes",
  "no",
  "n/a",
  "na",
  "noted",
  "as above",
  "same",
] as const;

// D-15 (03-CONTEXT.md) — the fixed marker a rule pack carries in
// `verificationNote` while no named counsel has written it yet. A rule is
// "unauthored" in a way that must be indistinguishable from nothing, not
// from a decision — so the marker lives in `verificationNote` rather than in
// `treatment` or `verificationStatus`, both of which carry legitimate
// authored meanings (`FLAG`/`NEEDS_VERIFICATION` is itself a valid authored
// outcome, e.g. `OTHER_UNCLASSIFIED`). Exported once here — matching this
// module's own list-export precedent — so Phase 3's drift test (D-19) and
// its ACTIVE gate (PACK-03) both read the SAME marker; there must never be a
// second one to keep in sync.
export const UNAUTHORED_TOKEN = "UNAUTHORED";
