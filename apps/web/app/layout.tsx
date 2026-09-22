// apps/web/app/layout.tsx
//
// The root layout: imports the stylesheet, renders the app header then the
// demo banner then children. No font loader of any kind.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppHeader } from "../src/ui/chrome/app-header.tsx";
import { DemoBanner } from "../src/ui/chrome/demo-banner.tsx";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../src/server/data/auth.ts";

export const metadata: Metadata = {
  title: "DSAR Fee Assessment",
};

const ACTOR_OPTIONS = [
  { value: "HR_PREPARER", label: DEMO_USERS.HR_PREPARER.user.displayName },
  { value: "LEGAL_REVIEWER", label: DEMO_USERS.LEGAL_REVIEWER.user.displayName },
] as const;

const ROLE_SWITCH_CAPTION =
  "Stubbed identity, for this demo only — switching here sets a cookie, it does not authenticate you.";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppHeader actors={ACTOR_OPTIONS} cookieName={DEMO_ROLE_COOKIE} caption={ROLE_SWITCH_CAPTION} />
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
