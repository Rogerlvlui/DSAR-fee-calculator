// packages/engine/src/preconditions.test.ts
//
// Falsifies checkPreconditions(): all six precondition codes (three from
// task 1 — PACK_NOT_ACTIVE, CONTROLLER_TYPE_NOT_IN_SCOPE, CURRENCY_MISMATCH
// — and three from this task — PACK_PAST_REVIEW_DUE,
// CLAIMED_AMOUNT_MISMATCH, NEGATIVE_UNIT_RATE), each asserting both the
// thrown `code` and that the message names the offending and expected
// values. A positive-control test proves the reference fixture passes all
// six, so a suite that only exercises failure paths cannot pass while the
// happy path is broken.
//
// CLAIMED_AMOUNT_MISMATCH and NEGATIVE_UNIT_RATE deliberately construct
// their fixtures as plain objects typed `ExpenseLine`/`Matter` rather than
// through `ExpenseLineSchema.parse()`/`MatterSchema.parse()` — a stored
// claimedAmount mismatch and a currency mismatch would both fail those
// schemas' own superRefine and never reach the engine at all if parsed.
// This models exactly the trust-boundary case preconditions.ts's module
// comment describes: a row mapped from Postgres straight into a domain
// object, never re-validated, reaching assess() unparsed.

import { describe, expect, it } from "vitest";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Minor } from "@dsar/schemas/primitives";
import { AssessPreconditionFailure } from "./errors.ts";
import { checkPreconditions } from "./preconditions.ts";
import {
  buildReferencePack,
  REFERENCE_LINE,
  REFERENCE_MATTER,
  REFERENCE_NOW,
} from "./__fixtures__/reference-matter.ts";

function expectFailure(action: () => void, code: string): AssessPreconditionFailure {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AssessPreconditionFailure);
    expect((error as AssessPreconditionFailure).code).toBe(code);
    return error as AssessPreconditionFailure;
  }
  throw new Error(`expected action to throw AssessPreconditionFailure with code '${code}'`);
}

describe("checkPreconditions", () => {
  it("positive control: the reference fixture passes all six checks", () => {
    expect(() =>
      checkPreconditions({
        matter: REFERENCE_MATTER,
        lines: [REFERENCE_LINE],
        pack: buildReferencePack(),
        now: REFERENCE_NOW,
      })
    ).not.toThrow();
  });

  it("PACK_NOT_ACTIVE: a non-ACTIVE pack is refused, naming the actual status", () => {
    const pack = buildReferencePack();
    const draftPack = { ...pack, status: "DRAFT" as const };
    const failure = expectFailure(
      () => checkPreconditions({ matter: REFERENCE_MATTER, lines: [REFERENCE_LINE], pack: draftPack, now: REFERENCE_NOW }),
      "PACK_NOT_ACTIVE"
    );
    expect(failure.message).toContain("DRAFT");
    expect(failure.message).toContain("ACTIVE");
  });

  it("PACK_PAST_REVIEW_DUE: a pack whose reviewDueOn is strictly before now's calendar date is refused, naming both dates", () => {
    const pack = buildReferencePack();
    const pastDuePack = { ...pack, reviewDueOn: "2026-09-14" };
    const failure = expectFailure(
      () =>
        checkPreconditions({
          matter: REFERENCE_MATTER,
          lines: [REFERENCE_LINE],
          pack: pastDuePack,
          now: REFERENCE_NOW,
        }),
      "PACK_PAST_REVIEW_DUE"
    );
    expect(failure.message).toContain("2026-09-14");
    expect(failure.message).toContain(REFERENCE_NOW);
  });

  it("PACK_PAST_REVIEW_DUE: a pack due exactly today (AC-39 is 'past', not 'on') does NOT throw", () => {
    const pack = buildReferencePack();
    const dueTodayPack = { ...pack, reviewDueOn: "2026-09-15" };
    expect(() =>
      checkPreconditions({
        matter: REFERENCE_MATTER,
        lines: [REFERENCE_LINE],
        pack: dueTodayPack,
        now: REFERENCE_NOW,
      })
    ).not.toThrow();
  });

  it("CONTROLLER_TYPE_NOT_IN_SCOPE: a controllerType outside the pack's appliesTo is refused", () => {
    const pack = buildReferencePack();
    const narrowedPack = { ...pack, appliesTo: ["PUBLIC_AGENCY"] as const };
    const failure = expectFailure(
      () =>
        checkPreconditions({
          matter: REFERENCE_MATTER,
          lines: [REFERENCE_LINE],
          pack: narrowedPack,
          now: REFERENCE_NOW,
        }),
      "CONTROLLER_TYPE_NOT_IN_SCOPE"
    );
    expect(failure.message).toContain("PRIVATE_ORGANISATION");
    expect(failure.message).toContain("PUBLIC_AGENCY");
  });

  it("CURRENCY_MISMATCH: a matter currency that does not match its jurisdiction's designated currency is refused", () => {
    const mismatchedMatter: Matter = { ...REFERENCE_MATTER, currency: "HKD" };
    const failure = expectFailure(
      () =>
        checkPreconditions({
          matter: mismatchedMatter,
          lines: [REFERENCE_LINE],
          pack: buildReferencePack(),
          now: REFERENCE_NOW,
        }),
      "CURRENCY_MISMATCH"
    );
    expect(failure.message).toContain("HKD");
    expect(failure.message).toContain("SGD");
  });

  it("CLAIMED_AMOUNT_MISMATCH: a stored claimedAmount that does not equal quantity * unitRate is refused, naming both values", () => {
    const mismatchedLine: ExpenseLine = {
      ...REFERENCE_LINE,
      claimedAmount: (REFERENCE_LINE.claimedAmount + 1) as Minor,
    };
    const failure = expectFailure(
      () =>
        checkPreconditions({
          matter: REFERENCE_MATTER,
          lines: [mismatchedLine],
          pack: buildReferencePack(),
          now: REFERENCE_NOW,
        }),
      "CLAIMED_AMOUNT_MISMATCH"
    );
    expect(failure.message).toContain("16001");
    expect(failure.message).toContain("16000");
  });

  it("NEGATIVE_UNIT_RATE: a negative unitRate is refused, naming the line id and the rate", () => {
    const negativeRateLine: ExpenseLine = {
      ...REFERENCE_LINE,
      unitRate: -100 as Minor,
      claimedAmount: (REFERENCE_LINE.quantity * -100) as Minor,
    };
    const failure = expectFailure(
      () =>
        checkPreconditions({
          matter: REFERENCE_MATTER,
          lines: [negativeRateLine],
          pack: buildReferencePack(),
          now: REFERENCE_NOW,
        }),
      "NEGATIVE_UNIT_RATE"
    );
    expect(failure.message).toContain(REFERENCE_LINE.id);
    expect(failure.message).toContain("-100");
  });
});
