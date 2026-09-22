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
// 07-04 widens the tracer's minimal view construction into the full one:
// also fetches the matter's expense lines (through the role-gated
// getExpenseLinesForLegalReview wrapper, never the repository directly, per
// this project's standing data-layer discipline) and computes the
// attestation text with the SAME renderAttestation() the legal review page
// and signOff() itself already call — mirrored here, not re-derived. The
// staleness flag is computed against the assessment's own recorded sign-off
// instant (never the current wall clock), so the same signed-off record
// renders byte-identically today and next year, regardless of when the PDF
// happens to be downloaded.
//
// The FIRST Route Handler in this codebase to return a non-JSON body — see
// 07-RESEARCH.md Code Example 3.

import { deriveEffectiveStatus } from "@dsar/rulepacks/stale";
import { ATTESTATION_TEMPLATE_VERSION, renderAttestation } from "../../../../../src/domain/attestation.ts";
import { getAssessmentForLegalReview } from "../../../../../src/server/data/assessments.ts";
import { getExpenseLinesForLegalReview, getMatterForLegalReview } from "../../../../../src/server/data/matters.ts";
import { resolveActorFromCookieHeader } from "../../../../../src/server/data/auth.ts";
import { resolvePinnedRulePack } from "../../../../../src/server/engine-invocation.ts";
import { ConflictError, errorToResponse } from "../../../../../src/server/errors.ts";
import { buildInternalRecordView } from "@dsar/documents/internal-record-view";
import { renderInternalRecordPdf } from "@dsar/documents/internal-record-document";

// CR-01 (07-REVIEW.md) — `matter.reference` is HR-controlled free text with
// no length limit and no character restriction (packages/schemas/src/matter.ts),
// so it must never be interpolated unescaped into an HTTP header value. A
// `"` in `reference` would otherwise break out of the quoted `filename`
// parameter and let a lower-privileged HR_PREPARER append arbitrary
// Content-Disposition parameters (e.g. `filename*`) that a LEGAL_REVIEWER's
// browser honors when saving this evidentiary PDF. Follows RFC 6266's own
// pattern: a plain-ASCII fallback `filename` (every non-alphanumeric,
// non-`.`/`_`/`-` character replaced, so no quote/semicolon/control
// character can ever reach the header raw) plus a percent-encoded
// `filename*=UTF-8''...` carrying the real reference for browsers that
// support it (`encodeURIComponent` — the runtime's `Headers` implementation
// already rejects literal CR/LF, so this only needs to neutralize the
// quote-breakout, not re-guard against header-splitting).
export function buildInternalRecordContentDisposition(reference: string): string {
  const asciiFallback = reference.replace(/[^A-Za-z0-9._-]/g, "_");
  const encodedReference = encodeURIComponent(reference);
  return (
    `attachment; filename="${asciiFallback}-internal-record.pdf"; ` +
    `filename*=UTF-8''${encodedReference}-internal-record.pdf`
  );
}

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
    const expenseLines = await getExpenseLinesForLegalReview(actor, assessment.matterId);
    const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);

    // Staleness evaluated against the sign-off's own recorded instant, not
    // `new Date()` — the record must be reproducible byte-for-byte on every
    // future download, not merely at the moment sign-off happened.
    const packIsStale = deriveEffectiveStatus(pack, assessment.signOff.signedAt) === "STALE";
    const attestationText = renderAttestation({
      jurisdiction: pack.jurisdiction.name,
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      reviewedOn: pack.reviewedOn,
      packIsStale,
    });

    const view = buildInternalRecordView({
      assessment,
      matter,
      pack,
      expenseLines,
      attestation: { text: attestationText, version: ATTESTATION_TEMPLATE_VERSION },
    });
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
        "content-disposition": buildInternalRecordContentDisposition(matter.reference),
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
