// apps/web/src/domain/audit-detail.ts
//
// composeAuditEventDetail — a pure function turning one AuditEvent's
// payload into a single plain-word sentence for the Audit trail screen's
// Detail column (07.1-02-PLAN.md Task 1). Reads only the closed
// AUDIT_PAYLOAD_KEYS set by name (entityId/field/before/after/
// elapsedReviewMs, packages/schemas/src/audit-event.ts) and never calls
// JSON.stringify or spreads the payload object into the returned string —
// the closed-set discipline that makes a future, currently-unimagined
// payload key structurally unable to leak here (T-07.1-02-03). An
// object-shaped before/after (e.g. payload-builders.ts's
// expenseLineAddedPayload snapshot) renders as a fixed placeholder rather
// than a dumped structure, for the same reason.

import type { AuditPayload } from "@dsar/schemas/audit-event";
import type { Json } from "@dsar/schemas/primitives";

export const NO_AUDIT_DETAIL_SENTENCE = "No further detail recorded for this event.";

function formatJsonValue(value: Json): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // An object/array-shaped before/after (e.g. an expense-line snapshot) —
  // rendered as a fixed placeholder rather than a dumped structure, so this
  // function can never leak a JSON-looking `{"` substring onto the page.
  return "a structured value";
}

export function composeAuditEventDetail(payload: AuditPayload): string {
  const sentences: string[] = [];

  if (payload.field !== undefined) {
    sentences.push(`Changed ${payload.field}`);
  }

  if (payload.before !== undefined && payload.after !== undefined) {
    sentences.push(`from ${formatJsonValue(payload.before)} to ${formatJsonValue(payload.after)}`);
  } else if (payload.after !== undefined) {
    sentences.push(`to ${formatJsonValue(payload.after)}`);
  } else if (payload.before !== undefined) {
    sentences.push(`from ${formatJsonValue(payload.before)}`);
  }

  if (payload.entityId !== undefined) {
    sentences.push(`(entity ${payload.entityId})`);
  }

  if (payload.elapsedReviewMs !== undefined) {
    sentences.push(`— review took ${payload.elapsedReviewMs}ms`);
  }

  if (sentences.length === 0) {
    return NO_AUDIT_DETAIL_SENTENCE;
  }

  return sentences.join(" ");
}
