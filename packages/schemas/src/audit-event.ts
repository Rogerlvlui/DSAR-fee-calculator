// packages/schemas/src/audit-event.ts
//
// PRD §6.5 AuditEvent — transcription, not design. Append-only: no updates,
// no deletes, at the database level (AC-34, enforced by GRANT/REVOKE in
// Phase 3.2, not by this schema).
//
// §12.1, final bullet: the payload stores only the fields that changed,
// from a closed declared set — never a whole request body, never anything
// the user did not type into a declared field. A key not in this schema is
// a validation error, so a future field cannot quietly start being
// archived forever in a table that cannot be deleted from. AUDIT_PAYLOAD_KEYS
// is the single source for that closed set; the payload schema is derived
// from it, not restated.
//
// Elapsed review time is required on LINE_DISPOSITIONED and SIGNED_OFF
// (§6.5), measured from when the reviewer first opened the assessment. It
// is a signal of automation bias, not surveillance of the lawyer — the
// enforcement of its presence on those two event types is AUDIT-03,
// Phase 4's.

import { z } from "zod";
import {
  AuditEventTypeSchema,
  IsoDateTimeSchema,
  JsonSchema,
  RoleSchema,
  UserRefSchema,
} from "./primitives.ts";

// The closed declared set of keys AuditEvent.payload may carry: the entity
// id the change applies to, the changed field name, the before/after pair,
// and elapsedReviewMs (required on LINE_DISPOSITIONED and SIGNED_OFF).
export const AUDIT_PAYLOAD_KEYS = [
  "entityId",
  "field",
  "before",
  "after",
  "elapsedReviewMs",
] as const;

// Every member optional — a given event type populates only the keys that
// apply to it. z.strictObject rejects any key outside this set, rather than
// silently stripping it, so an undeclared key is a validation error.
export const AuditPayloadSchema = z.strictObject({
  entityId: z.string().optional(),
  field: z.string().optional(),
  before: JsonSchema.optional(),
  after: JsonSchema.optional(),
  elapsedReviewMs: z.number().int().nonnegative().optional(),
});
export type AuditPayload = z.infer<typeof AuditPayloadSchema>;

export const AuditEventSchema = z.object({
  id: z.string(), // monotonic
  matterId: z.string(),
  actor: UserRefSchema,
  actorRole: RoleSchema,
  // Server time, never client time (§6.5).
  at: IsoDateTimeSchema,
  type: AuditEventTypeSchema,
  payload: AuditPayloadSchema,
  rulePackVersion: z.string().nullable(),
  engineVersion: z.string().nullable(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
