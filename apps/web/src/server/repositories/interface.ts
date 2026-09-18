// apps/web/src/server/repositories/interface.ts
//
// MatterRepository / AssessmentRepository as plain TypeScript interfaces.
// Method vocabulary is @dsar/schemas types only — never a storage-specific
// row shape. This module must import nothing from ./memory or a future
// ./prisma directory: that single property is success criterion 4, and
// .dependency-cruiser.cjs's no-store-impl-in-repository-interface rule
// (Task 3) makes it a CI fact rather than a convention.
//
// The whole surface is authored now, including methods later plans consume,
// so no later plan has to reopen this file.

import "../server-only.ts";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Assessment } from "@dsar/schemas/assessment";
import type { InfoRequest } from "../../domain/info-request.ts";

export interface MatterRepository {
  createMatter(matter: Matter): Promise<Matter>;
  getMatter(id: string): Promise<Matter | null>;
  updateMatter(matter: Matter): Promise<Matter>;
  addExpenseLine(line: ExpenseLine): Promise<ExpenseLine>;
  listExpenseLines(matterId: string): Promise<ExpenseLine[]>;
  replaceExpenseLine(line: ExpenseLine): Promise<ExpenseLine>;
  deleteExpenseLine(matterId: string, lineId: string): Promise<void>;
}

export interface AssessmentRepository {
  saveAssessment(assessment: Assessment): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | null>;
  getAssessmentByMatterId(matterId: string): Promise<Assessment | null>;
  updateAssessment(assessment: Assessment): Promise<Assessment>;
  // Added in Plan 03.1-03, Task 2: the disposition route only knows the
  // assessment LINE id (from its own path segment), not the assessment id
  // it belongs to — this is the lookup that resolves one from the other.
  findByLineId(assessmentLineId: string): Promise<Assessment | null>;

  // Added in Plan 03.1-04, Task 2 — the first extension of this interface
  // after Plan 01: the information-request collection Ask HR needs. Kept in
  // the same vocabulary style as the methods above (plain domain types in,
  // plain domain types out) rather than letting a storage-specific shape
  // leak into the signature. `InfoRequest` is deliberately NOT a
  // @dsar/schemas type — see apps/web/src/domain/info-request.ts's own note.
  listInfoRequests(matterId: string): Promise<InfoRequest[]>;
  appendInfoRequest(request: InfoRequest): Promise<InfoRequest>;
  clearInfoRequests(matterId: string): Promise<void>;
}
