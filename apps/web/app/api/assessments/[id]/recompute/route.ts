// apps/web/app/api/assessments/[id]/recompute/route.ts
//
// A thin POST in the established shape: resolve the actor, call
// recomputeAgainstCurrentPack(), map a thrown error to its status — the
// conflict status is what a lawyer sees if the matter has left legal
// review since the screen last loaded.

import { recomputeAgainstCurrentPack } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // decodeURIComponent: assessment ids are colon-joined and arrive
    // percent-encoded from Next's dynamic segment here — see the signoff
    // route's own note.
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const assessment = await recomputeAgainstCurrentPack(actor, id);
    return Response.json(assessment, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
