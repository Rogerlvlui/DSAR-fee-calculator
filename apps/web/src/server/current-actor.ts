// apps/web/src/server/current-actor.ts
//
// Reads the dsar_demo_role cookie through next/headers and returns the
// actor via resolveActorFromCookieHeader — the one place a page resolves an
// actor from request context, so apps/web/src/server/data/* stays free of
// request-context imports and therefore stays directly callable from tests.

import "./server-only.ts";
import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE, resolveActorFromCookieHeader, type DemoActor } from "./data/auth.ts";

export async function getCurrentActor(): Promise<DemoActor> {
  const cookieStore = await cookies();
  const value = cookieStore.get(DEMO_ROLE_COOKIE)?.value;
  const cookieHeader = value ? `${DEMO_ROLE_COOKIE}=${value}` : null;
  return resolveActorFromCookieHeader(cookieHeader);
}
