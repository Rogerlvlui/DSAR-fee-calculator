// packages/workflow/src/evaluate-transition.test.ts
//
// One block per PRD §5 guard-table row, both the permitted case and at
// least one refusal per precondition that row names, asserting the
// refusal reason names the specific condition rather than merely that a
// refusal occurred. Tagged GUARD-TABLE.

import { describe, expect, it } from "vitest";
import { evaluateTransition } from "./evaluate-transition.ts";
import type { GuardInput } from "@dsar/schemas/guard-input";
import type { UserRef } from "@dsar/schemas/primitives";

const LAWYER: UserRef = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  displayName: "Jane Reviewer",
  email: "jane.reviewer@example.com",
};

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

describe("GUARD-TABLE — COMPUTE_SUCCEEDED (COMPUTING -> LEGAL_REVIEW)", () => {
  const computingInput: GuardInput = {
    ...BASE_INPUT,
    matterStatus: "COMPUTING",
    expenseLineCount: 3,
    pendingLineCount: 3,
  };

  it("GUARD-TABLE: refuses when the assessment does not yet cover every expense line", () => {
    const outcome = evaluateTransition("COMPUTING", "COMPUTE_SUCCEEDED", {
      ...computingInput,
      pendingLineCount: 2,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("does not yet cover every expense line");
  });

  it("GUARD-TABLE: permits when the pending count equals the expense-line count", () => {
    const outcome = evaluateTransition("COMPUTING", "COMPUTE_SUCCEEDED", computingInput);
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("LEGAL_REVIEW");
  });
});

describe("GUARD-TABLE — COMPUTE_FAILED (COMPUTING -> DRAFT)", () => {
  it("GUARD-TABLE: permits the rollback unconditionally, so a matter is never stranded mid-computation", () => {
    const outcome = evaluateTransition("COMPUTING", "COMPUTE_FAILED", {
      ...BASE_INPUT,
      matterStatus: "COMPUTING",
      pack: null,
      expenseLineCount: 0,
      attestationsAddressed: false,
    });
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("DRAFT");
  });
});

describe("GUARD-TABLE — RAISE_QUERY (LEGAL_REVIEW -> INFO_REQUEST)", () => {
  it("GUARD-TABLE: refuses when no lawyer identity is recorded", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "RAISE_QUERY", {
      ...BASE_INPUT,
      matterStatus: "LEGAL_REVIEW",
      lawyerIdentity: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("lawyer identity");
  });

  it("GUARD-TABLE: permits when a lawyer identity is recorded", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "RAISE_QUERY", {
      ...BASE_INPUT,
      matterStatus: "LEGAL_REVIEW",
      lawyerIdentity: LAWYER,
    });
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("INFO_REQUEST");
  });
});

describe("GUARD-TABLE — RESUBMIT (INFO_REQUEST -> COMPUTING)", () => {
  const infoRequestInput: GuardInput = { ...BASE_INPUT, matterStatus: "INFO_REQUEST" };

  it("GUARD-TABLE: refuses when the matter has no expense lines, same as SUBMIT", () => {
    const outcome = evaluateTransition("INFO_REQUEST", "RESUBMIT", {
      ...infoRequestInput,
      expenseLineCount: 0,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("expense line");
  });

  it("GUARD-TABLE: refuses for a stale pack identically to the SUBMIT row's refusal for the same input, proving the shared predicate", () => {
    const stalePackInput: GuardInput = {
      ...infoRequestInput,
      pack: { ...infoRequestInput.pack!, status: "STALE", reviewDueOn: "2026-01-01" },
    };
    const resubmitOutcome = evaluateTransition("INFO_REQUEST", "RESUBMIT", stalePackInput);
    const submitOutcome = evaluateTransition("DRAFT", "SUBMIT", { ...stalePackInput, matterStatus: "DRAFT" });
    expect(resubmitOutcome.allowed).toBe(false);
    expect(submitOutcome.allowed).toBe(false);
    if (!resubmitOutcome.allowed && !submitOutcome.allowed) {
      expect(resubmitOutcome.reason).toBe(submitOutcome.reason);
    }
  });

  it("GUARD-TABLE: refuses a currency mismatch identically to the SUBMIT row's refusal for the same input, proving the shared predicate", () => {
    const mismatchedCurrencyInput: GuardInput = { ...infoRequestInput, currency: "HKD" };
    const resubmitOutcome = evaluateTransition("INFO_REQUEST", "RESUBMIT", mismatchedCurrencyInput);
    const submitOutcome = evaluateTransition("DRAFT", "SUBMIT", {
      ...mismatchedCurrencyInput,
      matterStatus: "DRAFT",
    });
    expect(resubmitOutcome.allowed).toBe(false);
    expect(submitOutcome.allowed).toBe(false);
    if (!resubmitOutcome.allowed && !submitOutcome.allowed) {
      expect(resubmitOutcome.reason).toBe(submitOutcome.reason);
    }
  });

  it("GUARD-TABLE: permits when the pack, currency and line-count conditions are all satisfied, without requiring attestations to be re-addressed", () => {
    const outcome = evaluateTransition("INFO_REQUEST", "RESUBMIT", {
      ...infoRequestInput,
      attestationsAddressed: false,
    });
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("COMPUTING");
  });
});

describe("GUARD-TABLE — RECOMPUTE (LEGAL_REVIEW -> COMPUTING)", () => {
  const legalReviewInput: GuardInput = {
    ...BASE_INPUT,
    matterStatus: "LEGAL_REVIEW",
    lawyerIdentity: LAWYER,
  };

  it("GUARD-TABLE: refuses when no lawyer identity is recorded", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "RECOMPUTE", {
      ...legalReviewInput,
      lawyerIdentity: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("lawyer identity");
  });

  it("GUARD-TABLE: refuses when no pack is available", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "RECOMPUTE", {
      ...legalReviewInput,
      pack: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("No rule pack is available");
  });

  it("GUARD-TABLE: permits when a lawyer identity is recorded and a pack is available", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "RECOMPUTE", legalReviewInput);
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("COMPUTING");
  });
});

describe("GUARD-TABLE — SIGN_OFF (LEGAL_REVIEW -> SIGNED_OFF)", () => {
  const readyToSignInput: GuardInput = {
    ...BASE_INPUT,
    matterStatus: "LEGAL_REVIEW",
    pendingLineCount: 0,
    matterLevelFlagsRequiringAck: ["LITIGATION_POSTURE"],
    acknowledgedFlags: ["LITIGATION_POSTURE"],
    lawyerIdentity: LAWYER,
  };

  it("GUARD-TABLE: refuses when any line is still pending", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "SIGN_OFF", {
      ...readyToSignInput,
      pendingLineCount: 1,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("pending disposition");
  });

  it("GUARD-TABLE: refuses when a flag requiring acknowledgement is unacknowledged", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "SIGN_OFF", {
      ...readyToSignInput,
      acknowledgedFlags: [],
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) {
      expect(outcome.reason).toContain("acknowledgement");
      expect(outcome.reason).toContain("LITIGATION_POSTURE");
    }
  });

  it("GUARD-TABLE: refuses when no lawyer identity is recorded", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "SIGN_OFF", {
      ...readyToSignInput,
      lawyerIdentity: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("lawyer identity");
  });

  it("GUARD-TABLE: refuses when no pack is pinned", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "SIGN_OFF", {
      ...readyToSignInput,
      pack: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason).toContain("No rule pack is available");
  });

  it("GUARD-TABLE: permits when every one of the four conditions is met", () => {
    const outcome = evaluateTransition("LEGAL_REVIEW", "SIGN_OFF", readyToSignInput);
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("SIGNED_OFF");
  });
});

describe("GUARD-TABLE — MARK_SENT (SIGNED_OFF -> CLOSED)", () => {
  it("GUARD-TABLE: is permitted", () => {
    const outcome = evaluateTransition("SIGNED_OFF", "MARK_SENT", {
      ...BASE_INPUT,
      matterStatus: "SIGNED_OFF",
    });
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("CLOSED");
  });
});

describe("GUARD-TABLE — SUPERSEDE (SIGNED_OFF or CLOSED -> SUPERSEDED)", () => {
  it("GUARD-TABLE: exists from SIGNED_OFF, refused when no lawyer identity is recorded", () => {
    const outcome = evaluateTransition("SIGNED_OFF", "SUPERSEDE", {
      ...BASE_INPUT,
      matterStatus: "SIGNED_OFF",
      lawyerIdentity: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("lawyer identity");
  });

  it("GUARD-TABLE: exists from SIGNED_OFF, permitted when a lawyer identity is recorded", () => {
    const outcome = evaluateTransition("SIGNED_OFF", "SUPERSEDE", {
      ...BASE_INPUT,
      matterStatus: "SIGNED_OFF",
      lawyerIdentity: LAWYER,
    });
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("SUPERSEDED");
  });

  it("GUARD-TABLE: exists from CLOSED, refused when no lawyer identity is recorded", () => {
    const outcome = evaluateTransition("CLOSED", "SUPERSEDE", {
      ...BASE_INPUT,
      matterStatus: "CLOSED",
      lawyerIdentity: null,
    });
    expect(outcome.allowed).toBe(false);
    if (!outcome.allowed) expect(outcome.reason.toLowerCase()).toContain("lawyer identity");
  });

  it("GUARD-TABLE: exists from CLOSED, permitted when a lawyer identity is recorded", () => {
    const outcome = evaluateTransition("CLOSED", "SUPERSEDE", {
      ...BASE_INPUT,
      matterStatus: "CLOSED",
      lawyerIdentity: LAWYER,
    });
    expect(outcome.allowed).toBe(true);
    if (outcome.allowed) expect(outcome.to).toBe("SUPERSEDED");
  });
});
