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
};
