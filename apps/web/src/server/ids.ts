// apps/web/src/server/ids.ts
//
// MatterSchema.id / UserRefSchema.id are `z.ulid()` — a format validator,
// not a generator. `ulid` (product-owner-approved, 2026-09-18) is the
// reference implementation for that exact format. A module-load assertion
// that `UlidSchema.parse(newUlid())` succeeds means a bad generator fails at
// boot, not at the worst possible moment of a live demo.

import "./server-only.ts";
import { ulid } from "ulid";
import { UlidSchema } from "@dsar/schemas/primitives";

export function newUlid(): string {
  return ulid();
}

UlidSchema.parse(newUlid());
