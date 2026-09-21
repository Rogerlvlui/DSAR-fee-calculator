// packages/documents/src/internal-record-document.tsx
//
// The ONLY module in this repository importing @react-pdf/renderer — every
// other consumer (the Route Handler, this package's own tests for content)
// goes through internal-record-view.ts's plain InternalRecordView object,
// never through this JSX tree directly. This is also why
// packages/documents/package.json's exports map carries two explicit
// subpath keys ("./internal-record-view", "./internal-record-document")
// rather than a single "./*" wildcard like every other package in this
// monorepo (e.g. packages/workflow/package.json) — a package with both a
// .ts and a .tsx source file cannot resolve both through one wildcard
// entry, so each source file gets its own named export instead.
//
// 07-04 widens the tracer's one-page title+footer skeleton into the full
// dense-table layout D-04 settles on: Matter details, Rule pack, Line
// items, Matter flags and acknowledgements, then Sign-off, in that fixed
// order, with the disclosure footer as the terminal element on every page.
// This layer consumes ONLY the plain InternalRecordView object — it
// recomputes no figure, reads no clock, and formats nothing that
// internal-record-view.ts has not already formatted.
//
// Landscape A4, 24pt page margins, Helvetica (the renderer's built-in
// standard PDF font — no Font.register() call, no embedded font file, no
// network fetch), per 07-UI-SPEC.md's Typography/Spacing/Color scales.
// Greyscale only, by design (07-UI-SPEC.md Color section): the Verdict and
// Disposition columns already carry their state in words, and colour-coding
// a legal conclusion is exactly the thing this document must not do.

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  DISPOSITION_LABELS,
  renderInternalRecordFooter,
  VERDICT_LABELS,
  type InternalRecordFlagRow,
  type InternalRecordLineRow,
  type InternalRecordMatterDetails,
  type InternalRecordPackDetails,
  type InternalRecordSignOffBlock,
  type InternalRecordView,
} from "./internal-record-view.ts";

// ---------------------------------------------------------------------------
// 07-UI-SPEC.md's point-based PDF spacing scale — every margin/padding
// value in this file is one of these six.
// ---------------------------------------------------------------------------

const PDF_2XS = 4; // cell-internal gap
const PDF_XS = 8; // table cell horizontal padding, gap between adjacent sign-off fields
const PDF_SM = 12; // gap between a section heading and its content
const PDF_MD = 16; // gap between major sections
const PDF_LG = 24; // page margins
const PDF_XL = 32; // reserved footer band height

// 07-UI-SPEC.md's four-value greyscale palette — no other colour literal
// may appear anywhere in this file (Task 2's own acceptance criterion).
const COLOR_TEXT = "#171b22";
const COLOR_MUTED = "#6b7480";
const COLOR_BORDER = "#d8dce1";
const COLOR_ZEBRA = "#f5f6f8";

// ---------------------------------------------------------------------------
// Section headings and line-item columns — reviewable named constants
// rather than scattered through the JSX (this codebase's own established
// precedent, e.g. DERIVED_MATTER_FLAG_SPECS, ACTIVE_READY_CHECKS).
// ---------------------------------------------------------------------------

export const SECTION_HEADINGS = {
  matterDetails: "Matter details",
  rulePack: "Rule pack",
  lineItems: "Line items",
  matterFlags: "Matter flags and acknowledgements",
  signOff: "Sign-off",
} as const;

type LineColumnKey = Exclude<keyof InternalRecordLineRow, never>;

export interface InternalRecordColumn {
  key: LineColumnKey;
  label: string;
  // A fixed proportional width (percentage points); all ten sum to 100.
  // Sized against a mixed-verdict case carrying longer FLAG basis text
  // alongside shorter ALLOW/DISALLOW/ALLOW_CAPPED rows (07-UI-SPEC.md E4
  // "populated" resolution) — Basis, Citation and Lawyer's reason get the
  // most; Seq and the two money columns get the least.
  width: number;
}

export const INTERNAL_RECORD_COLUMNS: readonly InternalRecordColumn[] = [
  { key: "seq", label: "Seq", width: 3 },
  { key: "categoryLabel", label: "Category", width: 10 },
  { key: "verdict", label: "Verdict", width: 6 },
  { key: "appliedRuleId", label: "Rule ID", width: 9 },
  { key: "basis", label: "Basis", width: 20 },
  { key: "citation", label: "Citation", width: 15 },
  { key: "disposition", label: "Disposition", width: 7 },
  { key: "claimedAmount", label: "Claimed", width: 7 },
  { key: "lawyerAmount", label: "Lawyer amount", width: 7 },
  { key: "lawyerReason", label: "Lawyer's reason", width: 16 },
];

function cellText(row: InternalRecordLineRow, column: InternalRecordColumn): string {
  switch (column.key) {
    case "seq":
      return String(row.seq);
    case "verdict":
      return VERDICT_LABELS[row.verdict];
    case "disposition":
      return DISPOSITION_LABELS[row.disposition];
    default:
      return row[column.key] as string;
  }
}

// ---------------------------------------------------------------------------
// Styles — landscape A4, 24pt margins, bottom margin widened to reserve the
// 32pt footer band so the table can never overrun the footer.
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    paddingTop: PDF_LG,
    paddingLeft: PDF_LG,
    paddingRight: PDF_LG,
    paddingBottom: PDF_LG + PDF_XL,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: COLOR_TEXT,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: PDF_MD,
  },
  section: {
    marginBottom: PDF_MD,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: PDF_SM,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: PDF_2XS,
  },
  detailLabel: {
    width: 160,
    fontWeight: "bold",
    paddingRight: PDF_XS,
  },
  detailValue: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
    paddingVertical: PDF_2XS,
  },
  headerCell: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: COLOR_TEXT,
    paddingHorizontal: PDF_XS,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
    paddingVertical: PDF_2XS,
  },
  zebraRow: {
    backgroundColor: COLOR_ZEBRA,
  },
  cell: {
    fontSize: 8,
    paddingHorizontal: PDF_XS,
  },
  emptyStateText: {
    fontSize: 8,
    color: COLOR_MUTED,
  },
  flagRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
    paddingVertical: PDF_2XS,
  },
  flagCode: {
    width: 140,
    fontWeight: "bold",
    paddingRight: PDF_XS,
  },
  flagMessage: {
    flex: 1,
    paddingRight: PDF_XS,
  },
  flagAck: {
    width: 200,
    color: COLOR_MUTED,
  },
  attestation: {
    fontSize: 9,
    marginTop: PDF_SM,
  },
  repeatingHeaderBand: {
    position: "absolute",
    top: PDF_LG,
    left: PDF_LG,
    right: PDF_LG,
  },
  footerBand: {
    position: "absolute",
    bottom: PDF_LG,
    left: PDF_LG,
    right: PDF_LG,
    height: PDF_XL,
  },
  footerText: {
    fontSize: 7,
    color: COLOR_MUTED,
  },
});

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function MatterDetailsSection({ matter }: { matter: InternalRecordMatterDetails }) {
  return (
    <View>
      <DetailRow label="Reference" value={matter.reference} />
      <DetailRow label="Jurisdiction" value={matter.jurisdictionName} />
      <DetailRow label="Legal entity" value={matter.legalEntity} />
      <DetailRow label="Controller type" value={matter.controllerType} />
      <DetailRow label="Request received on" value={matter.requestReceivedOn} />
      <DetailRow label="Requestor class" value={matter.requestorClass} />
      <DetailRow label="Identity verified" value={matter.identityVerified ? "Yes" : "No"} />
      <DetailRow label="Scope clarified" value={matter.scopeClarified ? "Yes" : "No"} />
    </View>
  );
}

function PackDetailsSection({ pack }: { pack: InternalRecordPackDetails }) {
  return (
    <View>
      <DetailRow label="Rule pack" value={`${pack.packId} ${pack.packVersion}`} />
      <DetailRow label="Status" value={pack.status} />
      <DetailRow label="Fee posture" value={pack.feePosture} />
      <DetailRow label="Authoring counsel" value={pack.authoredByDisplayName} />
      <DetailRow label="Reviewing counsel" value={pack.reviewedByDisplayName} />
      <DetailRow label="Reviewed on" value={pack.reviewedOn} />
      <DetailRow label="Review due on" value={pack.reviewDueOn} />
      <DetailRow label="Engine version" value={pack.engineVersion} />
    </View>
  );
}

// The column header row — rendered once, in-flow, at the top of the Line
// items section (correctly positioned under the "Line items" heading on
// page 1), and a second time via the `fixed` band below for every page
// after the first. Extracted so both call sites render byte-identical
// cells.
function ColumnHeaderRow() {
  return (
    <View style={styles.headerRow} fixed={false}>
      {INTERNAL_RECORD_COLUMNS.map((column) => (
        <Text key={column.key} style={[styles.headerCell, { width: `${column.width}%` }]}>
          {column.label}
        </Text>
      ))}
    </View>
  );
}

function LineItemRow({ row, index }: { row: InternalRecordLineRow; index: number }) {
  return (
    <View style={index % 2 === 1 ? [styles.row, styles.zebraRow] : styles.row} wrap={false}>
      {INTERNAL_RECORD_COLUMNS.map((column) => (
        <Text key={column.key} style={[styles.cell, { width: `${column.width}%` }]}>
          {cellText(row, column)}
        </Text>
      ))}
    </View>
  );
}

// Zero-line assessment: header row only, no body rows, no special
// empty-state copy (this plan's own backstop truth — whether that state is
// reachable at all given intake validation is not proven here).
function LineItemsSection({ lines }: { lines: readonly InternalRecordLineRow[] }) {
  return (
    <View>
      <ColumnHeaderRow />
      {lines.map((row, index) => (
        <LineItemRow key={`${row.seq}-${row.appliedRuleId}-${index}`} row={row} index={index} />
      ))}
    </View>
  );
}

function FlagRow({ row }: { row: InternalRecordFlagRow }) {
  return (
    <View style={styles.flagRow} wrap={false}>
      <Text style={styles.flagCode}>{row.code}</Text>
      <Text style={styles.flagMessage}>{row.message}</Text>
      <Text style={styles.flagAck}>
        {row.acknowledgement
          ? `Acknowledged by ${row.acknowledgement.lawyerName} on ${row.acknowledgement.acknowledgedAt}`
          : ""}
      </Text>
    </View>
  );
}

// Renders whichever empty-state sentence the view selected when there are
// no rows to show — never a bare heading with nothing beneath it
// (07-UI-SPEC.md's Copywriting Contract, must_haves). The flags section
// sits in the same document flow as the line-items table above it, so a
// long flags list simply pushes the Sign-off section onto a later page
// rather than scrolling inside itself.
function MatterFlagsSection({ flags }: { flags: InternalRecordView["flags"] }) {
  if (flags.noFlagsStatement) {
    return <Text style={styles.emptyStateText}>{flags.noFlagsStatement}</Text>;
  }
  return (
    <View>
      {flags.noAcknowledgementRequiredStatement ? (
        <Text style={[styles.emptyStateText, { marginBottom: PDF_2XS }]}>
          {flags.noAcknowledgementRequiredStatement}
        </Text>
      ) : null}
      {flags.rows.map((row) => (
        <FlagRow key={row.code + row.message} row={row} />
      ))}
    </View>
  );
}

// The terminal section, always the last content before the footer, so a
// reader's eye lands on the accountable name last (07-UI-SPEC.md's "Visual
// focal point" note).
function SignOffSection({ signOff }: { signOff: InternalRecordSignOffBlock }) {
  return (
    <View>
      <DetailRow label="Signed off by" value={`${signOff.lawyerName}, ${signOff.qualification}`} />
      <DetailRow label="Signed at" value={signOff.signedAt} />
      <DetailRow label="Final amount" value={signOff.finalAmount} />
      <Text style={styles.attestation}>{signOff.attestationText}</Text>
    </View>
  );
}

export function InternalRecordDocument({ view }: { view: InternalRecordView }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{view.title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{SECTION_HEADINGS.matterDetails}</Text>
          <MatterDetailsSection matter={view.matter} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{SECTION_HEADINGS.rulePack}</Text>
          <PackDetailsSection pack={view.pack} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{SECTION_HEADINGS.lineItems}</Text>
          <LineItemsSection lines={view.lines} />
        </View>

        {/* Repeats the column header at the top of every page after the
            first, via the renderer's own fixed-component mechanism — the
            front matter above (title/matter details/rule pack) only ever
            occupies page 1, so gating this on pageNumber > 1 avoids
            duplicating it there while still giving pages 2+ their own
            repeated header row (DOC-01's own requirement; 07-UI-SPEC.md E4
            "overflow" — textual correctness on page 2+ is this plan's own
            recorded backstop, not asserted by an automated test here). */}
        <View
          fixed
          style={styles.repeatingHeaderBand}
          render={({ pageNumber }) => (pageNumber > 1 ? <ColumnHeaderRow /> : null)}
        />

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{SECTION_HEADINGS.matterFlags}</Text>
          <MatterFlagsSection flags={view.flags} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>{SECTION_HEADINGS.signOff}</Text>
          <SignOffSection signOff={view.signOff} />
        </View>

        {/* The footer follows Sign-off as a `fixed` element so the renderer
            repeats it on every page without this component counting pages
            itself (DOC-05: the footer must never be omitted merely because
            the document did not paginate). */}
        <View fixed style={styles.footerBand}>
          <Text style={styles.footerText}>{renderInternalRecordFooter(view.footer)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// Async wrapper around the renderer's buffer API, so the Route Handler
// never imports @react-pdf/renderer directly — matching this codebase's
// established "pure module + thin renderer" convention (07-RESEARCH.md
// Pattern 1).
export async function renderInternalRecordPdf(view: InternalRecordView): Promise<Buffer> {
  return renderToBuffer(<InternalRecordDocument view={view} />);
}
