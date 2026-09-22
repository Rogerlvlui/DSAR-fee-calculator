// prisma.config.ts
//
// Prisma 7 moved the connection URL out of `datasource { url = ... }` in
// schema.prisma (that syntax is rejected — "P1012 ... no longer supported
// in schema files") and into this config file instead. This is why
// `prisma/schema.prisma` declares only `provider = "postgresql"`.
//
// D-08: this is the migrator's connection string. `prisma migrate` (and
// `prisma validate`/`prisma generate`, which need no live database at all)
// read DATABASE_URL from here. The running app never uses this file or this
// env var — it connects with RUNTIME_DATABASE_URL instead (see
// .env.example), which is asserted at boot to never equal the migrator's
// connection (Phase 3.2 plan 03.2-01 wires the boot assertion; this plan
// only documents the split).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
