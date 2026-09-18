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
import type { InfoRequest } from "../../domain/info-request.ts";

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

// ---------------------------------------------------------------------------
// resubmitAfterInfoRequest — the in-place recompute (PRD §5's mirror-image
// rule)
// ---------------------------------------------------------------------------

// Requires the HR-preparer role, refuses unless the matter is in the
// information-requested state, transitions to COMPUTING, re-runs
// assessMatter() over the CURRENT lines, and then — the part that is easy
// to get backwards — stores the new result under the EXISTING assessment's
// identifier, overwriting its content. The engine derives its own
// identifier from its inputs; that derived id is deliberately discarded in
// favour of the one already on file, so this recompute mutates the
// existing Assessment in place (same id) rather than creating a second
// record — a different frozen lifecycle status, reserved for a correction
// made after sign-off, exists for that other case; this recompute runs
// strictly before sign-off and never touches that status at all.
// assessMatter() itself starts every line PENDING with no lawyer amount,
// reason, actor or timestamp, so nothing from the old dispositions can
// survive the overwrite.
export async function resubmitAfterInfoRequest(actor: DemoActor, matterId: string): Promise<Assessment> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "INFO_REQUEST") {
    throw new ConflictError(`Matter '${matterId}' is not awaiting information (currently ${matter.status})`);
  }

  const existing = await memoryAssessmentRepository.getAssessmentByMatterId(matterId);
  if (!existing) throw new NotFoundError(`No assessment found for matter '${matterId}'`);

  assertTransition("INFO_REQUEST", "COMPUTING");
  await memoryMatterRepository.updateMatter({ ...matter, status: "COMPUTING" });

  const lines = await memoryMatterRepository.listExpenseLines(matterId);
  const recomputed = assessMatter({ matter, lines });
  // See module note above: the derived id is discarded in favour of the
  // existing one on purpose — do not "fix" this to use recomputed.id.
  const updatedAssessment: Assessment = { ...recomputed, id: existing.id };
  await memoryAssessmentRepository.updateAssessment(updatedAssessment);

  assertTransition("COMPUTING", "LEGAL_REVIEW");
  await memoryMatterRepository.updateMatter({ ...matter, status: "LEGAL_REVIEW" });

  await memoryAssessmentRepository.clearInfoRequests(matterId);

  return updatedAssessment;
}

// ---------------------------------------------------------------------------
// The HR-scoped status read + markNoticeSent (PRD §10.4)
// ---------------------------------------------------------------------------

export interface HrMatterStatusView {
  matter: Matter;
  infoRequests: InfoRequest[];
}

// Returns the matter's status and any outstanding information requests but
// NEVER an assessment — PRD §0 non-negotiable #2, enforced here rather than
// by hiding a link. The HR result page calls this first and only reaches
// for the (refusing) assessment read once status is SIGNED_OFF.
export async function getHrMatterStatus(actor: DemoActor, matterId: string): Promise<HrMatterStatusView> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);

  const infoRequests =
    matter.status === "INFO_REQUEST" ? await memoryAssessmentRepository.listInfoRequests(matterId) : [];

  return { matter, infoRequests };
}

// Demo-scoped notice-sent ledger. Neither Matter nor Assessment (both
// frozen, additive-only, and out of this plan's scope to reopen) carries a
// field for this one side-fact — PRD §10.4 asks only that the date be
// recorded, and the closing transition belongs to Phase 7, which owns the
// outputs. Anchored to globalThis for the same Fast-Refresh-survival reason
// apps/web/src/server/repositories/memory/store.ts's demoStore is.
declare global {
  // eslint-disable-next-line no-var
  var __dsarNoticeSentAt: Map<string, string> | undefined;
}
const noticeSentAtByMatterId: Map<string, string> =
  globalThis.__dsarNoticeSentAt ?? (globalThis.__dsarNoticeSentAt = new Map());

// Requires the HR-preparer role, refuses unless the matter is signed off,
// and records the date. It sends nothing — there is no outbound email of
// any kind anywhere in this system (NS-3), which is why the boundary note
// above this control exists.
export async function markNoticeSent(
  actor: DemoActor,
  matterId: string
): Promise<{ matterId: string; noticeSentAt: string }> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "SIGNED_OFF") {
    throw new ConflictError(
      `Matter '${matterId}' is not signed off (currently ${matter.status}) — cannot mark notice sent`
    );
  }

  const noticeSentAt = new Date().toISOString();
  noticeSentAtByMatterId.set(matterId, noticeSentAt);
  return { matterId, noticeSentAt };
}

export function getNoticeSentAt(matterId: string): string | null {
  return noticeSentAtByMatterId.get(matterId) ?? null;
}

export interface ReviewableMatterView {
  matter: Matter;
  assessmentId: string;
}

// Added post-plan (03.1-REVIEW.md UNREG-1, security audit finding): the
// legal worklist page originally called the memory repositories directly,
// with no role check anywhere — the sole exception to this phase's
// otherwise-universal "requireRole() as the first statement of every
// data-layer function" pattern. This function closes that gap the same way
// every other legal-side read does.
export async function listReviewableMatters(actor: DemoActor): Promise<ReviewableMatterView[]> {
  requireRole(actor, "LEGAL_REVIEWER");

  const matters = await memoryMatterRepository.listMatters();
  const reviewable = matters.filter(
    (matter) => matter.status === "LEGAL_REVIEW" || matter.status === "SIGNED_OFF"
  );

  const views: ReviewableMatterView[] = [];
  for (const matter of reviewable) {
    const assessment = await memoryAssessmentRepository.getAssessmentByMatterId(matter.id);
    if (assessment) views.push({ matter, assessmentId: assessment.id });
  }
  return views;
}
