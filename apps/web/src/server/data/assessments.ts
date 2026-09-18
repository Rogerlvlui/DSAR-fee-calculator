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
import { loadDemoPack } from "../engine-invocation.ts";
import { assertTransition } from "../state.ts";
import { newUlid } from "../ids.ts";
import {
  hasSufficientReason,
  isActionPermitted,
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

export async function getAssessmentForLegalReview(
  actor: DemoActor,
  assessmentId: string
): Promise<Assessment> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);
  return assessment;
}

// PRD §0 non-negotiable #2, enforced here in the data layer rather than by
// hiding a link: HR never sees an unreviewed assessment.
export async function getSignedOffAssessmentForHr(
  actor: DemoActor,
  matterId: string
): Promise<Assessment> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "SIGNED_OFF") {
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
function assertSufficientReason(reason: string): void {
  if (!hasSufficientReason(reason)) {
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
// from loadDemoPack()'s real, uncoerced result by default, never a literal
// — and its disposition is still PENDING. For this demo's committed pack
// every relevant rule is NEEDS_VERIFICATION, so this set is correctly
// empty; that is the demo telling the truth, not a bug (03.1-UI-SPEC.md's
// Known Deviation note). `pack` is an optional override purely so a unit
// test can exercise every exclusion case (capped, not-supported, flagged,
// unverified, already-decided) against a fixture with at least one
// VERIFIED rule — the real committed pack has none, and every production
// call site (this file's bulkAcceptLines, the legal review page) omits
// this argument and gets the real one.
export function listBulkAcceptableLineIds(
  assessment: Assessment,
  pack: ReturnType<typeof loadDemoPack> = loadDemoPack()
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
export async function bulkAcceptLines(
  actor: DemoActor,
  assessmentId: string,
  input: BulkAcceptInput
): Promise<AssessmentLine[]> {
  requireRole(actor, "LEGAL_REVIEWER");

  const assessment = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!assessment) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  await requireAssessmentInLegalReview(assessment);

  assertSufficientReason(input.reason);

  if (input.lineIds.length === 0) {
    throw new ValidationError("At least one line id is required for bulk accept");
  }

  const eligibleIds = new Set(listBulkAcceptableLineIds(assessment));
  for (const lineId of input.lineIds) {
    if (!eligibleIds.has(lineId)) {
      throw new ValidationError(`Line '${lineId}' is not eligible for bulk accept`);
    }
  }

  const now = new Date().toISOString();
  const updatedLines = applyBulkAcceptDisposition(assessment.lines, input.lineIds, input.reason, actor.user, now);
  const updatedAssessment: Assessment = { ...assessment, lines: updatedLines };
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

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

  if (assessment.lines.some((line) => line.disposition === "PENDING")) {
    throw new ValidationError("Every line must be dispositioned before sign-off");
  }

  const flagsRequiringAck = assessment.matterLevelFlags.filter((flag) => flag.requiresAcknowledgement);
  const acknowledgedSet = new Set(input.acknowledgedFlags);
  for (const flag of flagsRequiringAck) {
    if (!acknowledgedSet.has(flag.id)) {
      throw new ValidationError(`Matter flag '${flag.id}' requires acknowledgement before sign-off`);
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

  // Only now — every condition met — do we compute anything or write
  // anything. This is the only module in the codebase that writes
  // finalAmount, and it is never derived from the draft baseline.
  const finalAmount = computeFinalAmount(assessment.lines);

  const pack = loadDemoPack(); // real, uncoerced — never the ACTIVE-coerced copy
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

  const updatedAssessment: Assessment = {
    ...assessment,
    totals: { ...assessment.totals, finalAmount },
    signOff: signOffRecord,
  };
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

  assertTransition("LEGAL_REVIEW", "SIGNED_OFF");
  await memoryMatterRepository.updateMatter({ ...matter, status: "SIGNED_OFF" });

  return { assessment: updatedAssessment, attestationText };
}

// ---------------------------------------------------------------------------
// askHr — the information-request branch
// ---------------------------------------------------------------------------

export interface AskHrInput {
  query: string;
}

// Requires the legal-reviewer role, validates the query by the same
// minimum-length rule dispositions use, appends the request, and
// transitions the matter from legal review to information requested. Writes
// no disposition on the line: it is still undecided, which is exactly why
// the lawyer is asking.
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

  const request: InfoRequest = {
    id: newUlid(),
    matterId: matter.id,
    assessmentLineId,
    query: input.query,
    raisedBy: { id: actor.user.id, displayName: actor.user.displayName },
    raisedAt: new Date().toISOString(),
  };
  await memoryAssessmentRepository.appendInfoRequest(request);

  assertTransition("LEGAL_REVIEW", "INFO_REQUEST");
  await memoryMatterRepository.updateMatter({ ...matter, status: "INFO_REQUEST" });

  return request;
}
