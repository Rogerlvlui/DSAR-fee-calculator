// apps/web/app/hr/layout.tsx
//
// The HR section shell — a real `/hr` path segment (06-04; previously the
// `(hr)` route group, which contributed no URL segment at all). This is the
// single mount point for DISC-01's capability-statement gate: every present
// and future page under `/hr/matters/*` is wrapped here, so no page opts in
// individually and none can forget to. `StatusStrip` stays a page-level
// composition — this layout sits above any dynamic `[id]` segment beneath
// it, and Next.js does not thread a descendant route's params up to an
// ancestor layout, so a single strip correct for a specific matter, a
// cross-jurisdiction list and a not-yet-created draft cannot be computed
// generically here (05-01 Plan).

import type { ReactNode } from "react";
import { CapabilityStatement } from "../../src/ui/capability/capability-statement.tsx";

export default function HrLayout({ children }: { children: ReactNode }) {
  return <CapabilityStatement>{children}</CapabilityStatement>;
}
