// apps/web/src/ui/chrome/app-header.tsx
//
// The wordmark with its accent mark, and the stubbed-identity control: a
// labelled switch between the demo actors that sets the dsar_demo_role
// cookie, captioned so a viewer cannot mistake it for real authentication.
// Both actors, their display names and the caption come from props — this
// component imports nothing from the app's server-side module tree.

"use client";

export interface AppHeaderActorOption {
  value: string;
  label: string;
}

export interface AppHeaderProps {
  actors: readonly AppHeaderActorOption[];
  cookieName: string;
  caption: string;
}

export function AppHeader({ actors, cookieName, caption }: AppHeaderProps) {
  function selectActor(value: string) {
    document.cookie = `${cookieName}=${value}; path=/`;
    window.location.reload();
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="page flex items-center justify-between gap-md py-sm">
        <div className="wordmark">
          DSAR Fee Assessment
          <span className="text-seal">.</span>
        </div>
        <nav aria-label="Switch demo role" className="flex items-center gap-xs">
          {actors.map((actor) => (
            <button
              key={actor.value}
              type="button"
              className="btn btn-secondary"
              onClick={() => selectActor(actor.value)}
            >
              {actor.label}
            </button>
          ))}
        </nav>
      </div>
      <p data-testid="app-header-caption" className="hint">
        {caption}
      </p>
    </header>
  );
}
