// packages/schemas/src/personal-data-pattern.test.ts
//
// Tests tagged with the file's own subject name (personal-data-pattern), per
// the automated verify filter `pnpm vitest run --project schemas -t
// "personal-data-pattern"`.

import { describe, expect, it } from "vitest";
import { detectLikelyPersonalData } from "./personal-data-pattern.ts";

describe("personal-data-pattern: detectLikelyPersonalData", () => {
  it("personal-data-pattern: detects an email address anywhere in the string", () => {
    const result = detectLikelyPersonalData("contact jane.doe@example.com for details");
    expect(result.matched).toBe(true);
    expect(result.reason).toContain("email address");
  });

  it("personal-data-pattern: detects a Singapore NRIC/FIN-shaped token", () => {
    const result = detectLikelyPersonalData("ref S1234567A on file");
    expect(result.matched).toBe(true);
    expect(result.reason).toContain("NRIC/FIN");
  });

  it("personal-data-pattern: the NRIC/FIN reason is distinct from the email reason", () => {
    const email = detectLikelyPersonalData("jane.doe@example.com");
    const nric = detectLikelyPersonalData("S1234567A");
    expect(email.reason).not.toBe(nric.reason);
  });

  it("personal-data-pattern: detects a run of seven or more consecutive digits with no NRIC/FIN shape", () => {
    const result = detectLikelyPersonalData("account number 12345678 on the invoice");
    expect(result.matched).toBe(true);
    expect(result.reason).toContain("digit run");
  });

  it("personal-data-pattern: the long-digit-run reason is distinct from the NRIC/FIN reason", () => {
    const digitRun = detectLikelyPersonalData("12345678");
    const nric = detectLikelyPersonalData("S1234567A");
    expect(digitRun.reason).not.toBe(nric.reason);
  });

  it("personal-data-pattern: an ordinary sentence with no matching pattern returns matched false and reason null", () => {
    const result = detectLikelyPersonalData("Staff time locating and retrieving the requested records");
    expect(result.matched).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("personal-data-pattern: a plausible invoice-number-shaped string does not match the digit-run pattern", () => {
    const result = detectLikelyPersonalData("INV-88421");
    expect(result.matched).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("personal-data-pattern: never throws for any string input, including the empty string", () => {
    expect(() => detectLikelyPersonalData("")).not.toThrow();
    expect(detectLikelyPersonalData("").matched).toBe(false);
  });
});
