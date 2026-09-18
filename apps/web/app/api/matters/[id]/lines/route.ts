// apps/web/app/api/matters/[id]/lines/route.ts
//
// Next 16 delivers route params as a promise — the context.params below
// must be awaited. This route has no [lineId] path segment, so PUT/DELETE
// identify the line via a `lineId` field in the JSON body, in the same thin
// shape as POST.

// Relative imports — see apps/web/app/api/matters/route.ts's module note.
import {
  addExpenseLine,
  deleteExpenseLine,
  replaceExpenseLine,
  type AddExpenseLineInput,
} from "../../../../../src/server/data/matters.ts";
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as AddExpenseLineInput & { lineId: string };
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    const line = await replaceExpenseLine(actor, id, body.lineId, body);
    return Response.json(line, { status: 200 });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { lineId: string };
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));
    await deleteExpenseLine(actor, id, body.lineId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorToResponse(error);
  }
}
