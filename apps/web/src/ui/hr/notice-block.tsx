// apps/web/src/ui/hr/notice-block.tsx
//
// The requestor-facing notice draft (PRD §10.4/§10.5(b)) in a
// copy-to-clipboard block: the draft watermark renders as a persistent
// full-width banner directly above the draft text, in the warn treatment,
// and — because it lives inside the same container as the draft text
// rather than being drawn as a decorative diagonal stamp — it is part of
// the copied and selectable content, not something a selection would miss.
// The boundary note renders verbatim beneath it. Then the mark-sent
// control.
//
// Split the same way disposition-controls.tsx/bulk-accept-bar.tsx are: a
// pure *View component (what this module's own tests render) and a
// stateful wrapper owning useState/useRouter/fetch.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const NOTICE_DRAFT_WATERMARK = "DRAFT — for HR to send";
export const NOTICE_BOUNDARY_NOTE = "Send this yourself from your own mailbox. This tool does not email anyone.";
export const MARK_NOTICE_SENT_LABEL = "Mark notice sent";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface NoticeBlockViewProps {
  draft: string;
  noticeSentAt: string | null;
  pending: boolean;
  error: string | null;
  onMarkSent: () => void;
}

/** Pure, props-driven — this is what notice-block.test.tsx renders
 * directly. */
export function NoticeBlockView({ draft, noticeSentAt, pending, error, onMarkSent }: NoticeBlockViewProps) {
  return (
    <div data-testid="notice-block">
      <div data-testid="notice-watermark" className="text-warn">
        {NOTICE_DRAFT_WATERMARK}
      </div>
      <pre data-testid="notice-draft-text">{draft}</pre>
      <p data-testid="notice-boundary-note">{NOTICE_BOUNDARY_NOTE}</p>
      {noticeSentAt ? (
        <p data-testid="notice-sent-confirmation">Notice marked sent on {noticeSentAt}.</p>
      ) : (
        <button type="button" data-testid="notice-mark-sent" disabled={pending} onClick={onMarkSent}>
          {MARK_NOTICE_SENT_LABEL}
        </button>
      )}
      {error ? (
        <p role="alert" data-testid="notice-mark-sent-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface NoticeBlockProps {
  matterId: string;
  draft: string;
  noticeSentAt: string | null;
}

export function NoticeBlock({ matterId, draft, noticeSentAt }: NoticeBlockProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkSent() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/notice-sent`, { method: "POST" });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <NoticeBlockView draft={draft} noticeSentAt={noticeSentAt} pending={pending} error={error} onMarkSent={handleMarkSent} />
  );
}
