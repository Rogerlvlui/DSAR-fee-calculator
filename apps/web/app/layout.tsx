// apps/web/app/layout.tsx
//
// The root layout: imports the stylesheet, renders the app header then the
// demo banner then children. Self-hosts the Claude Design export's three
// named webfonts via next/font/google (07.1-01 Task 1) — Next fetches the
// font files once at build time and serves them from this app's own origin
// afterward, so there is zero runtime request to fonts.googleapis.com or
// fonts.gstatic.com. Only the two weights the frozen typography contract
// actually uses (400/600) are loaded, per 07.1-UI-SPEC.md's weight-collapse
// rule — never the design's own fuller 400/500/600/700 request. Each
// loader's `variable` becomes a CSS custom property on <html>, consumed by
// globals.css's --font-sans/--font-serif/--font-mono theme tokens.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { AppHeader } from "../src/ui/chrome/app-header.tsx";
import { DemoBanner } from "../src/ui/chrome/demo-banner.tsx";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../src/server/data/auth.ts";

export const metadata: Metadata = {
  title: "DSAR Fee Assessment",
};

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "600"],
  style: ["normal"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "600"],
  style: ["normal"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

// The only place body text switches to the serif family at Body size is the
// review card's quoted HR-description text, rendered in italic — so both
// styles are loaded, per 07.1-UI-SPEC.md's Typography section.
const newsreader = Newsreader({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

const FONT_VARIABLES = `${ibmPlexSans.variable} ${ibmPlexMono.variable} ${newsreader.variable}`;

// Two entries only (2026-09-23): the DPO_ADMIN identity ("Wei Ling Ong")
// added in 07.1-02 is retired — the Legal reviewer's identity now carries
// both roles (auth.ts's own header note has the reason), so /admin/audit
// is reachable from the same switcher entry as /legal/*, not a third one.
const ACTOR_OPTIONS = [
  { value: "HR_PREPARER", label: DEMO_USERS.HR_PREPARER.user.displayName },
  { value: "LEGAL_REVIEWER", label: DEMO_USERS.LEGAL_REVIEWER.user.displayName },
] as const;

const ROLE_SWITCH_CAPTION =
  "Stubbed identity, for this demo only — switching here sets a cookie, it does not authenticate you.";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={FONT_VARIABLES}>
      <body>
        <AppHeader actors={ACTOR_OPTIONS} cookieName={DEMO_ROLE_COOKIE} caption={ROLE_SWITCH_CAPTION} />
        <DemoBanner />
        {/* Every page.tsx already renders its own <main> — this wraps it in
            the shell class, never a second <main> landmark. */}
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
