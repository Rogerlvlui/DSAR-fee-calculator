// apps/web/app/api/matters/[id]/notice-sent/route.ts
//
// A thin POST in the established shape. Sends nothing — there is no
// outbound email of any kind anywhere in this system (NS-3); this only
// records the date HR says they sent the notice themselves.

import { markNoticeSent } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const result = await markNoticeSent(actor, id);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
