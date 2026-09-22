// apps/web/app/legal/layout.tsx
//
// The legal section shell — a real `/legal` path segment (06-04; previously
// the `(legal)` route group, which contributed no URL segment at all).
// Mirrors apps/web/app/hr/layout.tsx's own note. This is the single mount
// point for DISC-01's capability-statement gate on the legal side: every
// present and future page under `/legal/*` (`/legal/queue`,
// `/legal/assessments/*`) is wrapped here. `StatusStrip` stays a page-level
// composition for the same reason recorded in the HR layout's own comment.

import type { ReactNode } from "react";
import { CapabilityStatement } from "../../src/ui/capability/capability-statement.tsx";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <CapabilityStatement>{children}</CapabilityStatement>;
}
