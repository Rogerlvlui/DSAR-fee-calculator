// apps/web/src/ui/chrome/app-header.tsx
//
// The wordmark with its accent mark, and the stubbed-identity control: a
// labelled switch between the demo actors that sets the dsar_demo_role
// cookie, captioned so a viewer cannot mistake it for real authentication.
// Both actors, their display names and the caption come from props — this
// component imports nothing from the app's server-side module tree.

"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface AppHeaderActorOption {
  value: string;
  label: string;
  homeHref: string;
}

export interface AppHeaderProps {
  actors: readonly AppHeaderActorOption[];
  cookieName: string;
  caption: string;
}

export function RoleSwitchButton({
  cookieName,
  role,
  href,
  children,
  className = "btn btn-secondary",
}: {
  cookieName: string;
  role: string;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  function switchRole() {
    document.cookie = `${cookieName}=${role}; path=/; SameSite=Lax`;
    // A full navigation makes the new cookie available to the server on the
    // destination request and never reloads a page restricted to the old role.
    window.location.assign(href);
  }

  return <button type="button" className={className} onClick={switchRole}>{children}</button>;
}

export function AppHeader({ actors, cookieName, caption }: AppHeaderProps) {
  const [activeRole, setActiveRole] = useState(actors[0]?.value ?? "HR_PREPARER");
  useEffect(() => {
    const value = document.cookie.split("; ").find((part) => part.startsWith(`${cookieName}=`))?.split("=")[1];
    if (actors.some((actor) => actor.value === value)) setActiveRole(value!);
  }, [actors, cookieName]);
  const activeActor = actors.find((actor) => actor.value === activeRole);

  return (
    <header className="app-header">
      <div className="page app-header-inner">
        <a href="/" className="wordmark">DSAR Fee Assessment<span className="text-seal">.</span></a>
        <nav aria-label="Demo navigation" className="app-header-nav">
          <a href={activeActor?.homeHref ?? "/hr/matters"} className="header-home">{activeRole === "LEGAL_REVIEWER" ? "Legal queue" : "My matters"}</a>
          <span className="header-role" aria-label={`Active demo role: ${activeActor?.label ?? "HR"}`}>
            {activeRole === "LEGAL_REVIEWER" ? "Legal" : "HR"}
          </span>
          {actors.map((actor) => (
            <RoleSwitchButton
              key={actor.value}
              cookieName={cookieName}
              role={actor.value}
              href={actor.homeHref}
              className={actor.value === activeRole ? "btn btn-secondary role-current" : "btn btn-secondary"}
            >
              {actor.label}
            </RoleSwitchButton>
          ))}
        </nav>
      </div>
      <p data-testid="app-header-caption" className="header-caption">{caption}</p>
    </header>
  );
}
