// packages/rulepacks/src/validate.ts
//
// The build-time gate (PACK-11, T-03-02): one check per requirement, first
// violation throws. This task implements the PACK-11 banned-word scan only
// — PACK-02/PACK-03's exhaustiveness/ACTIVE-readiness gates are later plans
// in this phase.
//
// `findBannedWord` is transcribed VERBATIM from
// packages/engine/src/engine-language.test.ts — case-sensitive, word-
// boundary anchored, over the SAME `LEGAL_CONCLUSION_BANNED_WORDS` list.
// CONTEXT.md records that a case-insensitive matcher was empirically shown
// to break 6 of 21 legitimate message templates using "Legal" as the
// department's proper noun — do not author a second list or a second,
// case-insensitive matcher.

import { LEGAL_CONCLUSION_BANNED_WORDS } from "@dsar/schemas/constants";
import type { LoadableRulePack } from "@dsar/schemas/rule-pack";
import { loadAllRulePacks, RULEPACKS_ROOT } from "./loader.ts";

export type RulePackValidationCode = "BANNED_WORD_IN_BASIS";

export class RulePackValidationFailure extends Error {
  readonly code: RulePackValidationCode;
  readonly packId: string;
  // Not declared with a `?` optional modifier: under this project's
  // `exactOptionalPropertyTypes`, an optional property may never be
  // explicitly assigned `undefined` (only omitted entirely) — but the
  // constructor always assigns this field, so its type must include
  // `undefined` explicitly instead.
  readonly ruleId: string | undefined;

  constructor(
    code: RulePackValidationCode,
    packId: string,
    message: string,
    ruleId?: string
  ) {
    super(message);
    this.name = "RulePackValidationFailure";
    this.code = code;
    this.packId = packId;
    this.ruleId = ruleId;
  }
}

// Verbatim from packages/engine/src/engine-language.test.ts (PACK-11 reuse —
// same list, same matcher, no second copy).
export function findBannedWord(text: string): string | null {
  for (const word of LEGAL_CONCLUSION_BANNED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`); // case-sensitive by default, word-boundary anchored
    if (pattern.test(text)) return word;
  }
  return null;
}

// PACK-11: every categoryRules[].basis, plus flatFee.basis where present, is
// scanned. First match throws — no partial success, matching
// packages/engine/src/preconditions.ts's established pattern.
export function validateRulePack(pack: LoadableRulePack): void {
  for (const rule of pack.categoryRules) {
    const match = findBannedWord(rule.basis);
    if (match) {
      throw new RulePackValidationFailure(
        "BANNED_WORD_IN_BASIS",
        pack.packId,
        `Pack "${pack.packId}" rule "${rule.ruleId}" basis contains banned word "${match}"`,
        rule.ruleId
      );
    }
  }

  if (pack.flatFee) {
    const match = findBannedWord(pack.flatFee.basis);
    if (match) {
      throw new RulePackValidationFailure(
        "BANNED_WORD_IN_BASIS",
        pack.packId,
        `Pack "${pack.packId}" flatFee basis contains banned word "${match}"`
      );
    }
  }
}

export function validateAllRulePacks(root: string = RULEPACKS_ROOT): void {
  const packs = loadAllRulePacks(root);
  for (const pack of packs) {
    validateRulePack(pack);
  }
}
