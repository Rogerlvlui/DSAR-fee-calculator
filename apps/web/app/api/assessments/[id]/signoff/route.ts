// apps/web/app/api/assessments/[id]/signoff/route.ts
//
// A thin POST in the established shape: parse the body, resolve the actor,
// call signOff(), map a thrown error to its status. A conflict (already
// signed off, or the matter has left legal review) surfaces as 409 via
// ConflictError — errorToResponse maps it, this handler adds nothing.

import { signOff, type SignOffInput } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // decodeURIComponent: assessment ids are colon-joined and arrive
    // percent-encoded from Next's dynamic segment here — see the review
    // page's own note (apps/web/app/(legal)/assessments/[id]/page.tsx).
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const body = (await request.json()) as SignOffInput;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const result = await signOff(actor, id, body);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
