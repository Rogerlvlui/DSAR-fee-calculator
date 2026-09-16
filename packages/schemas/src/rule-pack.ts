// packages/schemas/src/rule-pack.ts
//
// PRD §7.2 RulePack — transcription, not design, EXCEPT for `FlatFeeSchema`
// and the `flatFee` field on `RulePack`, which are new design filling a gap
// between the PRD and REQUIREMENTS.md's ENGINE-16 (see the module note on
// FlatFeeSchema below for the full account, including why `currency` was
// deliberately dropped from the shape recorded in PLAN.md).
//
// This module does not enforce PACK-02's 21-code categoryRules
// exhaustiveness — that check applies only to `ACTIVE` packs and is a
// Phase 3 build-time validator, so a Phase 3 `DRAFT` stub pack must still
// parse here.

import { z } from "zod";
import {
  CitationSchema,
  ControllerTypeSchema,
  InstrumentSchema,
  IsoDateSchema,
  JurisdictionCodeSchema,
  MinorSchema,
  StaffGradeSchema,
  UserRefSchema,
} from "./primitives.ts";
import { ExpenseUnitSchema } from "./expense-line.ts";
import { ExpenseCategoryCodeSchema } from "./taxonomy.ts";
import { ConditionSchema } from "./condition.ts";

// PRD §7.2's `basis: string; // ≤ 240 chars, plain language, lawyer-written`
// — applies to both CategoryRule.basis and FlatFee.basis.
const BASIS_MAX_LENGTH = 240;

// ---------------------------------------------------------------------------
// FeePosture / VerificationStatus
// ---------------------------------------------------------------------------

export const FeePostureSchema = z.enum([
  "PERMITTED_REASONABLE",
  "PERMITTED_NOT_EXCESSIVE",
  "PERMITTED_ACTUAL_COST",
  "PERMITTED_PRESCRIBED_CAP",
  "PERMITTED_NARROW_EXCEPTION",
  "NO_EXPRESS_AUTHORITY",
  "PROHIBITED",
]);
export type FeePosture = z.infer<typeof FeePostureSchema>;

export const VerificationStatusSchema = z.enum(["VERIFIED", "NEEDS_VERIFICATION"]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

// A pack's `feePosture` is per-controller-type, never a single value — several
// regimes permit a private organisation to charge and prohibit a public
// agency under the same instrument (PRD §7.2). Both keys are required: a
// pack that omits either controller type's posture fails to parse, rather
// than silently defaulting one to (say) PROHIBITED.
export const FeePostureMapSchema = z.strictObject({
  PRIVATE_ORGANISATION: FeePostureSchema,
  PUBLIC_AGENCY: FeePostureSchema,
});
export type FeePostureMap = z.infer<typeof FeePostureMapSchema>;

// ---------------------------------------------------------------------------
// Cap — discriminated union over exactly four variants
// ---------------------------------------------------------------------------

export const CapSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("PER_UNIT"), amount: MinorSchema, unit: ExpenseUnitSchema }),
  z.strictObject({ type: z.literal("PER_LINE"), amount: MinorSchema }),
  z.strictObject({ type: z.literal("PER_MATTER"), amount: MinorSchema }),
  z.strictObject({ type: z.literal("PERCENT_OF_CLAIM"), percent: z.number().min(0).max(100) }),
]);
export type Cap = z.infer<typeof CapSchema>;

// ---------------------------------------------------------------------------
// CategoryRule
// ---------------------------------------------------------------------------

export const CategoryRuleTreatmentSchema = z.enum([
  "ALLOW",
  "ALLOW_WITH_CAP",
  "ALLOW_IF",
  "DISALLOW",
  "FLAG",
]);
export type CategoryRuleTreatment = z.infer<typeof CategoryRuleTreatmentSchema>;

export const CategoryRuleSchema = z.strictObject({
  ruleId: z.string(),
  categoryCode: ExpenseCategoryCodeSchema,
  treatment: CategoryRuleTreatmentSchema,
  cap: CapSchema.nullable(),
  // Machine-evaluable only — the closed ConditionSchema from condition.ts.
  conditions: z.array(ConditionSchema),
  basis: z.string().max(BASIS_MAX_LENGTH),
  citation: CitationSchema,
  verificationStatus: VerificationStatusSchema,
  verificationNote: z.string().nullable(),
});
export type CategoryRule = z.infer<typeof CategoryRuleSchema>;

// ---------------------------------------------------------------------------
// MatterFlagRule — declared here (not primitives.ts) because its `when`
// union has a Condition arm, and Condition cannot be frozen until Matter and
// ExpenseLine exist (01-RESEARCH.md Pattern 2; see primitives.ts's note).
// ---------------------------------------------------------------------------

export const MatterFlagRuleSchema = z.strictObject({
  flagId: z.string(),
  when: z.union([
    z.strictObject({ always: z.literal(true) }),
    ConditionSchema,
    z.strictObject({
      field: z.literal("lineCount"),
      op: z.enum(["gte", "lte"]),
      value: z.number(),
    }),
  ]),
  message: z.string(),
  requiresAcknowledgement: z.boolean().default(false),
});
export type MatterFlagRule = z.infer<typeof MatterFlagRuleSchema>;

// ---------------------------------------------------------------------------
// FlatFee — the PACK-12 / D-02 extension
// ---------------------------------------------------------------------------
//
// NEW DESIGN, not a PRD §7.2 transcription. PRD §7.2 has no `flatFee` field;
// the PRD's only flat-fee mechanism is §7.5's `HK.FLAT_FEE_CHECK`
// matterFlagRule — advisory prose telling a lawyer to *consider* a flat fee,
// not a machine-readable figure. ENGINE-16 (Phase 2) needs the engine to
// *compute* both an itemised baseline and the pack's flat figure and report
// whether the flat one exceeds itemised direct cost — the advisory flag
// cannot satisfy that, so this field fills a gap the PRD leaves open.
//
// This shape was walked through the D-02 checkpoint. The checkpoint's
// resolution deliberately DROPPED a `currency` sub-field from the original
// plan text: PRD §6.0 states outright that currency "is deliberately not a
// per-pack field: it is a property of the jurisdiction, not of any one rule
// pack version." A `currency` on `FlatFee` would either be redundant with
// `JURISDICTION_CURRENCY[jurisdiction.code]` (silent-drift risk if a pack
// author sets it wrong, with nothing here to catch that) or would let a
// flat fee diverge from the jurisdiction's designated currency, which
// contradicts the one-currency-per-jurisdiction invariant enforced
// elsewhere (AC-42). Removing the field removes the failure mode outright;
// the amount's currency is always derived from the pack's own
// `jurisdiction.code` via the existing `JURISDICTION_CURRENCY` map — no new
// cross-field check is needed here because there is no second currency
// value to disagree with the jurisdiction's.
//
// The itemised baseline is still computed even for a flat-fee pack — a flat
// figure cannot be shown to stay below direct cost without one. That
// comparison is ENGINE-16's job in Phase 2, not this schema's.
export const FlatFeeSchema = z.strictObject({
  amount: MinorSchema,
  basis: z.string().max(BASIS_MAX_LENGTH),
  citation: CitationSchema,
  verificationStatus: VerificationStatusSchema,
});
export type FlatFee = z.infer<typeof FlatFeeSchema>;

// ---------------------------------------------------------------------------
// RulePack
// ---------------------------------------------------------------------------

export const RulePackStatusSchema = z.enum(["DRAFT", "ACTIVE", "STALE", "WITHDRAWN"]);
export type RulePackStatus = z.infer<typeof RulePackStatusSchema>;

export const RulePackConstraintsSchema = z.strictObject({
  noChargeForMakingRequest: z.boolean(),
  estimateRequiredBeforeCharging: z.boolean(),
  feeNotificationDeadlineDays: z.number().int().nonnegative().nullable(),
  deadlineBasis: z.enum(["CALENDAR_DAYS", "WORKING_DAYS"]),
  responseDeadlineDays: z.number().int().nonnegative().nullable(),
  advancePaymentPermitted: z.boolean(),
  mayWithholdDataUntilPaid: z.boolean(),
  // Required, no `.default(...)`. A pack that omits its position on either
  // of these must fail validation rather than silently inheriting a
  // permissive `true` — both are false in every regime known to this
  // product (PRD §7.2).
  profitElementPermitted: z.boolean(),
  deterrentUsePermitted: z.boolean(),
  regulatorMayReviewFee: z.boolean(),
  aggregateCap: CapSchema.nullable(),
});
export type RulePackConstraints = z.infer<typeof RulePackConstraintsSchema>;

export const RulePackSchema = z.strictObject({
  packId: z.string(),
  jurisdiction: z.strictObject({
    code: JurisdictionCodeSchema,
    name: z.string(),
  }),
  version: z.string(),
  status: RulePackStatusSchema,
  // Both must be non-null before ACTIVE (AC-38) — enforced by Phase 3's
  // build-time validator, not this schema.
  authoredBy: UserRefSchema.nullable(),
  reviewedBy: UserRefSchema.nullable(),
  reviewedOn: IsoDateSchema.nullable(),
  reviewDueOn: IsoDateSchema,
  instruments: z.array(InstrumentSchema),
  feePosture: FeePostureMapSchema,
  // Derived, not authored: the controller types whose posture is not
  // PROHIBITED. Kept as a field only so the engine's precondition check is
  // a lookup (PRD §7.2).
  appliesTo: z.array(ControllerTypeSchema),
  // Partial map — not every StaffGrade need carry a ceiling. zod 4's
  // single-argument z.record() shorthand is gone; z.partialRecord() is its
  // purpose-built replacement for an optional-key map (01-RESEARCH.md
  // Pattern 1).
  rateSanityCeiling: z.partialRecord(StaffGradeSchema, MinorSchema),
  constraints: RulePackConstraintsSchema,
  // One per §6.3 code — exhaustive for an ACTIVE pack (PACK-02, Phase 3).
  // Not enforced here so a DRAFT stub can still parse.
  categoryRules: z.array(CategoryRuleSchema),
  matterFlagRules: z.array(MatterFlagRuleSchema),
  requestorNoticeTemplate: z.string(),
  openQuestions: z.array(z.string()),
  // PACK-12 / D-02 — optional, not nullable-required, so a pack with no
  // flat fee omits the key entirely and its JSON is literally unchanged.
  // See the FlatFeeSchema module note above.
  flatFee: FlatFeeSchema.optional(),
});
export type RulePack = z.infer<typeof RulePackSchema>;

// ---------------------------------------------------------------------------
// StubConstraints / LoadableRulePack — Phase 3 additive types (D-18, PD-1, PD-2)
// ---------------------------------------------------------------------------
//
// NEW DESIGN, additive only — nothing above is renamed, retyped or removed
// (D-09). D-18 resolves a real gap: `RulePackConstraintsSchema`'s booleans
// are required with no defaults so an authored pack cannot silently inherit
// a permissive `true` — but that leaves no way for an UNAUTHORED stub pack
// to express "nobody has researched this yet". `StubConstraintsSchema` is a
// strict superset of the frozen shape (every key `.nullable()`, in the same
// order, including the two day counts and `aggregateCap` that were already
// nullable) so `null` means "not researched" and `false` means "researched
// and negative" — the two are never collapsed into one falsy value.
//
// PD-1 records why this is a NEW parallel schema rather than widening
// `RulePackConstraintsSchema` in place: D-18 explicitly rejected that
// alternative ("re-opens a freeze mid-phase while Phases 4 and 5 run
// concurrently against it, and widening a required field is not obviously
// additive"). `packages/engine` keeps seeing `pack.constraints` as
// all-boolean and needs no change.
export const StubConstraintsSchema = z.strictObject({
  noChargeForMakingRequest: z.boolean().nullable(),
  estimateRequiredBeforeCharging: z.boolean().nullable(),
  feeNotificationDeadlineDays: z.number().int().nonnegative().nullable(),
  deadlineBasis: z.enum(["CALENDAR_DAYS", "WORKING_DAYS"]).nullable(),
  responseDeadlineDays: z.number().int().nonnegative().nullable(),
  advancePaymentPermitted: z.boolean().nullable(),
  mayWithholdDataUntilPaid: z.boolean().nullable(),
  profitElementPermitted: z.boolean().nullable(),
  deterrentUsePermitted: z.boolean().nullable(),
  regulatorMayReviewFee: z.boolean().nullable(),
  aggregateCap: CapSchema.nullable(),
});
export type StubConstraints = z.infer<typeof StubConstraintsSchema>;

// PD-2: `LoadableRulePackSchema` is the PRIMARY shape every committed pack
// parses as (the assumption-delta decision in 03-01-PLAN.md — "the loadable
// rule pack" replaces "the fully-determined rule pack" as the general
// shape). `RulePackSchema` above is demoted to the narrowed, ACTIVE-ready
// variant `packages/engine` consumes. Because
// `z.boolean().nullable()` accepts `true`, `false` and `null`,
// `StubConstraintsSchema` is a strict superset of `RulePackConstraintsSchema`
// — so re-parsing a `LoadableRulePack` with the untouched, frozen
// `RulePackSchema` is exactly what refuses a surviving `null` at the ACTIVE
// gate (plan 03-03), with no hand-written eleven-key check that could drift
// from the frozen shape.
export const LoadableRulePackSchema = RulePackSchema.extend({
  constraints: StubConstraintsSchema,
});
export type LoadableRulePack = z.infer<typeof LoadableRulePackSchema>;
