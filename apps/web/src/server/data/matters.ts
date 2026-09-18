// apps/web/src/server/data/matters.ts
//
// createMatter / addExpenseLine / submitForAssessment. Each calls
// requireRole for the HR preparer role first, then parses its input with the
// frozen schema from @dsar/schemas — never a re-derived parallel shape —
// then goes through the repository.

import "../server-only.ts";
import { MatterSchema, type Matter } from "@dsar/schemas/matter";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import type { Assessment } from "@dsar/schemas/assessment";
import { newUlid } from "../ids.ts";
import { assertTransition } from "../state.ts";
import { assessMatter } from "../engine-invocation.ts";
import { ConflictError, NotFoundError, ValidationError } from "../errors.ts";
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryMatterRepository } from "../repositories/memory/matter-repository.ts";
import { memoryAssessmentRepository } from "../repositories/memory/assessment-repository.ts";

export interface CreateMatterInput {
  reference: string;
  jurisdictionCode: Matter["jurisdictionCode"];
  legalEntity: string;
  controllerType: Matter["controllerType"];
  requestReceivedOn: string;
  requestorClass: Matter["requestorClass"];
  currency: Matter["currency"];
  identityVerified: boolean;
  identityVerifiedNote?: string | null;
  scopeClarified: boolean;
  isRepeatRequestWithin12Months: boolean;
  isKnownDisputeOrLitigation: boolean;
}

export async function createMatter(actor: DemoActor, input: CreateMatterInput): Promise<Matter> {
  requireRole(actor, "HR_PREPARER");

  const matter = MatterSchema.parse({
    id: newUlid(),
    reference: input.reference,
    jurisdictionCode: input.jurisdictionCode,
    legalEntity: input.legalEntity,
    controllerType: input.controllerType,
    requestReceivedOn: input.requestReceivedOn,
    requestorClass: input.requestorClass,
    currency: input.currency,
    identityVerified: input.identityVerified,
    identityVerifiedNote: input.identityVerifiedNote ?? null,
    scopeClarified: input.scopeClarified,
    isRepeatRequestWithin12Months: input.isRepeatRequestWithin12Months,
    isKnownDisputeOrLitigation: input.isKnownDisputeOrLitigation,
    status: "DRAFT",
    createdBy: actor.user,
    createdAt: new Date().toISOString(),
  });

  return memoryMatterRepository.createMatter(matter);
}

export interface AddExpenseLineInput {
  categoryCode: ExpenseLine["categoryCode"];
  description: string;
  quantity: number;
  unit: ExpenseLine["unit"];
  unitRate: number;
  // Optional, defense-in-depth only (T-03.1-09): the real intake form never
  // sends this — the server always derives it from quantity * unitRate. A
  // crafted request that supplies a disagreeing value is caught by
  // ExpenseLineSchema's own claimedAmount invariant below and refused with
  // 400, never silently recomputed and stored.
  claimedAmount?: number;
  incurredByGrade?: ExpenseLine["incurredByGrade"];
  isThirdPartyInvoiced: boolean;
  vendorName?: string | null;
  evidenceRef?: string | null;
  hrNote?: string | null;
}

export async function addExpenseLine(
  actor: DemoActor,
  matterId: string,
  input: AddExpenseLineInput
): Promise<ExpenseLine> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);

  const existingLines = await memoryMatterRepository.listExpenseLines(matterId);

  const line = ExpenseLineSchema.parse({
    id: newUlid(),
    matterId,
    seq: existingLines.length,
    categoryCode: input.categoryCode,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unitRate: input.unitRate,
    // The schema's quantity * unitRate invariant is checked, not assumed —
    // a legitimate caller omits claimedAmount and this derives it; a
    // crafted request that supplies a disagreeing value is passed through
    // unchanged so ExpenseLineSchema's superRefine rejects it (T-03.1-09).
    claimedAmount: input.claimedAmount ?? input.quantity * input.unitRate,
    incurredByGrade: input.incurredByGrade ?? null,
    isThirdPartyInvoiced: input.isThirdPartyInvoiced,
    vendorName: input.vendorName ?? null,
    evidenceRef: input.evidenceRef ?? null,
    hrNote: input.hrNote ?? null,
  });

  return memoryMatterRepository.addExpenseLine(line);
}

// Refuses unless the matter is still DRAFT — a signal that has already been
// submitted for review must not have its lines edited underneath the
// lawyer's read (T-03.1-10). Recomputes claimedAmount the same
// omit-to-derive way addExpenseLine does.
export async function replaceExpenseLine(
  actor: DemoActor,
  matterId: string,
  lineId: string,
  input: AddExpenseLineInput
): Promise<ExpenseLine> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "DRAFT") {
    throw new ConflictError(
      `Matter '${matterId}' is not in DRAFT (currently ${matter.status}) — its lines are locked`
    );
  }

  const existingLines = await memoryMatterRepository.listExpenseLines(matterId);
  const existing = existingLines.find((candidate) => candidate.id === lineId);
  if (!existing) throw new NotFoundError(`No expense line with id '${lineId}' on matter '${matterId}'`);

  const line = ExpenseLineSchema.parse({
    id: lineId,
    matterId,
    seq: existing.seq,
    categoryCode: input.categoryCode,
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unitRate: input.unitRate,
    claimedAmount: input.claimedAmount ?? input.quantity * input.unitRate,
    incurredByGrade: input.incurredByGrade ?? null,
    isThirdPartyInvoiced: input.isThirdPartyInvoiced,
    vendorName: input.vendorName ?? null,
    evidenceRef: input.evidenceRef ?? null,
    hrNote: input.hrNote ?? null,
  });

  return memoryMatterRepository.replaceExpenseLine(line);
}

// Same DRAFT-only refusal as replaceExpenseLine, for the same reason
// (T-03.1-10).
export async function deleteExpenseLine(actor: DemoActor, matterId: string, lineId: string): Promise<void> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "DRAFT") {
    throw new ConflictError(
      `Matter '${matterId}' is not in DRAFT (currently ${matter.status}) — its lines are locked`
    );
  }

  const existingLines = await memoryMatterRepository.listExpenseLines(matterId);
  const existing = existingLines.find((candidate) => candidate.id === lineId);
  if (!existing) throw new NotFoundError(`No expense line with id '${lineId}' on matter '${matterId}'`);

  await memoryMatterRepository.deleteExpenseLine(matterId, lineId);
}

// The pipeline: assert the matter is DRAFT, assert at least one expense line
// exists, transition DRAFT to COMPUTING, call assessMatter, save the
// assessment, transition COMPUTING to LEGAL_REVIEW, and return the computed
// Assessment itself (its `id` is the assessment identifier the route hands
// back). If assessMatter throws, return the matter to DRAFT and rethrow —
// PRD §10.7's engine-error row requires the matter to land back in Draft
// with no partial figures saved.
export async function submitForAssessment(actor: DemoActor, matterId: string): Promise<Assessment> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "DRAFT") {
    throw new ValidationError(`Matter '${matterId}' is not in DRAFT (currently ${matter.status})`);
  }

  const lines = await memoryMatterRepository.listExpenseLines(matterId);
  if (lines.length === 0) {
    throw new ValidationError("At least one expense line is required before submitting");
  }

  assertTransition(matter.status, "COMPUTING");
  await memoryMatterRepository.updateMatter({ ...matter, status: "COMPUTING" });

  try {
    const assessment = assessMatter({ matter, lines });
    const saved = await memoryAssessmentRepository.saveAssessment(assessment);
    assertTransition("COMPUTING", "LEGAL_REVIEW");
    await memoryMatterRepository.updateMatter({ ...matter, status: "LEGAL_REVIEW" });
    return saved;
  } catch (error) {
    assertTransition("COMPUTING", "DRAFT");
    await memoryMatterRepository.updateMatter({ ...matter, status: "DRAFT" });
    throw error;
  }
}
