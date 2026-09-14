// packages/schemas/src/matter-status.ts
//
// PRD §5 — the seven-value MatterStatus lifecycle. "No other status value
// exists anywhere in the system" (STATE-01). Declared in lifecycle order
// because plan 01-03 mirrors this same tuple into a native Postgres enum,
// asserted equal member-for-member.

import { z } from "zod";

export const MATTER_STATUSES = [
  "DRAFT",
  "COMPUTING",
  "LEGAL_REVIEW",
  "INFO_REQUEST",
  "SIGNED_OFF",
  "CLOSED",
  "SUPERSEDED",
] as const;

export const MatterStatusSchema = z.enum(MATTER_STATUSES);
export type MatterStatus = z.infer<typeof MatterStatusSchema>;
