// packages/schemas/src/matter.ts
//
// PRD §6.1 Matter — transcription, not design. Every field below is named
// in §6.1; do not add, remove, or rename one.
//
// AC-42 (§6.0, §8.1 step 1) requires a Matter's currency to equal
// JURISDICTION_CURRENCY[jurisdictionCode]. This module is the first of
// AC-42's three enforcement layers — the database check constraint is
// Phase 3.2 plan 03.2-02, and the intake form validation is Phase 5's.
//
// §12.1: identityVerifiedNote is a reference to where HR already keeps the
// identity-verification evidence (e.g. an HR ticket number) — never the
// evidence itself, and this type deliberately carries no field naming or
// identifying the requestor.

import { z } from "zod";
import { CurrencyCodeSchema, JurisdictionCodeSchema, JURISDICTION_CURRENCY, UserRefSchema } from "./primitives.ts";
import { IsoDateSchema, IsoDateTimeSchema, UlidSchema } from "./primitives.ts";
import { MatterStatusSchema } from "./matter-status.ts";
import { FREE_TEXT_LIMITS } from "./constants.ts";

export const RequestorClassSchema = z.enum(["FORMER_EMPLOYEE", "CURRENT_EMPLOYEE", "OTHER"]);
export type RequestorClass = z.infer<typeof RequestorClassSchema>;

export const MatterSchema = z
  .object({
    id: UlidSchema,
    reference: z.string(),
    jurisdictionCode: JurisdictionCodeSchema,
    legalEntity: z.string(),
    controllerType: z.enum(["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"]),
    requestReceivedOn: IsoDateSchema,
    requestorClass: RequestorClassSchema,
    currency: CurrencyCodeSchema,
    // Attestations by HR. Booleans only — never the underlying evidence (§12.1).
    identityVerified: z.boolean(),
    identityVerifiedNote: z.string().max(FREE_TEXT_LIMITS.identityVerifiedNote).nullable(),
    scopeClarified: z.boolean(),
    isRepeatRequestWithin12Months: z.boolean(),
    isKnownDisputeOrLitigation: z.boolean(),
    status: MatterStatusSchema.default("DRAFT"),
    createdBy: UserRefSchema,
    createdAt: IsoDateTimeSchema,
  })
  .superRefine((matter, ctx) => {
    const expectedCurrency = JURISDICTION_CURRENCY[matter.jurisdictionCode];
    if (matter.currency !== expectedCurrency) {
      ctx.addIssue({
        code: "custom",
        message: `currency '${matter.currency}' does not match jurisdiction '${matter.jurisdictionCode}''s designated currency '${expectedCurrency}'`,
        path: ["currency"],
      });
    }
  });

export type Matter = z.infer<typeof MatterSchema>;
