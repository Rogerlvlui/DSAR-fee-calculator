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
// This plan (Task 1) authors the transition builder only; the disposition,
// sign-off and information-request builders land in Task 2.

import type { AuditPayload } from "@dsar/schemas/audit-event";

export function transitionPayload(before: string, after: string): AuditPayload {
  return { field: "status", before, after };
}
