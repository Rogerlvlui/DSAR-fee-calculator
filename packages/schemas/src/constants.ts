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
