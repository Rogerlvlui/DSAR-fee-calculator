// apps/web/src/domain/attestation.ts
//
// PRD §9.5's sign-off attestation, transcribed exactly, plus the one
// interpolation decision this phase's real pack forces: the committed
// SG-PDPA pack's `reviewedOn` is null (counsel has not yet recorded a
// review date — D-16 defers full authoring to before Phase 6), so the
// wording renders an explicit "not yet recorded" phrase in that slot rather
// than an empty gap or a fabricated date. The attestation's own wording is
// never altered to accommodate that; only the interpolated value is. Where
// the pack is STALE (never true for this demo's real pack — its
// reviewDueOn, 2027-03-12, is far in the future), PRD §9.5's second sentence
// is appended verbatim.
//
// Pure and lives under src/domain/ so both the sign-off data-layer function
// (apps/web/src/server/data/assessments.ts) and the sign-off panel
// (apps/web/src/ui/review/signoff-panel.tsx) read the exact same wording —
// neither hand-copies a second string that could drift from this one.

// Not a PRD §6.4 field — this is a version tag for THIS wording, distinct
// from any rule pack's own version, so a later reword of the template below
// can be told apart from the pack that was reviewed under an earlier one.
export const ATTESTATION_TEMPLATE_VERSION = "SIGNOFF-ATTESTATION-2026.09";

// The phrase rendered in the "reviewed {reviewedOn}" slot when the pack's
// own reviewedOn is null — an explicit statement of the gap, never an empty
// string and never a fabricated date.
export const REVIEWED_ON_NOT_RECORDED = "not yet recorded";

// A visible note the sign-off panel surfaces alongside the attestation box
// whenever reviewedOn is null — distinct from the attestation wording
// itself, which is never altered to carry this explanation.
export const REVIEWED_ON_NOT_RECORDED_NOTE =
  "This rule pack has no recorded review date yet — counsel has not authored one.";

export interface RenderAttestationInput {
  jurisdiction: string;
  packId: string;
  packVersion: string;
  reviewedOn: string | null;
  packIsStale: boolean;
}

// PRD §9.5, quoted verbatim except for the four interpolation points named
// in curly braces there ({jurisdiction}, {packId}, {version}, {reviewedOn}).
export function renderAttestation({
  jurisdiction,
  packId,
  packVersion,
  reviewedOn,
  packIsStale,
}: RenderAttestationInput): string {
  const reviewedOnText = reviewedOn ?? REVIEWED_ON_NOT_RECORDED;
  const base =
    `I am reviewing this fee assessment as a qualified lawyer for ${jurisdiction}. ` +
    `I have considered each line item and the flagged items individually. ` +
    `I have applied my own judgement to the amounts I have allowed, and I do not rely on the tool's calculation as legal advice. ` +
    `Rule pack ${packId} ${packVersion}, reviewed ${reviewedOnText}.`;

  if (!packIsStale) return base;

  return `${base} I am aware this rule pack is past its review date and I have satisfied myself as to the current position.`;
}
