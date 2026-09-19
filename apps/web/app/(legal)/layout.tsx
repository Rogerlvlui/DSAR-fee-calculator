// apps/web/app/(legal)/layout.tsx
//
// The legal route-group shell — mirrors apps/web/app/(hr)/layout.tsx's own
// note. This is the single mount point for DISC-01's capability-statement
// gate on the legal side: every present and future page under
// `/assessments/*` is wrapped here. `StatusStrip` stays a page-level
// composition for the same reason recorded in the HR layout's own comment.

import type { ReactNode } from "react";
import { CapabilityStatement } from "../../src/ui/capability/capability-statement.tsx";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <CapabilityStatement>{children}</CapabilityStatement>;
}
