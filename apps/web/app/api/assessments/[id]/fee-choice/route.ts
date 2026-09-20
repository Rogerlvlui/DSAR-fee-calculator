// apps/web/app/api/assessments/[id]/fee-choice/route.ts
//
// A thin POST mirroring bulk-accept/recompute's own established shape:
// resolve the actor, decodeURIComponent the id, parse {choice} from the
// body, call setFeeChoice, map the outcome through errorToResponse.

import { setFeeChoice } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

interface FeeChoiceBody {
  choice: "ITEMISED" | "FLAT";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const body = (await request.json()) as FeeChoiceBody;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const assessment = await setFeeChoice(actor, id, body.choice);
    return Response.json(assessment, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
