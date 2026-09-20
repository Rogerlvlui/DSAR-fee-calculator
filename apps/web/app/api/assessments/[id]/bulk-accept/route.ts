// apps/web/app/api/assessments/[id]/bulk-accept/route.ts
//
// A thin POST in the established shape: parse the body, resolve the actor,
// call bulkAcceptLines(), map a thrown error to its status. All-or-nothing
// is enforced inside bulkAcceptLines() itself — this handler only maps the
// outcome.

import { bulkAcceptLines, type BulkAcceptInput } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // decodeURIComponent: assessment ids are colon-joined and arrive
    // percent-encoded from Next's dynamic segment here — see the review
    // page's own note (apps/web/app/legal/assessments/[id]/page.tsx).
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const body = (await request.json()) as BulkAcceptInput;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const lines = await bulkAcceptLines(actor, id, body);
    return Response.json(lines, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
