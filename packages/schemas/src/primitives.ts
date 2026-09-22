// packages/schemas/src/primitives.ts
//
// PRD §6.0 "Shared primitives — declare these first". Everything below and
// in §7.2 depends on these. This module is a field-for-field transcription;
// do not add, remove, or "improve" a member — the freeze is transcription,
// not design.
//
// Zod authoring shape (CONTEXT.md "Claude's Discretion", recorded per plan
// 01-02's <output> instruction): schemas are authored zod-first, with the
// TypeScript type derived via `z.infer`, rather than declaring the type
// first and bolting a validator on beside it. `.parse()`/`.safeParse()` runs
// only at system boundaries (an HTTP body, a Prisma row becoming a domain
// object, a rule-pack JSON file loading) — never inside the Phase 2 engine's
// hot `assess()` path, so the AC-07(b) 100ms/50-line performance budget is
// unaffected by validation cost.

import { z } from "zod";

// ---------------------------------------------------------------------------
// ULID / ISO date / ISO date-time
// ---------------------------------------------------------------------------

export const UlidSchema = z.ulid();
export type ULID = z.infer<typeof UlidSchema>;

// "2026-08-20" — calendar date, no time component.
export const IsoDateSchema = z.iso.date();
export type ISODate = z.infer<typeof IsoDateSchema>;

// Server-generated, UTC. `offset: false` rejects an explicit timezone offset
// (e.g. "+08:00") so every stored/emitted datetime is unambiguously UTC —
// matching the PRD's "server-generated, UTC" comment on `ISODateTime`. A
// bare "Z" suffix (UTC, no offset) is accepted.
export const IsoDateTimeSchema = z.iso.datetime({ offset: false });
export type ISODateTime = z.infer<typeof IsoDateTimeSchema>;

// ---------------------------------------------------------------------------
// Minor — branded integer money type (PRD §6.0, §15)
// ---------------------------------------------------------------------------

// Every Minor-typed Prisma column (prisma/schema.prisma) is declared `Int` —
// Postgres's 4-byte `integer`, range ±2,147,483,647 — not `BigInt`. Bounding
// MinorSchema to match (WR-03) means a too-large value fails here, at the
// zod boundary, with a readable message, instead of surfacing as a raw
// Postgres integer-overflow error at the write. Widening the columns to
// `BigInt` was considered and rejected: it would reintroduce a second
// numeric representation into a codebase whose stated design goal is
// "integer minor units, no floats, one representation" end-to-end, and the
// largest legitimate fee here is a few thousand units of currency — 32 bits
// is ample headroom.
export const MINOR_MIN = -2_147_483_648;
export const MINOR_MAX = 2_147_483_647;

// PRD: `type Minor = number & { __brand: 'Minor' }`. zod 4's `.brand()`
// produces a structurally equivalent branded type — a bare `number` is not
// assignable to `Minor` without going through `MinorSchema.parse()` /
// `toMinor()` below. `.int()` rejects a non-integer input as a parse error;
// it is never silently rounded or coerced. `.min()`/`.max()` bound it to the
// 32-bit signed range every Minor-typed Prisma `Int` column actually has.
export const MinorSchema = z
  .number()
  .int()
  .min(MINOR_MIN, `Minor must be >= ${MINOR_MIN} (Postgres Int column floor)`)
  .max(MINOR_MAX, `Minor must be <= ${MINOR_MAX} (Postgres Int column ceiling)`)
  .brand<"Minor">();
export type Minor = z.infer<typeof MinorSchema>;

// The single sanctioned conversion point from a plain number to `Minor`.
// Prisma returns a plain `number` for an `Int` column — there is no way to
// make Prisma itself return the branded type — so `toMinor()` is called
// once, at the repository/mapper layer that turns a Prisma row into a
// domain object. Never scatter `as Minor` casts through the codebase.
export function toMinor(n: number): Minor {
  return MinorSchema.parse(n);
}

// ---------------------------------------------------------------------------
// Jurisdiction / currency
// ---------------------------------------------------------------------------

const JURISDICTION_CODES = ["SG", "HK", "AU", "NZ", "JP", "KR", "CN", "IN", "VN"] as const;
export const JurisdictionCodeSchema = z.enum(JURISDICTION_CODES);
export type JurisdictionCode = z.infer<typeof JurisdictionCodeSchema>;

const CURRENCY_CODES = ["SGD", "HKD", "AUD", "NZD", "JPY", "KRW", "CNY", "INR", "VND"] as const;
export const CurrencyCodeSchema = z.enum(CURRENCY_CODES);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

// Each jurisdiction has exactly one designated currency. A Matter's currency
// must equal this mapping's value for its jurisdictionCode (§8.1 step 1,
// AC-42). Deliberately not a per-pack field: it is a property of the
// jurisdiction, not of any one rule pack version. Exhaustive `Record` with no
// default branch — a missing or extra jurisdiction is a compile error.
export const JURISDICTION_CURRENCY: Record<JurisdictionCode, CurrencyCode> = {
  SG: "SGD",
  HK: "HKD",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  IN: "INR",
  VN: "VND",
};

// ---------------------------------------------------------------------------
// Controller type / role / staff grade
// ---------------------------------------------------------------------------

export const ControllerTypeSchema = z.enum(["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"]);
export type ControllerType = z.infer<typeof ControllerTypeSchema>;

export const RoleSchema = z.enum([
  "HR_PREPARER",
  "LEGAL_REVIEWER",
  "RULEPACK_AUTHOR",
  "DPO_ADMIN",
]);
export type Role = z.infer<typeof RoleSchema>;

export const StaffGradeSchema = z.enum([
  "ADMIN",
  "EXECUTIVE",
  "MANAGER",
  "SENIOR_MANAGER",
  "SPECIALIST",
]);
export type StaffGrade = z.infer<typeof StaffGradeSchema>;

// ---------------------------------------------------------------------------
// UserRef / Instrument / Citation
// ---------------------------------------------------------------------------

export const UserRefSchema = z.object({
  id: UlidSchema,
  displayName: z.string(),
  email: z.email(),
});
export type UserRef = z.infer<typeof UserRefSchema>;

export const InstrumentSchema = z.object({
  title: z.string(),
  provisions: z.array(z.string()),
  revised: z.string().optional(),
  url: z.string().optional(),
});
export type Instrument = z.infer<typeof InstrumentSchema>;

export const CitationSchema = z.object({
  instrument: z.string(),
  provision: z.string(),
  guidance: z.string().optional(),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

// ---------------------------------------------------------------------------
// Flag reason / matter flag
// ---------------------------------------------------------------------------

export const FlagReasonCodeSchema = z.enum([
  "NO_FEE_AUTHORITY",
  "CONDITIONS_NOT_MET",
  "POSSIBLE_DUPLICATE",
  "RATE_ABOVE_EXPECTED",
  "MATERIALITY",
  "DATA_QUALITY",
  "VENDOR_EVIDENCE_MISSING",
  "UNCATEGORISED",
  "AGGREGATE_CAP_APPLIED",
]);
export type FlagReasonCode = z.infer<typeof FlagReasonCodeSchema>;

// message ≤ 200 chars, per PRD §6.0.
export const FlagReasonSchema = z.object({
  code: FlagReasonCodeSchema,
  message: z.string().max(200),
});
export type FlagReason = z.infer<typeof FlagReasonSchema>;

export const MatterFlagCodeSchema = z.enum([
  "LITIGATION_POSTURE",
  "REPEAT_REQUEST",
  "STALE_PACK_WARNING",
  "NO_FEE_AUTHORITY_POSTURE",
  "PACK_FLAG", // PACK_FLAG = from matterFlagRules
  // D-11 (Phase 2 post-freeze amendment, packages/schemas/FREEZE.md) — NOT a
  // PRD §6.0 transcription. PRD §6.0 lists AGGREGATE_CAP_APPLIED among the
  // *line-level* FlagReasonCode values, and it stays there unmoved — this is
  // an additive sibling at matter level, not a relocation. It exists because
  // Phase 1's AssessmentLineSchema.superRefine is bidirectional (flagReasons
  // must be empty unless verdict is FLAG, and vice versa), so a line reduced
  // by the pack's aggregate cap cannot carry a line-level reason without
  // also being forced to verdict FLAG — which would drop its reduced amount
  // out of draftBaseline entirely (AC-11), silently changing the computed
  // fee rather than merely noting how it was computed. Loosening the
  // refinement was rejected: it would blur the property every later phase
  // relies on, that a non-empty flagReasons array means the line is flagged
  // and contributes nothing. Resolving the conflict additively — giving the
  // aggregate-cap notice a matter-level home instead — leaves the line-level
  // refinement, and the ALLOW_CAPPED verdict it protects, untouched.
  "AGGREGATE_CAP_APPLIED",
]);
export type MatterFlagCode = z.infer<typeof MatterFlagCodeSchema>;

export const MatterFlagSchema = z.object({
  id: z.string(), // stable, e.g. "SG.WRITTEN_ESTIMATE"
  code: MatterFlagCodeSchema,
  message: z.string(),
  requiresAcknowledgement: z.boolean(),
});
export type MatterFlag = z.infer<typeof MatterFlagSchema>;

// NOTE: `MatterFlagRule` is deliberately NOT declared here. Its `when` union
// has a `Condition` arm, and `Condition` cannot be frozen until `Matter` and
// `ExpenseLine` exist (01-RESEARCH.md, Architecture Patterns, Pattern 2). It
// is authored alongside `RulePack` in plan 01-06, which keeps the dependency
// pointing one way — rule packs depend on primitives, never the reverse.

// ---------------------------------------------------------------------------
// Audit event type (PRD §6.0 — all seventeen values; §6.5 gives the shape)
// ---------------------------------------------------------------------------

export const AuditEventTypeSchema = z.enum([
  "MATTER_CREATED",
  "LINE_ADDED",
  "LINE_EDITED",
  "LINE_DELETED",
  "SUBMITTED",
  "COMPUTED",
  "COMPUTE_FAILED",
  "LINE_DISPOSITIONED",
  "DISPOSITION_UNDONE",
  "INFO_REQUESTED",
  "FLAG_ACKNOWLEDGED",
  "SIGNED_OFF",
  "NOTICE_MARKED_SENT",
  "SUPERSEDED",
  "PACK_ACTIVATED",
  "PACK_EDITED",
  "CAPABILITY_STATEMENT_ACKNOWLEDGED",
  // 06-07 (REVIEW-11) — NOT a PRD §6.0 transcription. An additive
  // eighteenth value beyond the PRD's original seventeen, mirroring
  // MatterFlagCodeSchema's own AGGREGATE_CAP_APPLIED precedent (D-11): the
  // lawyer's flat-fee-vs-itemised choice is a real, auditable decision
  // affecting which figure the matter's fee ultimately resolves to, and
  // AUDIT-01 requires every consequential act to leave a trace.
  "FEE_CHOICE_SET",
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// ---------------------------------------------------------------------------
// Json — PRD §6.0's recursive Json type
// ---------------------------------------------------------------------------

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ])
);
