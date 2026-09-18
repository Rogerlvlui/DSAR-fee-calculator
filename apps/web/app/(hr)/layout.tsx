// apps/web/app/(hr)/layout.tsx
//
// The HR route-group shell. No HR-specific chrome exists yet beyond the
// root layout's app header and demo banner — this pass-through exists so
// the route group itself is a real Next.js concept the two pages below can
// share, not because anything here needs to be shared today.

import type { ReactNode } from "react";

export default function HrLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
