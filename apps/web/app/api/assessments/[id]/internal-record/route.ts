// apps/web/app/api/assessments/[id]/internal-record/route.ts
//
// GET only, LEGAL_REVIEWER only. Copies the sign-off route's control flow:
// await context.params, decodeURIComponent the id (assessment ids are
// colon-joined and arrive percent-encoded — see the legal review page's own
// note), resolve the actor from the cookie header, then delegate to
// getAssessmentForLegalReview so the role gate lives in the data layer, not
// this route's own branching. Refuses with 409 BEFORE building anything if
// the assessment carries no sign-off record — PRD §0 non-negotiable #3: no
// output leaves the system without a named lawyer's sign-off. The catch
// block delegates to the same errorToResponse every other route uses;
// nothing else.
//
// The FIRST Route Handler in this codebase to return a non-JSON body — see
// 07-RESEARCH.md Code Example 3.

import { getAssessmentForLegalReview } from "../../../../../src/server/data/assessments.ts";
import { getMatterForLegalReview } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { resolvePinnedRulePack } from "../../../../../src/server/engine-invocation.ts";
import { ConflictError, errorToResponse } from "../../../../../src/server/errors.ts";
import { buildInternalRecordView } from "@dsar/documents/internal-record-view";
import { renderInternalRecordPdf } from "@dsar/documents/internal-record-document";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId);
    const actor = resolveActorFromCookieHeader(request.headers.get("cookie"));

    const assessment = await getAssessmentForLegalReview(actor, id);
    if (!assessment.signOff) {
      throw new ConflictError(
        `Assessment '${id}' has no sign-off record — the internal record is generated only after sign-off`
      );
    }

    const matter = await getMatterForLegalReview(actor, assessment.matterId);
    const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);

    const view = buildInternalRecordView(assessment, matter, pack);
    const buffer = await renderInternalRecordPdf(view);
    // Node's Buffer is a Uint8Array<ArrayBufferLike> subclass at runtime,
    // but TS 6's generic-Uint8Array lib types BodyInit's BufferSource arm as
    // Uint8Array<ArrayBuffer> specifically — a Buffer (or a view over its
    // ArrayBufferLike backing) does not structurally satisfy that narrower
    // generic. Copying into a fresh, plain Uint8Array (backed by a concrete
    // ArrayBuffer) satisfies BodyInit cleanly, at the cost of one copy.
    const body = new Uint8Array(buffer);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${matter.reference}-internal-record.pdf"`,
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
