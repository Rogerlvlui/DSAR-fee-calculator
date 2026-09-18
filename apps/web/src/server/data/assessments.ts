// apps/web/src/server/data/assessments.ts

import "../server-only.ts";
import type { Assessment } from "@dsar/schemas/assessment";
import { ForbiddenError, NotFoundError } from "../errors.ts";
import { requireRole, type DemoActor } from "./auth.ts";
import { memoryAssessmentRepository } from "../repositories/memory/assessment-repository.ts";
import { memoryMatterRepository } from "../repositories/memory/matter-repository.ts";

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
