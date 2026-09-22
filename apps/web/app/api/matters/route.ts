// apps/web/app/api/matters/route.ts
//
// Thin: read and parse the JSON body, resolve the actor from the request's
// cookie header, call the one data-layer function, map the outcome to a
// status code. Plain Web Response objects, not NextResponse — importing
// next/server pulls Next internals into a plain Node test process for no
// benefit, and a Route Handler may return a standard response.

// Relative imports, not the "@/*" tsconfig alias: this module is imported
// directly by Vitest's "routes" project (tests/routes/*.test.ts), which
// resolves modules through Vite, not through Next's own webpack/Turbopack
// alias resolution — a relative import works identically under both.
import { createMatter, type CreateMatterInput } from "../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../src/server/errors.ts";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateMatterInput;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const matter = await createMatter(actor, body);
    return Response.json(matter, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
