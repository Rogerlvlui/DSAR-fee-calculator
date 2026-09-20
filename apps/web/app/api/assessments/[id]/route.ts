// apps/web/app/api/assessments/[id]/route.ts
//
// AC-01's literal GET /api/assessments/{id} route — did not exist before
// this plan; the legal-review page fetched an assessment only inside its
// own server-component body. A thin GET in the same established shape as
// ./signoff/route.ts's POST: resolve the actor, decodeURIComponent the
// colon-joined id, call the one already-gated data-layer function, map the
// outcome through errorToResponse. No new authorization logic of its own —
// getAssessmentForLegalReview already gates on the LEGAL_REVIEWER role as
// its first statement, so this route is LEGAL_REVIEWER-only regardless
// of the matter's own status, and an HR_PREPARER's 403 body (via
// errorToResponse's ForbiddenError mapping) carries only a message string,
// never assessment data.

import { getAssessmentForLegalReview } from "../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../src/server/errors.ts";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // decodeURIComponent: assessment ids are colon-joined and arrive
    // percent-encoded from Next's dynamic segment — see the review page's
    // own note (apps/web/app/legal/assessments/[id]/page.tsx).
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const assessment = await getAssessmentForLegalReview(actor, id);
    return Response.json(assessment, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
