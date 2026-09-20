// apps/web/src/domain/pack-display-status.ts
//
// Relocated from apps/web/src/ui/intake/matter-details-fields.tsx (a
// "use client" module) after it produced a live server/client boundary
// crash: apps/web/app/hr/matters/[id]/submitted/page.tsx and
// apps/web/app/hr/matters/[id]/page.tsx (both Server Components) called
// humanizePackDisplayStatus() directly, which Next.js refuses at runtime —
// a Server Component may render a client component, but it may never call
// a function that lives on the client side of the React Server Components
// boundary. This module carries no "use client" directive and imports
// nothing from apps/web/src/server or apps/web/src/ui, so it is safe to
// call from either side.
//
// The type name below still reads correctly even outside
// matter-details-fields.tsx: the value it describes is
// MatterDetailsJurisdictionPack.displayStatus, which stays defined in that
// file (only this type and function moved out).

export type MatterDetailsJurisdictionPackDisplayStatus =
  | "ACTIVE"
  | "ACTIVE_REVIEW_DUE_SOON"
  | "STALE"
  | "DRAFT"
  | "NO_USABLE_PACK";

// Added post-plan (05-REVIEW-ADDENDUM.md WR-02, independent code review
// finding): three HR-facing call sites (IntakeForm, the HR result page, and
// the submitted-confirmation page) were passing the raw displayStatus enum
// value straight into StatusStrip's packStatus prop, which renders it as
// plain text — so HR would eventually see a literal underscored string like
// "ACTIVE_REVIEW_DUE_SOON" once any pack left DRAFT. The parallel
// legal-review page passes the real RulePackStatus ("ACTIVE"/"DRAFT"/
// "WITHDRAWN") instead, which is already a short, human word — this gives
// the HR-facing callers an equivalent short label rather than the longer,
// day-count-aware sentence jurisdictionStatusLabel() (still in
// matter-details-fields.tsx) renders for the intake screen's own dedicated
// readout. NO_USABLE_PACK resolves directly to the same "—" placeholder
// every call site already used, so callers no longer need their own
// ternary for it.
export function humanizePackDisplayStatus(displayStatus: MatterDetailsJurisdictionPackDisplayStatus): string {
  switch (displayStatus) {
    case "ACTIVE":
      return "Active";
    case "ACTIVE_REVIEW_DUE_SOON":
      return "Active — review due soon";
    case "STALE":
      return "Stale";
    case "DRAFT":
      return "Draft";
    case "NO_USABLE_PACK":
      return "—";
  }
}
