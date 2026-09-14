// packages/schemas/src/taxonomy.ts
//
// PRD §6.3 — the closed 21-code expense category taxonomy. This closed set
// is the single most important design decision in the product: because HR
// picks from a fixed list rather than typing free text, ~95% of lines are
// classified without any LLM involvement, and the whole calculation becomes
// deterministic and testable. Do not add a free-text category field.
// `OTHER_UNCLASSIFIED` is the only escape hatch and it is always flagged for
// legal, never scored — the enforcement of that (AC-19) is Phase 2's
// engine, not this schema.

import { z } from "zod";

export const EXPENSE_CATEGORY_CODES = [
  "STAFF_TIME_SEARCH",
  "STAFF_TIME_COLLATE",
  "STAFF_TIME_REDACT_THIRD_PARTY",
  "STAFF_TIME_REDACT_EXEMPT",
  "STAFF_TIME_ASSESS_EXEMPTIONS",
  "STAFF_TIME_LEGAL_REVIEW",
  "PROFESSIONAL_REVIEW",
  "PHOTOCOPY_PRINT",
  "MEDIA_MATERIALS",
  "POSTAGE_COURIER",
  "SECURE_TRANSFER",
  "IT_EXTRACTION",
  "VENDOR_PAYROLL",
  "VENDOR_ARCHIVE",
  "VENDOR_OTHER",
  "TRANSLATION",
  "TRANSCRIPTION_CONVERSION",
  "IDENTITY_VERIFICATION",
  "ADMIN_OVERHEAD",
  "RECORDS_REMEDIATION",
  "OTHER_UNCLASSIFIED",
] as const;

export const ExpenseCategoryCodeSchema = z.enum(EXPENSE_CATEGORY_CODES);
export type ExpenseCategoryCode = z.infer<typeof ExpenseCategoryCodeSchema>;

// HR-facing labels, transcribed verbatim from the PRD §6.3 table. These are
// what HR chooses from and are the reason ~95% of lines never reach the LLM.
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryCode, string> = {
  STAFF_TIME_SEARCH: "Staff time — locating and retrieving the data",
  STAFF_TIME_COLLATE: "Staff time — collating, copying, compiling the response",
  STAFF_TIME_REDACT_THIRD_PARTY: "Staff time — redacting other people's data",
  STAFF_TIME_REDACT_EXEMPT: "Staff time — redacting exempt or withheld material",
  STAFF_TIME_ASSESS_EXEMPTIONS: "Staff time — deciding what may be withheld",
  STAFF_TIME_LEGAL_REVIEW: "Legal review time (in-house or external)",
  PROFESSIONAL_REVIEW:
    "Specialist review necessary to release the data (e.g. clinician for medical records)",
  PHOTOCOPY_PRINT: "Photocopying and printing",
  MEDIA_MATERIALS: "Physical media and materials (USB, binders, envelopes)",
  POSTAGE_COURIER: "Postage, courier, delivery",
  SECURE_TRANSFER: "Secure electronic transfer or data-room cost",
  IT_EXTRACTION: "IT extraction / system run time / e-discovery processing",
  VENDOR_PAYROLL: "Third-party payroll or tax-records vendor charge",
  VENDOR_ARCHIVE: "Third-party archive or off-site records retrieval",
  VENDOR_OTHER: "Other third-party charge",
  TRANSLATION: "Translation",
  TRANSCRIPTION_CONVERSION: "Transcription or format conversion (e.g. CCTV, audio)",
  IDENTITY_VERIFICATION: "Cost of verifying the requestor's identity",
  ADMIN_OVERHEAD: "General administrative overhead / management time",
  RECORDS_REMEDIATION: "Reconstructing or fixing poorly-kept records",
  OTHER_UNCLASSIFIED: "Something else (always referred to Legal)",
};
