// apps/web/app/api/assessments/[id]/supersede/route.ts
//
// A thin POST in the established shape: resolve the actor, call
// raiseCorrection(), map a thrown error to its status — the conflict
// status is what a lawyer sees if the matter is not signed off or closed.
// Returns 201: this creates a new resource (the correction), unlike
// recompute's 200 in-place mutation of an existing one.

import { raiseCorrection } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // decodeURIComponent: assessment ids are colon-joined and arrive
    // percent-encoded from Next's dynamic segment here — see the signoff
    // and recompute routes' own note.
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const correction = await raiseCorrection(actor, id);
    return Response.json(correction, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
