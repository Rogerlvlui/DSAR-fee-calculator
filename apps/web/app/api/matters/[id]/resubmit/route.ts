// apps/web/app/api/matters/[id]/resubmit/route.ts
//
// A thin POST in the established shape: no body to parse — HR re-submits
// the matter as a whole once its lines have been edited, not a single line.

import { resubmitAfterInfoRequest } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const assessment = await resubmitAfterInfoRequest(actor, id);
    return Response.json(assessment, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
