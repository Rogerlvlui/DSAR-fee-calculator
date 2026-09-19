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
// elapsedReviewMs figure on.
export function signOffPayload(elapsedReviewMs: number): AuditPayload {
  return { field: "signOff", after: "SIGNED_OFF", elapsedReviewMs };
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
