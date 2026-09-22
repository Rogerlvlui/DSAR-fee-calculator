// packages/schemas/src/expense-line.ts
//
// PRD §6.2 ExpenseLine — transcription, not design. Every field below is
// named in §6.2; do not add, remove, or rename one.
//
// claimedAmount is authored as an ordinary required Minor field and the
// quantity * unitRate invariant is enforced with superRefine, not a
// derivation. Two reasons (01-RESEARCH.md, Architecture Patterns,
// Pattern 1): AC-08 requires a *stored* value to be checked against the
// product on load — an invariant check, not a schema-level derivation —
// and avoiding a derivation sidesteps zod 4's changed input/output type
// inference around transforms and defaults.
//
// §12.1: evidenceRef is a pointer to a document held in the DMS, and never
// the document itself — there is no upload anywhere in this system.

import { z } from "zod";
import { MinorSchema, StaffGradeSchema } from "./primitives.ts";
import { ExpenseCategoryCodeSchema } from "./taxonomy.ts";
import { FREE_TEXT_LIMITS } from "./constants.ts";

export const ExpenseUnitSchema = z.enum(["HOUR", "PAGE", "ITEM", "GIGABYTE", "FIXED"]);
export type ExpenseUnit = z.infer<typeof ExpenseUnitSchema>;

// A sane data-entry ceiling (WR-03), not a domain-derived one: no real
// HOUR/PAGE/ITEM/GIGABYTE/FIXED line is ever itemised in the millions, and
// bounding `quantity` here — combined with `unitRate` (MinorSchema) already
// being bounded to the 32-bit signed range — keeps `quantity * unitRate`
// (checked below and at load time, AC-08) well under
// `Number.MAX_SAFE_INTEGER`, so the multiplication itself never loses
// precision before either operand's own bound gets a chance to reject it.
export const EXPENSE_LINE_QUANTITY_MAX = 1_000_000;

export const ExpenseLineSchema = z
  .object({
    id: z.string(),
    matterId: z.string(),
    seq: z.number().int().nonnegative(),
    categoryCode: ExpenseCategoryCodeSchema,
    description: z.string().max(FREE_TEXT_LIMITS.description),
    quantity: z
      .number()
      .int()
      .positive()
      .max(EXPENSE_LINE_QUANTITY_MAX, `quantity must be <= ${EXPENSE_LINE_QUANTITY_MAX}`),
    unit: ExpenseUnitSchema,
    unitRate: MinorSchema,
    // Derived and stored for audit reproducibility, but recomputed and
    // compared on load; a mismatch is a hard error (AC-08). See module note.
    claimedAmount: MinorSchema,
    incurredByGrade: StaffGradeSchema.nullable(),
    isThirdPartyInvoiced: z.boolean(),
    vendorName: z.string().nullable(),
    // Pointer to a document in the DMS, never the document itself (§12.1).
    evidenceRef: z.string().nullable(),
    hrNote: z.string().max(FREE_TEXT_LIMITS.hrNote).nullable(),
  })
  .superRefine((line, ctx) => {
    if (line.claimedAmount !== line.quantity * line.unitRate) {
      ctx.addIssue({
        code: "custom",
        message: "claimedAmount does not match quantity × unitRate",
        path: ["claimedAmount"],
      });
    }
  });

export type ExpenseLine = z.infer<typeof ExpenseLineSchema>;
