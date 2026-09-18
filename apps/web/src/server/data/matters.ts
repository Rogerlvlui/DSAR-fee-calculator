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
import { NotFoundError, ValidationError } from "../errors.ts";
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
    // computed here from the same input values the schema will re-derive
    // and compare against.
    claimedAmount: input.quantity * input.unitRate,
    incurredByGrade: input.incurredByGrade ?? null,
    isThirdPartyInvoiced: input.isThirdPartyInvoiced,
    vendorName: input.vendorName ?? null,
    evidenceRef: input.evidenceRef ?? null,
    hrNote: input.hrNote ?? null,
  });

  return memoryMatterRepository.addExpenseLine(line);
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
