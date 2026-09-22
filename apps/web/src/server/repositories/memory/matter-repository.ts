// apps/web/src/server/repositories/memory/matter-repository.ts
//
// Deep-copy on every read and every write with structuredClone, so a caller
// mutating a returned object cannot reach into the store. That is the one
// behaviour a Prisma implementation gives for free and an in-memory one has
// to be written to give.

import "../../server-only.ts";
import type { MatterRepository } from "../interface.ts";
import { demoStore } from "./store.ts";

export const memoryMatterRepository: MatterRepository = {
  async createMatter(matter) {
    const copy = structuredClone(matter);
    demoStore.matters.set(copy.id, copy);
    return structuredClone(copy);
  },

  async getMatter(id) {
    const matter = demoStore.matters.get(id);
    return matter ? structuredClone(matter) : null;
  },

  async listMatters() {
    return [...demoStore.matters.values()].map((matter) => structuredClone(matter));
  },

  async updateMatter(matter) {
    const copy = structuredClone(matter);
    demoStore.matters.set(copy.id, copy);
    return structuredClone(copy);
  },

  async addExpenseLine(line) {
    const copy = structuredClone(line);
    demoStore.expenseLines.set(copy.id, copy);
    return structuredClone(copy);
  },

  async listExpenseLines(matterId) {
    return [...demoStore.expenseLines.values()]
      .filter((line) => line.matterId === matterId)
      .sort((a, b) => a.seq - b.seq)
      .map((line) => structuredClone(line));
  },

  async replaceExpenseLine(line) {
    const copy = structuredClone(line);
    demoStore.expenseLines.set(copy.id, copy);
    return structuredClone(copy);
  },

  async deleteExpenseLine(_matterId, lineId) {
    demoStore.expenseLines.delete(lineId);
  },
};
