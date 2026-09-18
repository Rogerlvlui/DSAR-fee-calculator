// apps/web/app/api/matters/[id]/lines/route.ts
//
// Next 16 delivers route params as a promise — the context.params below
// must be awaited.

// Relative imports — see apps/web/app/api/matters/route.ts's module note.
import { addExpenseLine, type AddExpenseLineInput } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { errorToResponse } from "../../../../../src/server/errors.ts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as AddExpenseLineInput;
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const line = await addExpenseLine(actor, id, body);
    return Response.json(line, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
}
