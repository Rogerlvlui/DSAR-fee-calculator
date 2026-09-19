// packages/audit/src/payload-builders.ts
//
// One small typed builder per audit event kind, each returning the frozen
// AuditPayload type (packages/schemas/src/audit-event.ts's single,
// already-frozen z.strictObject). A builder that tried to carry a sixth key
// would fail the type check before it ever reached the runtime rejection —
// two independent layers catching the same mistake. The repository compiles
// with exact optional property types, so a builder omits a key it has no
// value for rather than setting it to undefined.
//
// Task 1 authored the transition builder; this task (Task 2) adds the
// disposition, sign-off and information-request builders the writer's
// elapsedReviewMs enforcement (memory/audit-event-writer.ts) requires two
// of these to carry.

import type { AuditPayload } from "@dsar/schemas/audit-event";

export function transitionPayload(before: string, after: string): AuditPayload {
  return { field: "status", before, after };
}

export interface DispositionPayloadArgs {
  lineId: string;
  before: string; // prior disposition
  after: string; // new disposition
  elapsedReviewMs: number;
}

// AUDIT-03: LINE_DISPOSITIONED is one of the two event types the writer
// refuses to append without an elapsedReviewMs figure — required here, not
// optional, so a caller cannot construct a payload the writer will reject.
export function dispositionPayload(args: DispositionPayloadArgs): AuditPayload {
  return {
    entityId: args.lineId,
    field: "disposition",
    before: args.before,
    after: args.after,
    elapsedReviewMs: args.elapsedReviewMs,
  };
}

// AUDIT-03: SIGNED_OFF is the other event type the writer requires an
// elapsedReviewMs figure on. field: "status" (not "signOff") — a sign-off
// IS a status transition (LEGAL_REVIEW -> SIGNED_OFF), the same shape
// transitionPayload's before/after pair already uses for every other
// transition in this log. Not yet called by any production code when this
// builder was first authored (04-01) — plan 04-04's signOff conversion is
// its first real caller, which is why this signature widened from a bare
// elapsedReviewMs to also carry the before/after pair before that first
// use, rather than after.
export function signOffPayload(before: string, after: string, elapsedReviewMs: number): AuditPayload {
  return { field: "status", before, after, elapsedReviewMs };
}

export interface InformationRequestPayloadArgs {
  assessmentLineId: string;
  query: string;
}

// The information-request builder: entityId names the assessment line the
// query concerns, and the query text itself is the only "after" value an
// INFO_REQUESTED event has — there is no prior state to carry as `before`.
export function informationRequestPayload(args: InformationRequestPayloadArgs): AuditPayload {
  return {
    entityId: args.assessmentLineId,
    field: "infoRequest",
    after: args.query,
  };
}

// Plan 04-03's two pack-lifecycle builders. Both return the same frozen
// AuditPayload type as every builder above — the pack-lifecycle stream
// (packages/audit/src/memory/pack-lifecycle-event-writer.ts) validates
// against this identical schema, never a second one, so a sixth key fails
// the type check here before it could ever reach a runtime rejection.

// A pack activation's changed field is the pack's own lifecycle status
// (e.g. "draft" -> "active"), carried as the before/after pair.
export function packActivatedPayload(before: string, after: string): AuditPayload {
  return { field: "status", before, after };
}

// A pack edit names the field that changed on the pack; it carries no
// before/after pair of its own — the edited value lives in the pack's own
// versioned JSON, not duplicated into the audit payload.
export function packEditedPayload(field: string): AuditPayload {
  return { field };
}
