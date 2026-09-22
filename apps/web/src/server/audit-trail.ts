// apps/web/src/server/audit-trail.ts
//
// The one function the data layer calls to record a matter-scoped audit
// event. Stamps the server time itself — never a client-supplied one
// (§6.5, T-04-02) — and the caller awaits it before returning success: the
// write is never best-effort.

import "./server-only.ts";
import type { AuditEventType } from "@dsar/schemas/primitives";
import type { AuditPayload } from "@dsar/schemas/audit-event";
import { memoryAuditEventWriter } from "@dsar/audit/memory/audit-event-writer";
import type { DemoActor } from "./data/auth.ts";

export interface RecordAuditEventArgs {
  matterId: string;
  actor: DemoActor;
  type: AuditEventType;
  payload: AuditPayload;
  rulePackVersion: string | null;
  engineVersion: string | null;
}

export async function recordAuditEvent(args: RecordAuditEventArgs): Promise<void> {
  const { matterId, actor, type, payload, rulePackVersion, engineVersion } = args;
  await memoryAuditEventWriter.append({
    matterId,
    actor: actor.user,
    actorRole: actor.role,
    at: new Date().toISOString(),
    type,
    payload,
    rulePackVersion,
    engineVersion,
  });
}
