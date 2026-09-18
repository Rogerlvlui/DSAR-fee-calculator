// apps/web/src/server/state.ts
//
// `assertTransition(from, to)` over an explicit record of permitted edges.
// Phase 4 owns the real guarded executor over the frozen `GuardInput`
// (packages/schemas/src/guard-input.ts) — this is the minimal, explicit
// stand-in so no code path in this plan writes a status field unchecked in
// the meantime. Phase 4 replaces this; nothing should grow beside it.

import "./server-only.ts";
import type { MatterStatus } from "@dsar/schemas/matter-status";
import { ConflictError } from "./errors.ts";

// Only the edges the pipelines built so far exercise: DRAFT -> COMPUTING (on
// submit), COMPUTING -> LEGAL_REVIEW (on a successful assess()), and
// COMPUTING -> DRAFT (the PRD §10.7 engine-error rollback) from Plan 01/02;
// LEGAL_REVIEW -> SIGNED_OFF (sign-off) and LEGAL_REVIEW -> INFO_REQUEST
// (Ask HR), plus INFO_REQUEST -> COMPUTING (HR's re-submission re-running
// the same COMPUTING -> LEGAL_REVIEW edge above) from Plan 04. Phase 4 owns
// the real guarded executor over the frozen `GuardInput`; nothing should
// grow beside this beyond the edges an actual built pipeline exercises.
const PERMITTED_TRANSITIONS: Partial<Record<MatterStatus, readonly MatterStatus[]>> = {
  DRAFT: ["COMPUTING"],
  COMPUTING: ["LEGAL_REVIEW", "DRAFT"],
  LEGAL_REVIEW: ["SIGNED_OFF", "INFO_REQUEST"],
  INFO_REQUEST: ["COMPUTING"],
};

export function assertTransition(from: MatterStatus, to: MatterStatus): void {
  const allowed = PERMITTED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictError(`Matter cannot transition from ${from} to ${to}`);
  }
}
