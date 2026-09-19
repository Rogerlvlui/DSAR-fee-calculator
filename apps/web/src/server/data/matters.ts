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
import { assessMatter, coercePackForDemoEngine, loadDemoPack } from "../engine-invocation.ts";
import { recomputeAssessment } from "../recompute.ts";
import { ConflictError, NotFoundError, ValidationError } from "../errors.ts";
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryMatterRepository } from "../repositories/memory/matter-repository.ts";
import { memoryAssessmentRepository } from "../repositories/memory/assessment-repository.ts";
import type { InfoRequest } from "../../domain/info-request.ts";
import { buildGuardInput } from "../guard-input.ts";
import { recordAuditEvent } from "../audit-trail.ts";
import { evaluateTransition } from "@dsar/workflow/evaluate-transition";
import { INITIAL_MATTER_STATUS } from "@dsar/workflow/transitions";
import {
  expenseLineAddedPayload,
  expenseLineDeletedPayload,
  expenseLineEditedPayload,
  matterCreatedPayload,
  transitionPayload,
} from "@dsar/audit/payload-builders";
import type { Json } from "@dsar/schemas/primitives";
import { ENGINE_VERSION } from "@dsar/engine";

// A snapshot of the fields that actually build a claim, shared by the
// LINE_ADDED/LINE_EDITED/LINE_DELETED audit records below — see
// packages/audit/src/payload-builders.ts's own note on why the free-text
// fields (vendorName, evidenceRef, hrNote) are deliberately excluded from
// an append-only log.
function toLineSnapshot(line: ExpenseLine): Record<string, Json> {
  return {
    categoryCode: line.categoryCode,
    quantity: line.quantity,
    unit: line.unit,
    unitRate: line.unitRate,
    claimedAmount: line.claimedAmount,
  };
}

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

// A newly created matter has no transition INTO it — evaluateTransition
// has nothing to say about a matter's birth status, only about moving an
// existing one. INITIAL_MATTER_STATUS is the single named constant the
// package that owns every status value exports for exactly this case, so
// this is the one honest expression of "no guard applies here," not an
// exception carved into the lint rule below.
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
    status: INITIAL_MATTER_STATUS,
    createdBy: actor.user,
    createdAt: new Date().toISOString(),
  });

  const created = await memoryMatterRepository.createMatter(matter);

  // The first record of the acts that produce a claim (04-05 Task 2) — a
  // log covering only the decisions made about a claim, and not the claim
  // itself coming into existence, cannot reconstruct how a fee was
  // reached.
  await recordAuditEvent({
    matterId: created.id,
    actor,
    type: "MATTER_CREATED",
    payload: matterCreatedPayload(created.id, created.status),
    rulePackVersion: null,
    engineVersion: null,
  });

  return created;
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

  const created = await memoryMatterRepository.addExpenseLine(line);

  await recordAuditEvent({
    matterId,
    actor,
    type: "LINE_ADDED",
    payload: expenseLineAddedPayload(created.id, toLineSnapshot(created)),
    rulePackVersion: null,
    engineVersion: null,
  });

  return created;
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

  const updated = await memoryMatterRepository.replaceExpenseLine(line);

  await recordAuditEvent({
    matterId,
    actor,
    type: "LINE_EDITED",
    payload: expenseLineEditedPayload(updated.id, toLineSnapshot(existing), toLineSnapshot(updated)),
    rulePackVersion: null,
    engineVersion: null,
  });

  return updated;
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

  await recordAuditEvent({
    matterId,
    actor,
    type: "LINE_DELETED",
    payload: expenseLineDeletedPayload(existing.id, toLineSnapshot(existing)),
    rulePackVersion: null,
    engineVersion: null,
  });
}

// The pipeline: assert the matter is DRAFT, assert at least one expense line
// exists, ask packages/workflow's guarded executor for the SUBMIT
// transition and write the destination IT returns (never a literal chosen
// here), record the SUBMITTED audit event, call assessMatter, save the
// assessment, ask the executor for the COMPUTE_SUCCEEDED transition and
// write ITS destination, record a COMPUTED audit event, and return the
// computed Assessment itself (its `id` is the assessment identifier the
// route hands back). If assessMatter throws, ask the executor for the
// COMPUTE_FAILED transition, write its destination BEFORE recording the
// failure (so a logging problem cannot strand the matter in COMPUTING),
// record a COMPUTE_FAILED audit event carrying the failure reason, and
// rethrow — PRD §10.7's engine-error row requires the matter to land back
// in Draft with no partial figures saved.
//
// The two early checks below (DRAFT-only, at-least-one-line) are the
// pre-existing 03.1 business-rule checks, left unmodified — they are not
// themselves a "transition check" (04-01-PLAN.md's action text names only
// the literal `assertTransition(matter.status, "COMPUTING")` call as the
// "first stand-in transition check" this plan converts), and changing them
// would flip demo-pipeline.test.ts's PIPELINE-tagged zero-line case from
// its asserted 400 to a 409, breaking that already-passing, untouched test
// (04-01-PLAN.md's own <verify> requires it survive this conversion). The
// guard's own identical "at least one expense line" condition is exercised
// directly, and provably, in packages/workflow/src/evaluate-transition.test.ts
// — it is unreachable via this route only because this pre-check already
// refuses first, not because it is untested.
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

  const loadedPack = loadDemoPack();
  const pack = coercePackForDemoEngine(loadedPack);
  const guardInput = buildGuardInput({ matter, lines, assessment: null, pack, actor });
  const submitOutcome = evaluateTransition(matter.status, "SUBMIT", guardInput);
  if (!submitOutcome.allowed) {
    throw new ConflictError(submitOutcome.reason);
  }

  const statusBeforeSubmit = matter.status;
  await memoryMatterRepository.updateMatter({ ...matter, status: submitOutcome.to });
  await recordAuditEvent({
    matterId,
    actor,
    type: "SUBMITTED",
    payload: transitionPayload(statusBeforeSubmit, submitOutcome.to),
    rulePackVersion: pack.version,
    engineVersion: ENGINE_VERSION,
  });

  try {
    const assessment = assessMatter({ matter, lines });

    // COMPUTING -> LEGAL_REVIEW: ask the executor for the destination
    // rather than writing "LEGAL_REVIEW" as a literal. `submitOutcome.to`
    // (not a hand-written "COMPUTING" literal) is the `from` state here —
    // it is the executor's own answer to the SUBMIT transition above.
    //
    // The guard is evaluated against the freshly computed (not yet
    // persisted) assessment BEFORE saveAssessment runs (04-REVIEW.md
    // WR-01): saving first and only then checking the guard would leave an
    // orphaned assessment in the repository, attached to a matter that has
    // already rolled back to DRAFT, on any future guard refusal here.
    const computeGuardInput = buildGuardInput({ matter, lines, assessment, pack, actor });
    const computeOutcome = evaluateTransition(submitOutcome.to, "COMPUTE_SUCCEEDED", computeGuardInput);
    if (!computeOutcome.allowed) {
      throw new ConflictError(computeOutcome.reason);
    }
    const saved = await memoryAssessmentRepository.saveAssessment(assessment);
    await memoryMatterRepository.updateMatter({ ...matter, status: computeOutcome.to });
    await recordAuditEvent({
      matterId,
      actor,
      type: "COMPUTED",
      payload: transitionPayload(submitOutcome.to, computeOutcome.to),
      rulePackVersion: pack.version,
      engineVersion: ENGINE_VERSION,
    });
    return saved;
  } catch (error) {
    // The rollback write is ordered BEFORE its own audit record: a matter
    // stranded in COMPUTING by a logging failure is a worse outcome than a
    // missing record of a failure that is itself already visible in the
    // matter's status (04-04-PLAN.md's own assumption).
    const failOutcome = evaluateTransition(submitOutcome.to, "COMPUTE_FAILED", guardInput);
    if (!failOutcome.allowed) {
      // Unreachable in practice — the COMPUTE_FAILED row's guard is
      // unconditional (packages/workflow/src/transitions.ts) — but fail
      // loudly rather than silently leave the matter stranded in COMPUTING
      // if a future edit ever changes that.
      throw new Error(`Internal error: rollback transition refused (${failOutcome.reason})`);
    }
    await memoryMatterRepository.updateMatter({ ...matter, status: failOutcome.to });
    const reason = error instanceof Error ? error.message : String(error);
    await recordAuditEvent({
      matterId,
      actor,
      type: "COMPUTE_FAILED",
      // The changed-value position (`after`) carries the failure reason,
      // not the destination status — the destination is already visible on
      // the matter itself.
      payload: transitionPayload(submitOutcome.to, reason),
      rulePackVersion: pack.version,
      engineVersion: ENGINE_VERSION,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// computeInPlaceOrRollback — shared by resubmitAfterInfoRequest and
// recomputeAgainstCurrentPack (04-REVIEW.md CR-01)
// ---------------------------------------------------------------------------

// Both callers drive a matter into COMPUTING and then re-run the engine
// in place through ../recompute.ts. Unlike submitForAssessment, neither
// originally wrapped that call in a try/catch: packages/engine's own
// checkPreconditions() independently re-checks the pack's reviewDueOn
// against the LIVE wall clock on every call (the demo's
// coercePackForDemoEngine() forces pack.status to "ACTIVE" for the guard's
// benefit, but cannot mask this from the engine itself), so once the
// committed pack's reviewDueOn date passes, an uncaught throw here left the
// matter permanently stranded in COMPUTING — no guard row accepts COMPUTING
// as an origin except COMPUTE_SUCCEEDED/COMPUTE_FAILED, and nothing called
// either. This helper applies the same rollback shape submitForAssessment
// already relies on: COMPUTE_FAILED's guard is unconditional from COMPUTING
// to DRAFT regardless of which of the three call sites got the matter
// there, so it is directly reusable here.
async function computeInPlaceOrRollback(args: {
  matter: Matter;
  lines: ExpenseLine[];
  existing: Assessment;
  pack: ReturnType<typeof coercePackForDemoEngine>;
  actor: DemoActor;
  computingStatus: Matter["status"];
  guardInputForRollback: ReturnType<typeof buildGuardInput>;
}): Promise<Assessment> {
  const { matter, lines, existing, pack, actor, computingStatus, guardInputForRollback } = args;

  try {
    const updatedAssessment = recomputeAssessment({ matter, lines, existing });
    await memoryAssessmentRepository.updateAssessment(updatedAssessment);

    const computeGuardInput = buildGuardInput({ matter, lines, assessment: updatedAssessment, pack, actor });
    const computeOutcome = evaluateTransition(computingStatus, "COMPUTE_SUCCEEDED", computeGuardInput);
    if (!computeOutcome.allowed) {
      throw new ConflictError(computeOutcome.reason);
    }
    await memoryMatterRepository.updateMatter({ ...matter, status: computeOutcome.to });
    await recordAuditEvent({
      matterId: matter.id,
      actor,
      type: "COMPUTED",
      payload: transitionPayload(computingStatus, computeOutcome.to),
      rulePackVersion: pack.version,
      engineVersion: ENGINE_VERSION,
    });
    return updatedAssessment;
  } catch (error) {
    // The rollback write is ordered BEFORE its own audit record, mirroring
    // submitForAssessment: a matter stranded in COMPUTING by a logging
    // failure is a worse outcome than a missing record of a failure that is
    // itself already visible in the matter's status.
    const failOutcome = evaluateTransition(computingStatus, "COMPUTE_FAILED", guardInputForRollback);
    if (!failOutcome.allowed) {
      // Unreachable in practice — COMPUTE_FAILED's guard is unconditional
      // (packages/workflow/src/transitions.ts) — but fail loudly rather
      // than silently leave the matter stranded in COMPUTING if a future
      // edit ever changes that.
      throw new Error(`Internal error: rollback transition refused (${failOutcome.reason})`);
    }
    await memoryMatterRepository.updateMatter({ ...matter, status: failOutcome.to });
    const reason = error instanceof Error ? error.message : String(error);
    await recordAuditEvent({
      matterId: matter.id,
      actor,
      type: "COMPUTE_FAILED",
      payload: transitionPayload(computingStatus, reason),
      rulePackVersion: pack.version,
      engineVersion: ENGINE_VERSION,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// resubmitAfterInfoRequest — the in-place recompute (PRD §5's mirror-image
// rule)
// ---------------------------------------------------------------------------

// Requires the HR-preparer role, refuses unless the matter is in the
// information-requested state (via the executor's RESUBMIT row), records a
// SUBMITTED event, delegates the in-place mutation to ../recompute.ts (see
// its module note for why the derived id is discarded), asks the executor
// for the COMPUTE_SUCCEEDED transition, records a COMPUTED event, and only
// then clears the outstanding information requests. recomputeAssessment()
// starts every line PENDING with no lawyer amount, reason, actor or
// timestamp, and clears the assessment's first-opened record, so nothing
// from the old review pass can survive the overwrite.
export async function resubmitAfterInfoRequest(actor: DemoActor, matterId: string): Promise<Assessment> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);
  if (matter.status !== "INFO_REQUEST") {
    throw new ConflictError(`Matter '${matterId}' is not awaiting information (currently ${matter.status})`);
  }

  const existing = await memoryAssessmentRepository.getAssessmentByMatterId(matterId);
  if (!existing) throw new NotFoundError(`No assessment found for matter '${matterId}'`);

  const lines = await memoryMatterRepository.listExpenseLines(matterId);
  const loadedPack = loadDemoPack();
  const pack = coercePackForDemoEngine(loadedPack);
  const guardInput = buildGuardInput({ matter, lines, assessment: existing, pack, actor });

  const resubmitOutcome = evaluateTransition(matter.status, "RESUBMIT", guardInput);
  if (!resubmitOutcome.allowed) {
    throw new ConflictError(resubmitOutcome.reason);
  }

  const statusBeforeResubmit = matter.status;
  await memoryMatterRepository.updateMatter({ ...matter, status: resubmitOutcome.to });
  await recordAuditEvent({
    matterId,
    actor,
    type: "SUBMITTED",
    payload: transitionPayload(statusBeforeResubmit, resubmitOutcome.to),
    rulePackVersion: pack.version,
    engineVersion: ENGINE_VERSION,
  });

  // See recompute.ts's module note: the derived id is discarded in favour
  // of the existing one on purpose — do not "fix" this to use the engine's
  // own derived id. recomputeAssessment() also clears the first-opened
  // record as part of this same operation. If the engine throws (see
  // computeInPlaceOrRollback's own note — a dated, provable failure mode
  // once the committed pack's reviewDueOn passes), the matter rolls back to
  // DRAFT with a COMPUTE_FAILED record rather than being stranded in
  // COMPUTING forever (04-REVIEW.md CR-01).
  const updatedAssessment = await computeInPlaceOrRollback({
    matter,
    lines,
    existing,
    pack,
    actor,
    computingStatus: resubmitOutcome.to,
    guardInputForRollback: guardInput,
  });

  await memoryAssessmentRepository.clearInfoRequests(matterId);

  return updatedAssessment;
}

// ---------------------------------------------------------------------------
// recomputeAgainstCurrentPack — the row PRD §5's table has and this system
// has never had a caller for (STATE-03)
// ---------------------------------------------------------------------------

// Requires the LEGAL_REVIEWER role, refuses via the executor's RECOMPUTE
// row unless the matter is in legal review, delegates the in-place
// mutation to ../recompute.ts (same shared module resubmitAfterInfoRequest
// uses — the mirror-image rule is written once), then asks the executor
// for the COMPUTE_SUCCEEDED transition and writes that destination.
// Exactly one assessment exists for the matter afterwards, under the
// identity it already had. This never marks anything SUPERSEDED: that
// status exists solely for a correction made after sign-off, and this
// function runs strictly before one.
//
// No screen drives this yet (Phase 6 owns the legal review screen's
// recompute affordance) — a thin route is what makes the transition, its
// guard and its audit record drivable and testable now.
export async function recomputeAgainstCurrentPack(actor: DemoActor, assessmentId: string): Promise<Assessment> {
  requireRole(actor, "LEGAL_REVIEWER");

  const existing = await memoryAssessmentRepository.getAssessment(assessmentId);
  if (!existing) throw new NotFoundError(`No assessment with id '${assessmentId}'`);

  const matter = await memoryMatterRepository.getMatter(existing.matterId);
  if (!matter) throw new NotFoundError(`No matter found for assessment '${assessmentId}'`);

  const lines = await memoryMatterRepository.listExpenseLines(matter.id);
  const loadedPack = loadDemoPack();
  const pack = coercePackForDemoEngine(loadedPack);
  const guardInput = buildGuardInput({ matter, lines, assessment: existing, pack, actor });

  const recomputeOutcome = evaluateTransition(matter.status, "RECOMPUTE", guardInput);
  if (!recomputeOutcome.allowed) {
    throw new ConflictError(recomputeOutcome.reason);
  }

  const statusBeforeRecompute = matter.status;
  await memoryMatterRepository.updateMatter({ ...matter, status: recomputeOutcome.to });

  // A record of the RECOMPUTE transition itself, mirroring
  // resubmitAfterInfoRequest's SUBMITTED event for its own RESUBMIT
  // transition (04-REVIEW.md CR-02). Without this, the audit log could not
  // distinguish "a lawyer deliberately discarded every existing disposition
  // and recomputed against the current pack" from any other path that
  // happens to produce a COMPUTED event with before: "COMPUTING" — this is
  // the one guarded, lawyer-only, disposition-destroying transition in the
  // whole table, and it must leave a direct trace of itself.
  await recordAuditEvent({
    matterId: matter.id,
    actor,
    type: "SUBMITTED",
    payload: transitionPayload(statusBeforeRecompute, recomputeOutcome.to),
    rulePackVersion: pack.version,
    engineVersion: ENGINE_VERSION,
  });

  // See recompute.ts's module note: the derived id is discarded in favour
  // of the existing one on purpose, and the first-opened record is cleared
  // as part of the same operation so the next review pass measures its own
  // elapsed time, not the one before this recompute. If the engine throws,
  // the matter rolls back to DRAFT with a COMPUTE_FAILED record rather than
  // being stranded in COMPUTING forever (04-REVIEW.md CR-01).
  const updatedAssessment = await computeInPlaceOrRollback({
    matter,
    lines,
    existing,
    pack,
    actor,
    computingStatus: recomputeOutcome.to,
    guardInputForRollback: guardInput,
  });

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
  var __dsarNoticeSentAt: Map<string, string> | undefined;
}
const noticeSentAtByMatterId: Map<string, string> =
  globalThis.__dsarNoticeSentAt ?? (globalThis.__dsarNoticeSentAt = new Map());

// Requires the HR-preparer role, asks the executor for the MARK_SENT
// transition and writes the destination it returns, and records the date.
// It sends nothing — there is no outbound email of any kind anywhere in
// this system (NS-3), which is why the boundary note above this control
// exists; this transition records a date and moves a status, nothing
// else. (04-05 Task 2 — reverses 03.1-04's recorded assumption that this
// stayed a status-preserving side-fact; that deferral was written before
// a guarded executor existed, and this phase's own first success
// criterion names the closed status explicitly as something a matter must
// be drivable to. The outputs phase still owns document generation.)
export async function markNoticeSent(
  actor: DemoActor,
  matterId: string
): Promise<{ matterId: string; noticeSentAt: string }> {
  requireRole(actor, "HR_PREPARER");

  const matter = await memoryMatterRepository.getMatter(matterId);
  if (!matter) throw new NotFoundError(`No matter with id '${matterId}'`);

  const lines = await memoryMatterRepository.listExpenseLines(matterId);
  const guardInput = buildGuardInput({ matter, lines, assessment: null, pack: null, actor });
  const markSentOutcome = evaluateTransition(matter.status, "MARK_SENT", guardInput);
  if (!markSentOutcome.allowed) {
    throw new ConflictError(markSentOutcome.reason);
  }

  const noticeSentAt = new Date().toISOString();
  noticeSentAtByMatterId.set(matterId, noticeSentAt);

  const statusBeforeMarkSent = matter.status;
  await memoryMatterRepository.updateMatter({ ...matter, status: markSentOutcome.to });

  await recordAuditEvent({
    matterId,
    actor,
    type: "NOTICE_MARKED_SENT",
    payload: transitionPayload(statusBeforeMarkSent, markSentOutcome.to),
    rulePackVersion: null,
    engineVersion: null,
  });

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
