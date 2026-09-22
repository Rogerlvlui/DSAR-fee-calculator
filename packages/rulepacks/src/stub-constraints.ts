// packages/rulepacks/src/stub-constraints.ts
//
// D-18 (03-CONTEXT.md) — the constraints skeleton every unauthored stub
// pack ships with: all eleven `StubConstraints` keys present, every value
// `null`. `null` means "not researched" — never collapsed with `false`
// ("researched and negative"). Parsed through `StubConstraintsSchema` at
// module load so a key typo (a missing or misspelled key) is a load-time
// failure here, not a silent gap discovered later inside a committed pack.

import { StubConstraintsSchema, type StubConstraints } from "@dsar/schemas/rule-pack";

const RAW_STUB_CONSTRAINTS = {
  noChargeForMakingRequest: null,
  estimateRequiredBeforeCharging: null,
  feeNotificationDeadlineDays: null,
  deadlineBasis: null,
  responseDeadlineDays: null,
  advancePaymentPermitted: null,
  mayWithholdDataUntilPaid: null,
  profitElementPermitted: null,
  deterrentUsePermitted: null,
  regulatorMayReviewFee: null,
  aggregateCap: null,
};

export const STUB_CONSTRAINTS: StubConstraints = StubConstraintsSchema.parse(RAW_STUB_CONSTRAINTS);
