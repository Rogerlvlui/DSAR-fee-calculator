// apps/web/src/ui/hr/info-request-panel.tsx
//
// Renders every outstanding Ask-HR query (PRD §10.3's closing sentence:
// "Ask HR" on any line moves the matter to INFO_REQUEST with the lawyer's
// queries collated) with the line each concerns and the date it was
// raised, plus the control that re-submits the matter once HR has edited
// the lines. Takes everything as props and imports nothing from
// apps/web/src/server — the caller (the HR result page) enriches each
// InfoRequest with a human-readable line label before handing it down.
//
// Split the same way disposition-controls.tsx/bulk-accept-bar.tsx are: a
// pure *View component (what this module's own tests render) and a
// stateful wrapper owning useState/useRouter/fetch.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface InfoRequestPanelQuery {
  id: string;
  lineLabel: string;
  query: string;
  raisedAt: string;
}

export interface InfoRequestPanelViewProps {
  queries: readonly InfoRequestPanelQuery[];
  pending: boolean;
  error: string | null;
  onResubmit: () => void;
}

/** Pure, props-driven — this is what info-request-panel.test.tsx renders
 * directly. */
export function InfoRequestPanelView({ queries, pending, error, onResubmit }: InfoRequestPanelViewProps) {
  return (
    <div data-testid="info-request-panel">
      <p>Legal has asked for more information before this matter can be signed off.</p>
      <ul data-testid="info-request-list">
        {queries.map((entry) => (
          <li key={entry.id} data-testid="info-request-item">
            <div data-testid="info-request-line">{entry.lineLabel}</div>
            <div data-testid="info-request-query">{entry.query}</div>
            <div data-testid="info-request-date">{entry.raisedAt}</div>
          </li>
        ))}
      </ul>
      <button type="button" data-testid="info-request-resubmit" disabled={pending} onClick={onResubmit}>
        Re-submit to Legal
      </button>
      {error ? (
        <p role="alert" data-testid="info-request-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface InfoRequestPanelProps {
  matterId: string;
  queries: readonly InfoRequestPanelQuery[];
}

export function InfoRequestPanel({ matterId, queries }: InfoRequestPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResubmit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/resubmit`, { method: "POST" });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setPending(false);
    }
  }

  return <InfoRequestPanelView queries={queries} pending={pending} error={error} onResubmit={handleResubmit} />;
}
