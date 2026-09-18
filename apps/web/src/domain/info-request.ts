// apps/web/src/domain/info-request.ts
//
// InfoRequest — a demo-scoped type, deliberately NOT part of the frozen
// @dsar/schemas package. PRD §6 defines no such entity, the frozen schemas
// are additive-only, and inventing one there to serve this one demo branch
// would be the wrong kind of permanence. Phase 4 or Phase 6 gives Ask HR a
// real, audited home; this is the minimal shape this plan's own branch
// needs to exist at all.
//
// Pure and lives under src/domain/ so both the server data layer
// (apps/web/src/server/data/assessments.ts) and the presentational panel
// (apps/web/src/ui/hr/info-request-panel.tsx) share the same shape.

export interface InfoRequest {
  id: string;
  matterId: string;
  assessmentLineId: string;
  query: string;
  raisedBy: {
    id: string;
    displayName: string;
  };
  raisedAt: string;
}
