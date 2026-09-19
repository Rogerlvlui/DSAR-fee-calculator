// apps/web/src/server/repositories/memory/assessment-repository.ts
//
// See matter-repository.ts's module note on structuredClone: the same
// isolation-on-read/write discipline applies here.

import "../../server-only.ts";
import type { AssessmentRepository } from "../interface.ts";
import { demoStore } from "./store.ts";

export const memoryAssessmentRepository: AssessmentRepository = {
  async saveAssessment(assessment) {
    const copy = structuredClone(assessment);
    demoStore.assessments.set(copy.id, copy);
    return structuredClone(copy);
  },

  async getAssessment(id) {
    const assessment = demoStore.assessments.get(id);
    return assessment ? structuredClone(assessment) : null;
  },

  async getAssessmentByMatterId(matterId) {
    // Returns the LAST assessment written for this matter, not the first.
    // With exactly one assessment on file (every matter, before a
    // correction ever exists) this is identical to the old first-match
    // behaviour. Once a correction has been raised, two assessments share
    // a matterId — the signed original and the newly raised correction —
    // and every preparer-facing and legal-review read must see the live
    // one, never the superseded original it replaced.
    const matches = [...demoStore.assessments.values()].filter(
      (candidate) => candidate.matterId === matterId
    );
    const assessment = matches.at(-1) ?? null;
    return assessment ? structuredClone(assessment) : null;
  },

  async listAssessmentsByMatterId(matterId) {
    // Map iteration order is insertion order, and a correction is always
    // saved under a freshly generated id rather than overwriting an
    // existing key, so this is already "in the order they were written"
    // with no separate sort needed.
    return [...demoStore.assessments.values()]
      .filter((candidate) => candidate.matterId === matterId)
      .map((candidate) => structuredClone(candidate));
  },

  async updateAssessment(assessment) {
    const copy = structuredClone(assessment);
    demoStore.assessments.set(copy.id, copy);
    return structuredClone(copy);
  },

  async findByLineId(assessmentLineId) {
    const assessment = [...demoStore.assessments.values()].find((candidate) =>
      candidate.lines.some((line) => line.id === assessmentLineId)
    );
    return assessment ? structuredClone(assessment) : null;
  },

  async listInfoRequests(matterId) {
    return [...demoStore.infoRequests.values()]
      .filter((request) => request.matterId === matterId)
      .map((request) => structuredClone(request));
  },

  async appendInfoRequest(request) {
    const copy = structuredClone(request);
    demoStore.infoRequests.set(copy.id, copy);
    return structuredClone(copy);
  },

  async clearInfoRequests(matterId) {
    for (const [id, request] of demoStore.infoRequests) {
      if (request.matterId === matterId) {
        demoStore.infoRequests.delete(id);
      }
    }
  },
};
