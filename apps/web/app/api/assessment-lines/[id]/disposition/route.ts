// apps/web/app/api/assessment-lines/[id]/disposition/route.ts
//
// A thin POST in the established shape (see
// apps/web/app/api/matters/[id]/lines/route.ts's module note on relative
// imports): parse the body, resolve the actor from the cookie header, call
// the data-layer function, map a thrown error to its status. Plain
// Response objects.

import { dispositionLine, type DispositionLineInput } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as DispositionLineInput;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const line = await dispositionLine(actor, id, body);
    return Response.json(line, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
