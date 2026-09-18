// apps/web/src/server/data/assessments.ts

import "../server-only.ts";
import type { Assessment, AssessmentLine } from "@dsar/schemas/assessment";
import { MinorSchema, type Minor, type UserRef } from "@dsar/schemas/primitives";
import { FREE_TEXT_LIMITS } from "@dsar/schemas/constants";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors.ts";
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryAssessmentRepository } from "../repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../repositories/memory/matter-repository.ts";
import { loadDemoPack } from "../engine-invocation.ts";
import {
  hasSufficientReason,
  isActionPermitted,
  MIN_REASON_NON_WHITESPACE_CHARS,
  type DispositionAction,
} from "../../domain/disposition-actions.ts";

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
// from loadDemoPack()'s real, uncoerced result, never a literal — and its
// disposition is still PENDING. For this demo's committed pack every
// relevant rule is NEEDS_VERIFICATION, so this set is correctly empty; that
// is the demo telling the truth, not a bug (03.1-UI-SPEC.md's Known
// Deviation note).
export function listBulkAcceptableLineIds(assessment: Assessment): string[] {
  const pack = loadDemoPack();
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
