// apps/web/app/api/matters/[id]/info-request/route.ts
//
// A thin POST in the established shape. The path's `[id]` names the
// matter (the REST resource this creates an information request against);
// the specific line the lawyer's query concerns is named in the body,
// because askHr() resolves the assessment and its matter FROM the line id
// (the same lookup dispositionLine() already uses) — the path segment is
// not re-derived from it, it is simply the matter-scoped resource shape.

import { askHr, type AskHrInput } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    await context.params; // matterId — not needed by askHr(), which resolves via the line id below.
    const body = (await request.json()) as AskHrInput & { assessmentLineId: string };
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const infoRequest = await askHr(actor, body.assessmentLineId, { query: body.query });
    return Response.json(infoRequest, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
