// packages/schemas/src/personal-data-pattern.ts
//
// PRD §12.1's warn-never-block pattern check: "a lightweight pattern check
// (long digit strings, ID-number-shaped tokens, email addresses) warns
// before submit. Warn, do not block; false positives on invoice numbers
// would be maddening." Exported once here, following this module's own
// constants.ts single-source-of-truth convention, and used by the intake
// screen now (05-02 Plan) and Phase 6's `lawyerReason` review-screen wiring
// later — that wiring is explicitly out of scope for this plan.
//
// This function is deliberately narrow and hand-authored, not backed by a
// PII-detection package: the three shapes below are the entire scope PRD
// §12.1 asks for, and a broader package would need its own Package
// Legitimacy Gate for no benefit this phase needs. It must never throw and
// never truncate its input — it is a pure, total function over any string.

export interface PersonalDataPatternMatch {
  matched: boolean;
  reason: string | null;
}

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Singapore NRIC/FIN-shaped token: one letter, seven digits, one letter.
const NRIC_FIN_PATTERN = /\b[A-Za-z]\d{7}[A-Za-z]\b/;

// A run of seven or more consecutive digits. Checked AFTER the NRIC/FIN
// pattern above (order matters) so a genuine NRIC/FIN token is reported
// with its own, more specific reason rather than the generic digit-run one.
const LONG_DIGIT_RUN_PATTERN = /\d{7,}/;

/**
 * Three ordered checks, first match wins: an email-shaped substring, a
 * Singapore NRIC/FIN-shaped token, then a run of seven or more consecutive
 * digits. Returns `{ matched: false, reason: null }` when none match.
 */
export function detectLikelyPersonalData(value: string): PersonalDataPatternMatch {
  if (EMAIL_PATTERN.test(value)) {
    return { matched: true, reason: "this looks like an email address" };
  }
  if (NRIC_FIN_PATTERN.test(value)) {
    return { matched: true, reason: "this looks like an NRIC/FIN-shaped identifier" };
  }
  if (LONG_DIGIT_RUN_PATTERN.test(value)) {
    return { matched: true, reason: "this looks like a long digit run (e.g. an ID number)" };
  }
  return { matched: false, reason: null };
}
