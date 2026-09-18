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
    const assessment = [...demoStore.assessments.values()].find(
      (candidate) => candidate.matterId === matterId
    );
    return assessment ? structuredClone(assessment) : null;
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
