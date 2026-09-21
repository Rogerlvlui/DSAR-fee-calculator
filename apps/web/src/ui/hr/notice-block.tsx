// apps/web/src/ui/hr/notice-block.tsx
//
// The requestor-facing notice draft (PRD §10.4/§10.5(b)) in a
// copy-to-clipboard block: the draft watermark renders as a full-width
// banner directly above the draft text, in the warn treatment, for as long
// as the notice is still a draft (noticeSentAt === null) — DOC-02's
// "watermarked DRAFT until HR marks it sent" — and disappears once it has
// been marked sent. While it renders, it lives inside the same container
// as the draft text rather than being drawn as a decorative diagonal stamp,
// so it is part of the copied and selectable content, not something a
// selection would miss. The boundary note renders verbatim beneath it, in
// both states — the note that this tool emails nobody must not vanish
// exactly when a reader is most likely to assume otherwise. Then the
// mark-sent control, replaced by the sent confirmation once recorded.
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

// DOC-02/SIGNOFF-06 — markNoticeSent (apps/web/src/server/data/matters.ts)
// records a full ISO instant, kept as-is for the audit record; the
// preparer-facing confirmation reads a calendar date only (a timestamp
// would read like a transmission time for something this tool never
// transmitted). Pure string slicing — the characters before the "T"
// separator — no Date parsing, so it never re-interprets the instant in a
// different timezone than it was recorded in.
export function noticeSentDate(instant: string): string {
  const separatorIndex = instant.indexOf("T");
  return separatorIndex === -1 ? instant : instant.slice(0, separatorIndex);
}

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
      {noticeSentAt === null ? (
        <div data-testid="notice-watermark" className="text-warn">
          {NOTICE_DRAFT_WATERMARK}
        </div>
      ) : null}
      <pre data-testid="notice-draft-text">{draft}</pre>
      <p data-testid="notice-boundary-note">{NOTICE_BOUNDARY_NOTE}</p>
      {noticeSentAt ? (
        <p data-testid="notice-sent-confirmation">Notice marked sent on {noticeSentDate(noticeSentAt)}.</p>
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
