// apps/web/src/server/data/auth.ts
//
// The stubbed-identity layer (CLAUDE.md's Prototype framing: identity
// stubbed, authorisation real). DEMO_USERS' two ids are freshly generated
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

const LEGAL_REVIEWER_USER: UserRef = UserRefSchema.parse({
  id: "01K5GSD0RVWRPBKRDPTJTHDN93",
  displayName: "Marcus Tan — Legal, Singapore",
  email: "marcus.tan@example.invalid",
});

export const DEMO_USERS: Record<"HR_PREPARER" | "LEGAL_REVIEWER", DemoActor> = {
  HR_PREPARER: { user: HR_PREPARER_USER, role: RoleSchema.parse("HR_PREPARER") },
  LEGAL_REVIEWER: { user: LEGAL_REVIEWER_USER, role: RoleSchema.parse("LEGAL_REVIEWER") },
};

export const DEMO_ROLE_COOKIE = "dsar_demo_role";

// Pure and header-driven, so a route-handler test can exercise both roles
// without a real request context. Defaults to the HR actor when the cookie
// is absent or unrecognised.
export function resolveActorFromCookieHeader(cookieHeader: string | null): DemoActor {
  if (!cookieHeader) return DEMO_USERS.HR_PREPARER;
  const match = new RegExp(`(?:^|;\\s*)${DEMO_ROLE_COOKIE}=([^;]+)`).exec(cookieHeader);
  const value = match?.[1];
  if (value === "LEGAL_REVIEWER") return DEMO_USERS.LEGAL_REVIEWER;
  return DEMO_USERS.HR_PREPARER;
}

// Called as the first statement of every function in src/server/data/ —
// never in middleware.ts (a documented bypass class) and never only at the
// page level (a page-level check does not extend to anything the request
// later calls).
export function requireRole(actor: DemoActor, role: Role): void {
  if (actor.role !== role) {
    throw new ForbiddenError(`This action requires the ${role} role`);
  }
}
