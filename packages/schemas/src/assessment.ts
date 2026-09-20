// packages/schemas/src/assessment.ts
//
// PRD §6.4 Verdict, Disposition, AssessmentLine, Assessment, SignOff, plus
// §8.1 step 6's Totals — transcription, not design, with one deliberate
// addition: `SignOffSchema.attestationVersion`, which has no §6.4 field of
// its own but is added per this plan's <action> so §9.5's attestation
// wording can be recorded verbatim by version (the same "additive, not
// invented" latitude used for other provenance-only fields elsewhere in
// this freeze).
//
// D-03 (01-CONTEXT.md): these types are committed to before assess() has
// ever run. The accepted mitigation is PRD §14's reference fixture, which
// pins the expected Assessment shape field by field, plus the additive-only
// freeze policy recorded in FREEZE.md (this plan's Task 3).
//
// AC-25: Totals.finalAmount is nullable, carries no `.default(...)`, and is
// never populated from draftBaseline — it must be structurally
// unrepresentable as a number before sign-off.
//
// §12.1 / ACCESS-05 (Phase 7): lawyerReason is privileged and never leaves
// /legal/* or the internal record. This schema only carries the field and
// its FREE_TEXT_LIMITS cap; enforcing the boundary server-side is Phase 7's.

import { z } from "zod";
import {
  CitationSchema,
  FlagReasonSchema,
  IsoDateTimeSchema,
  MatterFlagSchema,
  MinorSchema,
  UserRefSchema,
} from "./primitives.ts";
import { CapSchema } from "./rule-pack.ts";
import { FREE_TEXT_LIMITS } from "./constants.ts";

// ---------------------------------------------------------------------------
// Verdict / Disposition
// ---------------------------------------------------------------------------

export const VerdictSchema = z.enum(["ALLOW", "ALLOW_CAPPED", "DISALLOW", "FLAG"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const DispositionSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REDUCED",
  "STRUCK",
  "ALLOWED_BY_LAWYER",
]);
export type Disposition = z.infer<typeof DispositionSchema>;

// ---------------------------------------------------------------------------
// AssessmentLine
// ---------------------------------------------------------------------------

export const AssessmentLineSchema = z
  .object({
    id: z.string(),
    expenseLineId: z.string(),
    verdict: VerdictSchema,
    // 0 for DISALLOW and FLAG, per PRD §6.4 comment — not enforced here as
    // a schema-level constraint; the engine (Phase 2) is what sets it.
    engineAmount: MinorSchema,
    appliedRuleId: z.string(),
    appliedCap: CapSchema.nullable(),
    basis: z.string().max(240),
    citation: CitationSchema,
    flagReasons: z.array(FlagReasonSchema),
    disposition: DispositionSchema,
    lawyerAmount: MinorSchema.nullable(),
    // Privileged: never leaves /legal/* or the internal record (§12.1).
    // Enforcing that boundary server-side is ACCESS-05, Phase 7 — not this
    // schema's job.
    lawyerReason: z.string().max(FREE_TEXT_LIMITS.lawyerReason).nullable(),
    dispositionedBy: UserRefSchema.nullable(),
    dispositionedAt: IsoDateTimeSchema.nullable(),
  })
  .superRefine((line, ctx) => {
    if (line.verdict === "FLAG" && line.flagReasons.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "flagReasons must be non-empty when verdict is FLAG",
        path: ["flagReasons"],
      });
    }
    if (line.verdict !== "FLAG" && line.flagReasons.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "flagReasons must be empty unless verdict is FLAG",
        path: ["flagReasons"],
      });
    }
  });
export type AssessmentLine = z.infer<typeof AssessmentLineSchema>;

// ---------------------------------------------------------------------------
// FlatFeeComparison — the D-12 extension to Totals
// ---------------------------------------------------------------------------
//
// NEW DESIGN, not a PRD §8.1 transcription — §8.1 step 6 names no flat-fee
// field. ENGINE-16 (Phase 2) requires the engine to compute and report a
// comparison between the pack's flat figure and itemised direct cost, but
// the frozen Totals had no field to write that answer into. D-12
// (02-CONTEXT.md) resolves the gap additively.
//
// "Itemised direct cost" is Phase 2's reading, not the PRD's: it means
// `draftBaseline`, the itemised allowable total before any lawyer
// disposition. This is grounded in rule-pack.ts's FlatFeeSchema module
// note — a flat figure cannot be shown to stay below direct cost without an
// itemised baseline to compare it against — and draftBaseline is exactly
// that baseline. The comparison stores its own itemisedDirectCostAmount
// field rather than leaving the reader to infer it from draftBaseline
// elsewhere on Totals, so the record self-describes what was compared
// against what at computation time and survives a later change to how
// draftBaseline itself is derived.
//
// No currency sub-field, for the same reason FlatFeeSchema (rule-pack.ts)
// carries none: PRD §6.0 makes currency a property of the jurisdiction, not
// of any pack or figure within one. Adding one here would reintroduce
// exactly the drift the D-02 gate removed from FlatFeeSchema.
//
// z.strictObject: an undeclared key is a parse error, not silently dropped.
export const FlatFeeComparisonSchema = z.strictObject({
  flatFeeAmount: MinorSchema,
  itemisedDirectCostAmount: MinorSchema,
  flatFeeExceedsItemisedCost: z.boolean(),
});
export type FlatFeeComparison = z.infer<typeof FlatFeeComparisonSchema>;

// ---------------------------------------------------------------------------
// Totals (PRD §8.1 step 6)
// ---------------------------------------------------------------------------

export const TotalsSchema = z.object({
  claimedTotal: MinorSchema,
  draftBaseline: MinorSchema,
  disallowedTotal: MinorSchema,
  flaggedTotal: MinorSchema,
  restingOnUnverifiedRules: MinorSchema,
  // AC-25: required, nullable, NO `.default(...)`. Never populate this from
  // draftBaseline — it must be unrepresentable as a number before sign-off.
  finalAmount: MinorSchema.nullable(),
  // D-12 — optional, not nullable-required, so a pack with no flat fee omits
  // the key entirely and every existing six-key Totals JSON is literally
  // unchanged. Follows the RulePack.flatFee precedent (rule-pack.ts) for the
  // same reason.
  flatFeeComparison: FlatFeeComparisonSchema.optional(),
});
export type Totals = z.infer<typeof TotalsSchema>;

// ---------------------------------------------------------------------------
// SignOff
// ---------------------------------------------------------------------------

// attestationVersion is not itself a PRD §6.4 field — added so §9.5's
// attestation wording can be recorded verbatim by version on every
// sign-off, even after the copy changes later.
export const SignOffSchema = z.object({
  lawyer: UserRefSchema,
  lawyerName: z.string(),
  qualification: z.string(),
  signedAt: IsoDateTimeSchema,
  finalAmount: MinorSchema,
  acknowledgedFlags: z.array(z.string()),
  attestation: z.literal(true),
  attestationVersion: z.string(),
});
export type SignOff = z.infer<typeof SignOffSchema>;

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

// D-12-style additive extension (06-07, REVIEW-11): the lawyer's choice
// between the itemised and flat figure, where the pack's Totals carries a
// flatFeeComparison. `.optional()`, not `.nullable()`-required, so every
// existing Assessment JSON without this key still parses unchanged —
// mirrors FlatFeeComparisonSchema's own additive-field precedent exactly.
// Persisted the moment it is chosen, the same pattern per-line dispositions
// already use, not held back for sign-off.
export const FeeChoiceSchema = z.enum(["ITEMISED", "FLAT"]);
export type FeeChoice = z.infer<typeof FeeChoiceSchema>;

export const AssessmentSchema = z.object({
  id: z.string(),
  matterId: z.string(),
  rulePackId: z.string(),
  rulePackVersion: z.string(),
  engineVersion: z.string(),
  computedAt: IsoDateTimeSchema,
  lines: z.array(AssessmentLineSchema),
  matterLevelFlags: z.array(MatterFlagSchema),
  totals: TotalsSchema,
  signOff: SignOffSchema.nullable(),
  feeChoice: FeeChoiceSchema.optional(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;
