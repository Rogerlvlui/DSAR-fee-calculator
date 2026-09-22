// apps/web/app/api/matters/[id]/submit/route.ts
//
// COMPUTING -> calls the real engine over the real (demo-coerced) pack ->
// LEGAL_REVIEW. On an engine error, submitForAssessment itself returns the
// matter to DRAFT before rethrowing (PRD §10.7) — this handler only maps
// that outcome to a status code.

// Relative imports — see apps/web/app/api/matters/route.ts's module note.
import { submitForAssessment } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const assessment = await submitForAssessment(actor, id);
    return Response.json(assessment, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
