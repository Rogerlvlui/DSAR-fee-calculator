// apps/web/app/(legal)/layout.tsx
//
// The legal route-group shell — mirrors apps/web/app/(hr)/layout.tsx's own
// note: no legal-specific chrome exists yet beyond the root layout's app
// header and demo banner, so this pass-through exists so the route group
// itself is a real Next.js concept the review screen can sit inside.

import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
