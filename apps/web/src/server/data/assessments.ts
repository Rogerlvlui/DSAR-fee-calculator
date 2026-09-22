// apps/web/src/server/data/assessments.ts

import "../server-only.ts";
import type { Assessment, AssessmentLine, SignOff } from "@dsar/schemas/assessment";
import { MinorSchema, type Minor, type UserRef } from "@dsar/schemas/primitives";
import { FREE_TEXT_LIMITS } from "@dsar/schemas/constants";
import { deriveEffectiveStatus } from "@dsar/rulepacks/stale";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors.ts";
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryAssessmentRepository } from "../repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../repositories/memory/matter-repository.ts";
import { assessMatter, coercePackForDemoEngine, resolvePinnedRulePack } from "../engine-invocation.ts";
import type { LoadableRulePack } from "@dsar/schemas/rule-pack";
import { newUlid } from "../ids.ts";
import { elapsedReviewMs, recordAssessmentOpened } from "@dsar/audit/review-session";
import {
  dispositionPayload,
  feeChoicePayload,
  informationRequestPayload,
  signOffPayload,
  supersededPayload,
} from "@dsar/audit/payload-builders";
import { memoryPackLifecycleEventWriter } from "@dsar/audit/memory/pack-lifecycle-event-writer";
import { recordAuditEvent } from "../audit-trail.ts";
import { buildGuardInput } from "../guard-input.ts";
import { evaluateTransition } from "@dsar/workflow/evaluate-transition";
import {
  hasSufficientAndGenuineReason,
  isActionPermitted,
  matchesReasonStopList,
  MIN_REASON_NON_WHITESPACE_CHARS,
  type DispositionAction,
} from "../../domain/disposition-actions.ts";
import { computeFinalAmount } from "../../domain/review-tallies.ts";
import { ATTESTATION_TEMPLATE_VERSION, renderAttestation } from "../../domain/attestation.ts";
import type { InfoRequest } from "../../domain/info-request.ts";

// Fetches the matter for an assessment and refuses (409) unless it is in
// legal review — the state precondition dispositionLine, bulkAcceptLines
// and signOff all share, so all three refuse with a conflict while the
// matter sits in the information-requested state (T-03.1-26).
async function requireAssessmentInLegalReview(assessment: Assessment) {
  const matter = await memoryMatterRepository.getMatter(assessment.matterId);
  if (!matter) throw new NotFoundError(`No matter found for assessment '${assessment.id}'`);
  if (matter.status !== "LEGAL_REVIEW") {
    throw new ConflictError(
      `Matter '${matter.id}' is not in legal review (currently ${matter.status}) — this action is refused`
    );
  }
  return matter;
}

// Records the assessment as first opened, at the server's current instant,
// on every read (AUDIT-03) — recordAssessmentOpened() is idempotent and
// keeps the earliest instant, so a lawyer reloading the screen does not
// reset their own clock. This is the only place the elapsed-review origin
// is established.
export async function getAssessmentForLegalReview(
  actor: DemoActor,
  assessmentId: string
): Promise<Assessment> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);
  recordAssessmentOpened(assessment.id, new Date().toISOString());
  return assessment;
}

// PRD §0 non-negotiable #2, enforced here in the data layer rather than by
// hiding a link: HR never sees an unreviewed assessment. Widened (04-05
// Task 2) to also permit CLOSED: once marking the notice sent closes the
// matter, a closed matter is still a signed one, and the preparer must not
// lose sight of the figure they were just shown the moment it closes.
// Every earlier status still refuses exactly as before.
const HR_VISIBLE_MATTER_STATUSES: ReadonlySet<string> = new Set(["SIGNED_OFF", "CLOSED"]);

export async function getSignedOffAssessmentForHr(
  actor: DemoActor,
  matterId: string
): Promise<Assessment> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (!HR_VISIBLE_MATTER_STATUSES.has(matter.status)) {
    throw new ForbiddenError(
      `Matter '${matterId}' has not been signed off (currently ${matter.status}) — HR may not see an assessment before sign-off`
    );
  }

  const assessment = await memoryAssessmentRepository.getAssessmentByMatterId(matterId);
  if (!assessment) throw new NotFoundError(`No assessment found for matter '${matterId}'`);
  return assessment;
}

// Every disposition requires a reason, uniformly, on the server — Annex A
// varies the reason LABEL by verdict ("required" / "required if you change
// the amount" / "required to allow anyway"), and disposition-controls.tsx
// renders those labels verbatim, but the rule this function enforces is the
// same for every action on every verdict, because this phase's success
// criterion 3 states it plainly: every disposition demands its reason.
// AC-23's stop-list check runs FIRST, before the length check — a deliberate
// deviation from a length-then-stop-list ordering (06-05-PLAN.md's own
// literal action text): every one of REASON_STOP_LIST's 11 entries is under
// the 10-non-whitespace-character length minimum on its own (the longest,
// "agreed", is 6), so a length-first ordering would make the stop-list
// branch below permanently unreachable dead code — any bare stop-list
// phrase would always be caught by the length check first, and the two
// error messages could never actually differ for any real request. Stop-
// list first mirrors this same function's client-side counterpart
// (disposition-controls.tsx/bulk-accept-bar.tsx also check stop-list before
// length, per their own module comment) and is what makes this file's own
// acceptance criterion — a route test can tell which check refused a given
// request, by a genuinely distinct message — actually achievable.
//
// IN-01: gated on the shared hasSufficientAndGenuineReason() first, rather
// than reimplementing "stop-list OR too short" a second, independent way —
// the two sub-checks below run only to pick which specific message to
// throw once the combined check has already failed.
function assertSufficientReason(reason: string): void {
  if (!hasSufficientAndGenuineReason(reason)) {
    const stopListMatch = matchesReasonStopList(reason);
    if (stopListMatch !== null) {
      throw new ValidationError(`Reason '${stopListMatch}' is a stock phrase, not a reason`);
    }
    throw new ValidationError(
      `Reason must have at least ${MIN_REASON_NON_WHITESPACE_CHARS} non-whitespace characters`
    );
  }
  if (reason.length > FREE_TEXT_LIMITS.lawyerReason) {
    throw new ValidationError(`Reason must not exceed ${FREE_TEXT_LIMITS.lawyerReason} characters`);
  }
}

export interface DispositionLineInput {
  action: DispositionAction;
  amountMinor?: number;
  reason: string;
}

// requireRole first, then validate in order — action-permitted-for-verdict,
// then the reason, then (where the action carries one) the amount — and
// refuse with a typed error at the FIRST failure. A refusal writes nothing
// at all: the line stays exactly as it was, which route tests prove by
// re-reading the stored line after every refusal (T-03.1-13, T-03.1-14).
export async function dispositionLine(
  actor: DemoActor,
  assessmentLineId: string,
  input: DispositionLineInput
): Promise<AssessmentLine> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.findByLineId(assessmentLineId);
  if (!assessment) throw new NotFoundError(`No assessment line with id '${assessmentLineId}'`);
  const line = assessment.lines.find((candidate) => candidate.id === assessmentLineId);
  if (!line) throw new NotFoundError(`No assessment line with id '${assessmentLineId}'`);

  await requireAssessmentInLegalReview(assessment);

  if (!isActionPermitted(line.verdict, input.action)) {
    throw new ValidationError(`Action '${input.action}' is not permitted for a '${line.verdict}' line`);
  }

  assertSufficientReason(input.reason);

  const expenseLines = await memoryMatterRepository.listExpenseLines(assessment.matterId);
  const expenseLine = expenseLines.find((candidate) => candidate.id === line.expenseLineId);
  if (!expenseLine) throw new NotFoundError(`No expense line with id '${line.expenseLineId}'`);

  let disposition: AssessmentLine["disposition"];
  let lawyerAmount: Minor | null = null;

  switch (input.action) {
    case "ACCEPT": {
      disposition = "ACCEPTED";
      break;
    }
    case "STRIKE": {
      disposition = "STRUCK";
      break;
    }
    case "REDUCE": {
      const amount = MinorSchema.parse(input.amountMinor);
      if (amount < 0) throw new ValidationError("Reduced amount must not be negative");
      if (amount > line.engineAmount) {
        throw new ValidationError("Reduced amount must not exceed the engine's own amount for this line");
      }
      if (amount > expenseLine.claimedAmount) {
        throw new ValidationError("Reduced amount must not exceed the line's claimed amount");
      }
      disposition = "REDUCED";
      lawyerAmount = amount;
      break;
    }
    case "ALLOW_WITH_AMOUNT":
    case "ALLOW_ANYWAY": {
      const amount = MinorSchema.parse(input.amountMinor);
      if (amount < 0) throw new ValidationError("Allowed amount must not be negative");
      if (amount > expenseLine.claimedAmount) {
        throw new ValidationError("Allowed amount must not exceed the line's claimed amount");
      }
      disposition = "ALLOWED_BY_LAWYER";
      lawyerAmount = amount;
      break;
    }
  }

  const priorDisposition = line.disposition;
  const updatedLine: AssessmentLine = {
    ...line,
    disposition,
    lawyerAmount,
    lawyerReason: input.reason,
    dispositionedBy: actor.user,
    dispositionedAt: new Date().toISOString(),
  };

  const updatedAssessment: Assessment = {
    ...assessment,
    lines: assessment.lines.map((candidate) => (candidate.id === updatedLine.id ? updatedLine : candidate)),
  };

  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

  // Only after the write succeeds — a refusal writes no state, so it must
  // write no record either, or the log would read as a decision that did
  // not happen.
  const now = new Date().toISOString();
  await recordAuditEvent({
    matterId: assessment.matterId,
    actor,
    type: "LINE_DISPOSITIONED",
    payload: dispositionPayload({
      lineId: updatedLine.id,
      before: priorDisposition,
      after: updatedLine.disposition,
      elapsedReviewMs: elapsedReviewMs(assessment.id, now),
    }),
    rulePackVersion: assessment.rulePackVersion,
    engineVersion: assessment.engineVersion,
  });

  return updatedLine;
}

// The pure batch mutation bulk-accept applies once its eligibility gate has
// passed (Task 3) — separated out so it is directly unit-testable without
// needing a rule pack fixture that has a VERIFIED category rule, which the
// real committed SG-PDPA pack never has (03.1-UI-SPEC.md's Known
// Deviation).
export function applyBulkAcceptDisposition(
  lines: readonly AssessmentLine[],
  lineIds: readonly string[],
  reason: string,
  actor: UserRef,
  nowIso: string
): AssessmentLine[] {
  const idSet = new Set(lineIds);
  return lines.map((line) => {
    if (!idSet.has(line.id)) return line;
    return {
      ...line,
      disposition: "ACCEPTED",
      lawyerAmount: null,
      lawyerReason: reason,
      dispositionedBy: actor,
      dispositionedAt: nowIso,
    };
  });
}

// Eligible only when the line's verdict is the plain supported one (never
// ALLOW_CAPPED), its applied rule's verification status is VERIFIED — read
// from the assessment's own PINNED pack (resolvePinnedRulePack) by default,
// never a literal, and never "whichever pack is current" — and its
// disposition is still PENDING. For both real committed packs (HK, SG),
// this set is correctly empty for two distinct, documented reasons
// (06-09's regression test) — that is the demo telling the truth, not a
// bug (03.1-UI-SPEC.md's Known Deviation note). `pack` is an optional
// override purely so a unit test can exercise every exclusion case
// (capped, not-supported, flagged, unverified, already-decided) against a
// fixture with at least one VERIFIED rule — neither real committed pack
// has one, and every production call site (this file's bulkAcceptLines,
// the legal review page) omits this argument and gets the real pinned one.
export function listBulkAcceptableLineIds(
  assessment: Assessment,
  pack: LoadableRulePack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion)
): string[] {
  const ruleById = new Map(pack.categoryRules.map((rule) => [rule.ruleId, rule]));

  return assessment.lines
    .filter((line) => line.verdict === "ALLOW" && line.disposition === "PENDING")
    .filter((line) => ruleById.get(line.appliedRuleId)?.verificationStatus === "VERIFIED")
    .map((line) => line.id);
}

export interface BulkAcceptInput {
  lineIds: string[];
  reason: string;
}

// All-or-nothing: if ANY named line id is not currently eligible, nothing
// in the batch is written — a partially applied batch would leave the
// lawyer with a screen that is half decided and no way to tell which half
// (T-03.1-16).
//
// `pack` is an optional override for the same reason
// listBulkAcceptableLineIds's own `pack` parameter is: neither real
// committed pack (HK, SG) has a VERIFIED rule at all, so the real pipeline
// can never exercise a successful bulk-accept, and a unit test needs a
// fixture pack with at least one VERIFIED rule to prove the audit-writing
// behavior below. Every production call site (the bulk-accept route) omits
// this argument and gets the assessment's own real pinned pack, resolved
// below once `assessment` is in scope (a default parameter cannot resolve
// it — the fetched `assessment` object does not exist yet at the point
// default parameters are evaluated).
export async function bulkAcceptLines(
  actor: DemoActor,
  assessmentId: string,
  input: BulkAcceptInput,
  pack?: LoadableRulePack
): Promise<AssessmentLine[]> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  const resolvedPack = pack ?? resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);

  await requireAssessmentInLegalReview(assessment);

  assertSufficientReason(input.reason);

  if (input.lineIds.length === 0) {
    throw new ValidationError("At least one line id is required for bulk accept");
  }

  const eligibleIds = new Set(listBulkAcceptableLineIds(assessment, resolvedPack));
  for (const lineId of input.lineIds) {
    if (!eligibleIds.has(lineId)) {
      throw new ValidationError(`Line '${lineId}' is not eligible for bulk accept`);
    }
  }

  const now = new Date().toISOString();
  const updatedLines = applyBulkAcceptDisposition(assessment.lines, input.lineIds, input.reason, actor.user, now);
  const updatedAssessment: Assessment = { ...assessment, lines: updatedLines };
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

  // One record per line in the batch, each with its own line id and its
  // own prior disposition, all sharing a single elapsed reading taken once
  // for the batch — the batch write above is already all-or-nothing, so
  // these are only written after it succeeds.
  const elapsed = elapsedReviewMs(assessment.id, now);
  for (const lineId of input.lineIds) {
    const priorLine = assessment.lines.find((candidate) => candidate.id === lineId);
    await recordAuditEvent({
      matterId: assessment.matterId,
      actor,
      type: "LINE_DISPOSITIONED",
      payload: dispositionPayload({
        lineId,
        before: priorLine?.disposition ?? "PENDING",
        after: "ACCEPTED",
        elapsedReviewMs: elapsed,
      }),
      rulePackVersion: assessment.rulePackVersion,
      engineVersion: assessment.engineVersion,
    });
  }

  return updatedLines.filter((line) => input.lineIds.includes(line.id));
}

// ---------------------------------------------------------------------------
// signOff — the gate, the attestation, and the only write of finalAmount
// ---------------------------------------------------------------------------

export interface SignOffInput {
  qualification: string;
  acknowledgedFlags: string[];
  attestation: boolean;
}

export interface SignOffResult {
  assessment: Assessment;
  // Not persisted on the frozen SignOff record (it carries no free-text
  // field for this) — returned alongside so the panel and this function's
  // own tests can prove the SAME shared renderAttestation() produced it,
  // rather than either side hand-copying a second string.
  attestationText: string;
}

// requireRole first, then refuse at the FIRST failure among: the matter is
// not in legal review; any line is still pending; any matter flag requiring
// acknowledgement is missing from the supplied list; the supplied list
// names a flag the assessment does not carry; the attestation is not
// affirmed; the qualification is empty after trimming. A refusal writes
// nothing at all — not the record, not the amount, not the status.
export async function signOff(
  actor: DemoActor,
  assessmentId: string,
  input: SignOffInput
): Promise<SignOffResult> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  const matter = await requireAssessmentInLegalReview(assessment);

  // Fetched here (not at its previous, later call site) so the still-
  // PENDING refusal below can name every outstanding line by its
  // ExpenseLine.seq — the only source of that number. Reused as-is by the
  // guard-table build further down; never fetched a second time.
  const lines = await memoryMatterRepository.listExpenseLines(matter.id);
  const expenseLineById = new Map(lines.map((line) => [line.id, line]));

  const pendingLines = assessment.lines.filter((line) => line.disposition === "PENDING");
  if (pendingLines.length > 0) {
    const seqList = pendingLines
      .map((line) => expenseLineById.get(line.expenseLineId)?.seq)
      .filter((seq): seq is number => seq !== undefined)
      .sort((a, b) => a - b)
      .join(", ");
    // 409, not 400: this is a state precondition on the SIGN_OFF transition
    // (the identical guard-table row checkNoLinesPending would refuse with
    // a ConflictError below, were it reached first), not malformed input.
    throw new ConflictError(
      `Sign-off refused — ${pendingLines.length} line(s) still need a decision: lines ${seqList}.`
    );
  }

  const flagsRequiringAck = assessment.matterLevelFlags.filter((flag) => flag.requiresAcknowledgement);
  const acknowledgedSet = new Set(input.acknowledgedFlags);
  for (const flag of flagsRequiringAck) {
    if (!acknowledgedSet.has(flag.id)) {
      // 409, not 400: this is the same SIGN_OFF-transition state
      // precondition as the pending-lines check above, not malformed
      // input — a caller must not have to remember that one is 409 and
      // the other 400. The three refusals below (unknown acknowledged
      // flag, unaffirmed attestation, empty qualification) stay
      // ValidationError/400 on purpose: they are malformed-input errors,
      // not state preconditions.
      throw new ConflictError(`Matter flag '${flag.id}' requires acknowledgement before sign-off`);
    }
  }

  const knownFlagIds = new Set(assessment.matterLevelFlags.map((flag) => flag.id));
  for (const id of input.acknowledgedFlags) {
    if (!knownFlagIds.has(id)) {
      throw new ValidationError(`Acknowledged flag '${id}' is not one of this assessment's matter-level flags`);
    }
  }

  if (input.attestation !== true) {
    throw new ValidationError("The attestation must be affirmed before sign-off");
  }

  const qualification = input.qualification.trim();
  if (qualification.length === 0) {
    throw new ValidationError("Qualification is required before sign-off");
  }
  // WR-02 (07-REVIEW.md) — qualification was the only sign-off free-text
  // field with no upper bound; enforced the same way assertSufficientReason
  // enforces FREE_TEXT_LIMITS.lawyerReason.
  if (qualification.length > FREE_TEXT_LIMITS.qualification) {
    throw new ValidationError(`Qualification must not exceed ${FREE_TEXT_LIMITS.qualification} characters`);
  }

  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion); // real, uncoerced — never the ACTIVE-coerced copy

  // PACK-08 / AC-41b — a specific, human-readable early refusal, following
  // this file's own precedent (the STRUCTURAL guard comment below), sitting
  // ahead of it rather than threading pack-activation-actor data through
  // the frozen 11-member GuardInput, which structurally cannot carry it.
  // Query packages/audit's own canonical pack-lifecycle stream — the single
  // source of truth for "who last activated this pack version" — rather
  // than building a second, parallel answer. Compared by exact UserRef.id
  // string equality only: never displayName, never role, never case-
  // folded or trimmed, since a looser comparison would silently widen or
  // narrow who is blocked.
  const lifecycleEvents = await memoryPackLifecycleEventWriter.listByPack(
    assessment.rulePackId,
    assessment.rulePackVersion
  );
  const lastActivation = [...lifecycleEvents].reverse().find((event) => event.type === "PACK_ACTIVATED");
  if (lastActivation && lastActivation.actor.id === actor.user.id) {
    throw new ForbiddenError(
      `Blocked — you activated rule pack ${assessment.rulePackId} ${assessment.rulePackVersion} in this session. ` +
        `Sign-off by the same person who activated the pack is not permitted; ask another reviewer with the ` +
        `Legal Reviewer role to sign off this assessment instead.`
    );
  }

  // Only now — every condition met — do we compute anything or write
  // anything. This is the only module in the codebase that writes
  // finalAmount, and it is never derived from the draft baseline. The
  // lawyer's feeChoice (REVIEW-11) is passed through so a FLAT choice
  // actually produces the flat fee as finalAmount, not the itemised sum
  // (CR-01) — never derive this a second, independent way here.
  const finalAmount = computeFinalAmount(
    assessment.lines,
    assessment.feeChoice ?? null,
    assessment.totals.flatFeeComparison ?? null
  );

  const now = new Date().toISOString();
  const packIsStale = deriveEffectiveStatus(pack, now) === "STALE";
  const attestationText = renderAttestation({
    jurisdiction: pack.jurisdiction.name,
    packId: assessment.rulePackId,
    packVersion: assessment.rulePackVersion,
    reviewedOn: pack.reviewedOn,
    packIsStale,
  });

  const signOffRecord: SignOff = {
    lawyer: actor.user,
    lawyerName: actor.user.displayName,
    qualification,
    signedAt: now,
    finalAmount,
    acknowledgedFlags: input.acknowledgedFlags,
    attestation: true,
    attestationVersion: ATTESTATION_TEMPLATE_VERSION,
  };

  // The guard is a second, STRUCTURAL check — every refusal above stays
  // exactly where it is and in the same order, because those are the
  // specific, human-readable refusals the panel renders. This does not
  // replace them. Reuses the single `lines` binding fetched earlier for
  // the pending-lines refusal, rather than issuing a second repository
  // read.
  const coercedPack = coercePackForDemoEngine(pack);
  const guardInput = buildGuardInput({
    matter,
    lines,
    assessment,
    pack: coercedPack,
    actor,
    acknowledgedFlags: input.acknowledgedFlags,
  });
  const signOffOutcome = evaluateTransition(matter.status, "SIGN_OFF", guardInput);
  if (!signOffOutcome.allowed) {
    throw new ConflictError(signOffOutcome.reason);
  }

  const updatedAssessment: Assessment = {
    ...assessment,
    totals: { ...assessment.totals, finalAmount },
    signOff: signOffRecord,
  };
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

  const statusBeforeSignOff = matter.status;
  await memoryMatterRepository.updateMatter({ ...matter, status: signOffOutcome.to });

  await recordAuditEvent({
    matterId: matter.id,
    actor,
    type: "SIGNED_OFF",
    payload: signOffPayload(statusBeforeSignOff, signOffOutcome.to, elapsedReviewMs(assessment.id, now)),
    rulePackVersion: assessment.rulePackVersion,
    engineVersion: assessment.engineVersion,
  });

  return { assessment: updatedAssessment, attestationText };
}

// ---------------------------------------------------------------------------
// setFeeChoice — REVIEW-11's flat-fee-vs-itemised choice (06-07)
// ---------------------------------------------------------------------------

// requireRole first, then the same requireAssessmentInLegalReview
// precondition every other mutating function in this file shares, then
// refuse at the FIRST failure: no flatFeeComparison exists for this pack
// (nothing to choose between), or the choice is FLAT and it exceeds
// itemised direct cost (the server-side mirror of the disabled-radio UI
// rule — 06-RESEARCH.md's own Known Threat Pattern: never trust the
// client-side gate as the enforcement point). ITEMISED is always the safe
// default choice and succeeds unconditionally once a flatFeeComparison
// exists. A refusal writes nothing at all, matching every other mutating
// function's own discipline.
export async function setFeeChoice(
  actor: DemoActor,
  assessmentId: string,
  choice: "ITEMISED" | "FLAT"
): Promise<Assessment> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  await requireAssessmentInLegalReview(assessment);

  const flatFeeComparison = assessment.totals.flatFeeComparison;
  if (!flatFeeComparison) {
    throw new ValidationError(`Assessment '${assessmentId}' has no flat fee to choose between`);
  }
  if (choice === "FLAT" && flatFeeComparison.flatFeeExceedsItemisedCost) {
    throw new ValidationError("The flat fee exceeds itemised direct cost and cannot be chosen");
  }

  const priorChoice = assessment.feeChoice ?? null;
  const updatedAssessment: Assessment = { ...assessment, feeChoice: choice };
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

  await recordAuditEvent({
    matterId: assessment.matterId,
    actor,
    type: "FEE_CHOICE_SET",
    payload: feeChoicePayload(priorChoice, choice),
    rulePackVersion: assessment.rulePackVersion,
    engineVersion: assessment.engineVersion,
  });

  return updatedAssessment;
}

// ---------------------------------------------------------------------------
// askHr — the information-request branch
// ---------------------------------------------------------------------------

export interface AskHrInput {
  query: string;
}

// Requires the legal-reviewer role, validates the query by the same
// minimum-length rule dispositions use, asks the executor for the
// RAISE_QUERY transition, appends the request, writes the destination the
// executor returns, and records an INFO_REQUESTED audit event. Writes no
// disposition on the line: it is still undecided, which is exactly why the
// lawyer is asking.
export async function askHr(
  actor: DemoActor,
  assessmentLineId: string,
  input: AskHrInput
): Promise<InfoRequest> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.findByLineId(assessmentLineId);
  if (!assessment) throw new NotFoundError(`No assessment line with id '${assessmentLineId}'`);
  const line = assessment.lines.find((candidate) => candidate.id === assessmentLineId);
  if (!line) throw new NotFoundError(`No assessment line with id '${assessmentLineId}'`);

  const matter = await requireAssessmentInLegalReview(assessment);

  assertSufficientReason(input.query);

  // The PRD's "on at least one line" is the calling action's own content
  // (which line the query names), not a state precondition the guard can
  // see — RAISE_QUERY's only guarded precondition is a recorded lawyer
  // identity, so no pack lookup is needed here.
  const lines = await memoryMatterRepository.listExpenseLines(matter.id);
  const guardInput = buildGuardInput({ matter, lines, assessment, pack: null, actor });
  const raiseQueryOutcome = evaluateTransition(matter.status, "RAISE_QUERY", guardInput);
  if (!raiseQueryOutcome.allowed) {
    throw new ConflictError(raiseQueryOutcome.reason);
  }

  const request: InfoRequest = {
    id: newUlid(),
    matterId: matter.id,
    assessmentLineId,
    query: input.query,
    raisedBy: { id: actor.user.id, displayName: actor.user.displayName },
    raisedAt: new Date().toISOString(),
  };
  await memoryAssessmentRepository.appendInfoRequest(request);

  await memoryMatterRepository.updateMatter({ ...matter, status: raiseQueryOutcome.to });

  await recordAuditEvent({
    matterId: matter.id,
    actor,
    type: "INFO_REQUESTED",
    payload: informationRequestPayload({ assessmentLineId, query: input.query }),
    rulePackVersion: assessment.rulePackVersion,
    engineVersion: assessment.engineVersion,
  });

  return request;
}

// ---------------------------------------------------------------------------
// raiseCorrection — a signed-off record is immutable; a correction is a
// SECOND assessment that supersedes it, never an edit (PRD §5's SUPERSEDE
// row, AC-33). Checkpoint 04-05-CP settled how this is represented: Option
// A, transcribed literally from the PRD's own table — the matter moves to
// SUPERSEDED, the signed assessment is never touched, and the correction is
// raised with every line undecided. The PRD's table gives SUPERSEDED no
// outgoing row, so the correction is recorded but not yet reviewable or
// re-signable under today's transition table — a genuine, deliberately
// unresolved gap, tracked in STATE.md's Blockers/Concerns and WINDOWS.md
// rather than papered over here or resolved by inventing a table row the
// PRD does not have.
// ---------------------------------------------------------------------------

// Requires the reviewer role, reads the matter and refuses via the
// executor's SUPERSEDE row unless it is currently signed off or closed
// (both origins that row names). Deliberately does NOT call
// recomputeAssessment() (../recompute.ts) — that module's whole point is to
// PRESERVE an identity, because the record it mutates has not yet reached
// SIGNED_OFF. This function must CREATE a new identity, because the record
// it is correcting is final and must survive untouched. See recompute.ts's
// own module note, which points back here — keeping the two separate, each
// commented against the other, is what stops a later reader from "removing
// the duplication" and quietly merging a correction into an overwrite.
export async function raiseCorrection(actor: DemoActor, assessmentId: string): Promise<Assessment> {
  requireRole(actor, "LEGAL_REVIEWER");

  // THE SIGNED ASSESSMENT BELOW IS READ AND NEVER WRITTEN AGAIN. Do not
  // update it, do not clear its dispositions, do not null its sign-off —
  // this is the immutability boundary the product's whole defensibility
  // claim rests on.
  const signedAssessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!signedAssessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  const matter = await memoryMatterRepository.getMatter(signedAssessment.matterId);
  if (!matter) throw new NotFoundError(`No matter found for assessment '${assessmentId}'`);

  const lines = await memoryMatterRepository.listExpenseLines(matter.id);
  const guardInput = buildGuardInput({ matter, lines, assessment: signedAssessment, pack: null, actor });
  const supersedeOutcome = evaluateTransition(matter.status, "SUPERSEDE", guardInput);
  if (!supersedeOutcome.allowed) {
    throw new ConflictError(supersedeOutcome.reason);
  }

  // THE LINE THAT MUST NOT BE GOT WRONG: the engine derives its own
  // assessment id from its inputs, and the matter's lines have not
  // changed, so assessMatter()'s own derived id here would equal
  // `signedAssessment.id` — saving under it would silently overwrite the
  // very record this whole path exists to preserve. A freshly generated
  // identifier, assigned explicitly, is the only thing standing between a
  // correction and the destruction of the evidence it corrects.
  const recomputed = assessMatter({ matter, lines });
  const correction: Assessment = { ...recomputed, id: newUlid() };
  await memoryAssessmentRepository.saveAssessment(correction);

  const statusBeforeSupersede = matter.status;
  await memoryMatterRepository.updateMatter({ ...matter, status: supersedeOutcome.to });

  await recordAuditEvent({
    matterId: matter.id,
    actor,
    type: "SUPERSEDED",
    payload: supersededPayload(signedAssessment.id, statusBeforeSupersede, supersedeOutcome.to),
    rulePackVersion: correction.rulePackVersion,
    engineVersion: correction.engineVersion,
  });

  return correction;
}
