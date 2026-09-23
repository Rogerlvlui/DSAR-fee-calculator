// apps/web/src/server/data/auth.ts
//
// The stubbed-identity layer (CLAUDE.md's Prototype framing: identity
// stubbed, authorisation real). DEMO_USERS' three ids are freshly generated
// 26-character Crockford base32 ULIDs, each verified against UlidSchema
// before being committed here — not sourced from any prior fixture, since
// packages/engine's own PRD §14 fixture actors belong to that package, not
// this demo.

import "../server-only.ts";
import { RoleSchema, UserRefSchema, type Role, type UserRef } from "@dsar/schemas/primitives";
import { ForbiddenError } from "../errors.ts";

export interface DemoActor {
  user: UserRef;
  role: Role;
}

const HR_PREPARER_USER: UserRef = UserRefSchema.parse({
  id: "01K5GSD0HRPREPXQX2RZB4FDKV",
  displayName: "Priya Nair — HR Shared Services",
  email: "priya.nair@example.invalid",
});

// Combined identity (2026-09-23): this one person now covers both Legal
// review/sign-off (LEGAL_REVIEWER) and the audit-export capability
// (DPO_ADMIN) — see requireRole's call site in ./audit.ts, which accepts
// either role for that one gate. The separate "Wei Ling Ong — Data
// Protection Officer" demo identity (DPO_ADMIN_USER) that used to carry
// the latter is retired; DPO_ADMIN remains a valid Role value in the
// frozen schema, just with no demo persona attached to it any more.
const LEGAL_REVIEWER_USER: UserRef = UserRefSchema.parse({
  id: "01K5GSD0RVWRPBKRDPTJTHDN93",
  displayName: "Roger Lui — Privacy Lawyer, Singapore",
  email: "roger.lui@example.invalid",
});

export const DEMO_USERS: Record<"HR_PREPARER" | "LEGAL_REVIEWER", DemoActor> = {
  HR_PREPARER: { user: HR_PREPARER_USER, role: RoleSchema.parse("HR_PREPARER") },
  LEGAL_REVIEWER: { user: LEGAL_REVIEWER_USER, role: RoleSchema.parse("LEGAL_REVIEWER") },
};

export const DEMO_ROLE_COOKIE = "dsar_demo_role";

// Pure and header-driven, so a route-handler test can exercise every role
// without a real request context. Defaults to the HR actor when the cookie
// is absent or unrecognised — an unrecognised value must never become an
// escalation path to a more privileged identity.
export function resolveActorFromCookieHeader(cookieHeader: string | null): DemoActor {
  if (!cookieHeader) return DEMO_USERS.HR_PREPARER;
  const match = new RegExp(`(?:^|;\\s*)${DEMO_ROLE_COOKIE}=([^;]+)`).exec(cookieHeader);
  const value = match?.[1];
  if (value === "LEGAL_REVIEWER") return DEMO_USERS.LEGAL_REVIEWER;
  // "DPO_ADMIN" is deliberately NOT recognised here any more (2026-09-23):
  // that identity is retired, combined into LEGAL_REVIEWER above. An
  // unrecognised value falling back to the least-privileged preparer is
  // the correct outcome, not a gap — see tests/routes/audit-export.test.ts.
  return DEMO_USERS.HR_PREPARER;
}

// Called as the first statement of every function in src/server/data/ —
// never in middleware.ts (a documented bypass class) and never only at the
// page level (a page-level check does not extend to anything the request
// later calls).
//
// Accepts a single role (every call site but one) or an array of
// acceptable roles — the array form exists for ./audit.ts's exportAuditLog,
// whose one gate now accepts either DPO_ADMIN or LEGAL_REVIEWER since
// Roger's combined demo identity carries both (2026-09-23).
export function requireRole(actor: DemoActor, role: Role | Role[]): void {
  const allowed = Array.isArray(role) ? role : [role];
  if (allowed.includes(actor.role)) return;
  // Single-role message preserved byte-for-byte from before this function
  // accepted an array — several tests assert on this exact phrasing (e.g.
  // /HR_PREPARER role/, /LEGAL_REVIEWER role/).
  const message =
    allowed.length === 1
      ? `This action requires the ${allowed[0]} role`
      : `This action requires one of these roles: ${allowed.join(", ")}`;
  throw new ForbiddenError(message);
}
