// packages/workflow/src/evaluate-transition.test.ts
//
// One block per PRD §5 guard-table row this plan implements (DRAFT ->
// COMPUTING via SUBMIT), both the permitted case and every refused case the
// row's guard list carries. Tagged GUARD-TABLE. The remaining eight rows'
// tests land in plan 04-02.

import { describe, expect, it } from "vitest";
import { evaluateTransition } from "./evaluate-transition.ts";
import type { GuardInput } from "@dsar/schemas/guard-input";

const BASE_INPUT: GuardInput = {
  matterStatus: "DRAFT",
  expenseLineCount: 1,
  jurisdictionCode: "SG",
  currency: "SGD",
  controllerType: "PRIVATE_ORGANISATION",
  pack: {
    status: "ACTIVE",
    reviewDueOn: "2027-03-12",
    appliesTo: ["PRIVATE_ORGANISATION", "PUBLIC_AGENCY"],
  },
  attestationsAddressed: true,
  pendingLineCount: 0,
  matterLevelFlagsRequiringAck: [],
  acknowledgedFlags: [],
  lawyerIdentity: null,
};

describe("GUARD-TABLE — evaluateTransition", () => {
  it("GUARD-TABLE: refuses an event with no matching row, naming the origin and the event, and returns no destination", () => {
    const outcome = evaluateTransition("SIGNED_OFF", "SUBMIT", BASE_INPUT);
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.reason).toContain("SIGNED_OFF");
      expect(outcome.reason).toContain("SUBMIT");
    }
    expect("to" in outcome).toBe(false);
  });

  it("GUARD-TABLE: refuses SUBMIT when the matter has no expense lines", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", { ...BASE_INPUT, expenseLineCount: 0 });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("expense line");
  });

  it("GUARD-TABLE: refuses SUBMIT when no rule pack is available for the jurisdiction", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", { ...BASE_INPUT, pack: null });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("SG");
  });

  it("GUARD-TABLE: refuses SUBMIT when the pack is DRAFT (not active)", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", {
      ...BASE_INPUT,
      pack: { ...BASE_INPUT.pack!, status: "DRAFT" },
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("DRAFT");
  });

  it("GUARD-TABLE: refuses SUBMIT when the pack is WITHDRAWN", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", {
      ...BASE_INPUT,
      pack: { ...BASE_INPUT.pack!, status: "WITHDRAWN" },
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("WITHDRAWN");
  });

  it("GUARD-TABLE: refuses SUBMIT when the pack is STALE, naming its review date, separately from the not-active case", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", {
      ...BASE_INPUT,
      pack: { ...BASE_INPUT.pack!, status: "STALE", reviewDueOn: "2026-01-01" },
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.reason).toContain("STALE");
      expect(outcome.reason).toContain("2026-01-01");
    }
  });

  it("GUARD-TABLE: refuses SUBMIT when the matter's currency does not match its jurisdiction's designated currency, naming both", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", { ...BASE_INPUT, currency: "HKD" });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.reason).toContain("HKD");
      expect(outcome.reason).toContain("SGD");
    }
  });

  it("GUARD-TABLE: refuses SUBMIT when the intake attestations have not been addressed", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", { ...BASE_INPUT, attestationsAddressed: false });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("attestation");
  });

  it("GUARD-TABLE: permits SUBMIT for a matter satisfying every condition, returning COMPUTING as the destination", () => {
    const outcome = evaluateTransition("DRAFT", "SUBMIT", BASE_INPUT);
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("COMPUTING");
  });
});
