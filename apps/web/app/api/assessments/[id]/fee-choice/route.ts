// apps/web/app/api/assessments/[id]/fee-choice/route.ts
//
// A thin POST mirroring bulk-accept/recompute's own established shape:
// resolve the actor, decodeURIComponent the id, parse {choice} from the
// body, call setFeeChoice, map the outcome through errorToResponse.
//
// WR-01: the body is parsed through FeeChoiceRequestSchema (wrapping the
// shared FeeChoiceSchema enum) BEFORE it ever reaches setFeeChoice — a
// bare type assertion let any string fall through setFeeChoice's own
// `choice === "FLAT"` check unblocked and get written straight into the
// audited feeChoice field. A malformed body now fails here, as a ZodError
// errorToResponse already maps to 400, and never reaches the repository.

import { z } from "zod";
import { FeeChoiceSchema } from "@dsar/schemas/assessment";
import { setFeeChoice } from "../../../../../src/server/data/assessments.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

const FeeChoiceRequestSchema = z.strictObject({ choice: FeeChoiceSchema });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const rawBody: unknown = await request.json();
    const body = FeeChoiceRequestSchema.parse(rawBody);
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const assessment = await setFeeChoice(actor, id, body.choice);
    return Response.json(assessment, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}
