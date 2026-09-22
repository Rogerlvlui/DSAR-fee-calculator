// packages/rulepacks/src/prototype-counsel.ts
//
// D-17 (03-CONTEXT.md): a pack's `authoredBy`/`reviewedBy` name a seeded
// prototype user — a fixed ULID, a `displayName` naming the product owner
// as authoring counsel, and a non-routable `example.invalid` address. The
// pack JSON and the seeded `User` rows Phase 3.2's Prisma seed creates agree
// by construction because both read this same constant.
//
// The ULID is fixed and stable because it is referenced by seed data, pack
// JSON and every audit event naming this actor (see this plan's
// <reversibility> note) — changing it later means rewriting all three
// together. `UserRefSchema.parse()` runs at module load so a malformed
// literal is a load-time failure, not a runtime surprise.
//
// D-17's accepted cost: the email address below is DELIBERATELY FAKE
// (`example.invalid`, RFC 2606 — guaranteed never to resolve) and MUST be
// swapped for a real reviewer's address before any pilot deployment. Author
// and reviewer being the same person here is the arrangement PROJECT.md's
// "Product owner authors the HK and SG packs" decision records, not a
// conflict of interest this file is failing to notice.

import { UserRefSchema, type UserRef } from "@dsar/schemas/primitives";

export const PROTOTYPE_COUNSEL: UserRef = UserRefSchema.parse({
  id: "01K5GSD0PRT0TYPECNSE000001",
  displayName: "Product Owner — Prototype Authoring Counsel",
  email: "product-owner@example.invalid",
});
