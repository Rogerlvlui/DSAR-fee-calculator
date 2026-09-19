// apps/web/src/ui/intake/matter-details-fields.tsx
//
// Section 1 of the HR intake screen (PRD §10.2): reference, jurisdiction,
// legal entity, controller type, request received date, currency and
// requestor class. Currency is derived from the chosen jurisdiction through
// JURISDICTION_CURRENCY and rendered read-only — it is not a free choice.
// The five-state jurisdiction-pack readout (INTAKE-02/03, 05-03 Plan)
// renders the moment a jurisdiction is chosen, sourced from the
// `jurisdictionPack` prop the caller resolves server-side for ALL nine
// jurisdictions (apps/web/src/server/jurisdiction-packs.ts) — never a
// single hardcoded fallback. `MatterDetailsJurisdictionPack` is a
// structurally identical re-declaration of that module's `JurisdictionPackView`
// (03.1's own precedent, intake-form.tsx's `IntakeFormPackView`) rather than
// an import, even type-only, so dependency-cruiser's specifier-text
// matching for the no-server-imports-in-ui rule cannot flag it. Imports
// nothing from apps/web/src/server.

"use client";

import { JURISDICTION_CURRENCY, type ControllerType, type CurrencyCode, type JurisdictionCode } from "@dsar/schemas/primitives";
import type { RequestorClass } from "@dsar/schemas/matter";
import type { FeePosture, FeePostureMap } from "@dsar/schemas/rule-pack";

export type MatterDetailsJurisdictionPackDisplayStatus =
  | "ACTIVE"
  | "ACTIVE_REVIEW_DUE_SOON"
  | "STALE"
  | "DRAFT"
  | "NO_USABLE_PACK";

export interface MatterDetailsJurisdictionPack {
  jurisdictionCode: JurisdictionCode;
  jurisdictionName: string;
  packId: string | null;
  version: string | null;
  displayStatus: MatterDetailsJurisdictionPackDisplayStatus;
  daysUntilReviewDue: number | null;
  feePosture: FeePostureMap | null;
}

export interface MatterDetailsValue {
  reference: string;
  jurisdictionCode: JurisdictionCode;
  legalEntity: string;
  controllerType: ControllerType;
  requestReceivedOn: string;
  requestorClass: RequestorClass;
}

// PRD names nine jurisdictions (§7.4); only SG-PDPA is wired to a real pack
// in this demo (03.1-RESEARCH.md) — every other jurisdiction is offered so
// the currency-per-jurisdiction mechanic is honestly demonstrable, and
// resolves to the same "no express authority" heads-up as SG's own
// PUBLIC_AGENCY posture, because this demo has no real pack data for them.
export const JURISDICTION_NAMES: Record<JurisdictionCode, string> = {
  SG: "Singapore",
  HK: "Hong Kong SAR",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  VN: "Vietnam",
};

const CONTROLLER_TYPE_LABELS: Record<ControllerType, string> = {
  PRIVATE_ORGANISATION: "Private organisation",
  PUBLIC_AGENCY: "Public agency",
};

const REQUESTOR_CLASS_LABELS: Record<RequestorClass, string> = {
  FORMER_EMPLOYEE: "Former employee",
  CURRENT_EMPLOYEE: "Current employee",
  OTHER: "Other",
};

export const HEADS_UP_POSTURES = new Set<FeePosture>(["NO_EXPRESS_AUTHORITY", "PROHIBITED"]);

/** PRD §10.2's heads-up paragraph, verbatim with {Jurisdiction} filled in. */
export function headsUpMessage(jurisdictionName: string): string {
  return `Heads up — ${jurisdictionName}. Our rule pack records no clear legal basis for charging a fee for a data access request in this jurisdiction. You can still record the costs, but the likely outcome is that Legal advises charging nothing. Talk to Legal before spending time on this.`;
}

// UI-SPEC's five jurisdiction-pack-status copy strings, verbatim.
function jurisdictionStatusLabel(jurisdictionPack: MatterDetailsJurisdictionPack): string {
  switch (jurisdictionPack.displayStatus) {
    case "ACTIVE":
      return "Active";
    case "ACTIVE_REVIEW_DUE_SOON":
      return `Active — review due in ${jurisdictionPack.daysUntilReviewDue} days`;
    case "STALE":
      return "Stale — past its review date. New matters in this jurisdiction cannot be submitted.";
    case "DRAFT":
      return "Draft — not yet authored for this jurisdiction";
    case "NO_USABLE_PACK":
      return "No usable rule pack — contact Legal";
  }
}

/** The gating predicate `intake-form.tsx` uses to decide whether to render
 * the expense-line repeater — false when there is no usable pack at all,
 * when the pack is STALE (past its review date — `jurisdictionStatusLabel()`
 * above renders "New matters in this jurisdiction cannot be submitted" for
 * exactly this state, so the repeater must not be offered either; WR-01,
 * currently latent since no committed pack is ever STALE yet, but a real
 * gap), or when the resolved posture is one of the two heads-up postures. */
export function canOfferExpenseEntry(
  jurisdictionPack: MatterDetailsJurisdictionPack,
  controllerType: ControllerType
): boolean {
  if (jurisdictionPack.displayStatus === "NO_USABLE_PACK") return false;
  if (jurisdictionPack.displayStatus === "STALE") return false;
  const posture = jurisdictionPack.feePosture?.[controllerType];
  if (posture && HEADS_UP_POSTURES.has(posture)) return false;
  return true;
}

export interface MatterDetailsFieldsProps {
  value: MatterDetailsValue;
  onChange: (value: MatterDetailsValue) => void;
  /** Derived by the caller via JURISDICTION_CURRENCY[value.jurisdictionCode]. */
  currency: CurrencyCode;
  /** The chosen jurisdiction's own resolved pack view — every one of the
   * nine jurisdictions, never a single hardcoded fallback. */
  jurisdictionPack: MatterDetailsJurisdictionPack;
}

export function MatterDetailsFields({ value, onChange, currency, jurisdictionPack }: MatterDetailsFieldsProps) {
  const jurisdictionName = JURISDICTION_NAMES[value.jurisdictionCode];
  const feePosture = jurisdictionPack.feePosture?.[value.controllerType] ?? null;
  const showHeadsUp = jurisdictionPack.displayStatus !== "NO_USABLE_PACK" && feePosture !== null && HEADS_UP_POSTURES.has(feePosture);

  function set<K extends keyof MatterDetailsValue>(key: K, next: MatterDetailsValue[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <section data-testid="matter-details-fields">
      <h2>Matter details</h2>
      <div>
        <label>
          <span>Matter reference</span>
          <input
            name="reference"
            value={value.reference}
            onChange={(event) => set("reference", event.target.value)}
          />
        </label>
        <label>
          <span>Jurisdiction</span>
          <select
            name="jurisdictionCode"
            value={value.jurisdictionCode}
            onChange={(event) => set("jurisdictionCode", event.target.value as JurisdictionCode)}
          >
            {Object.entries(JURISDICTION_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <p data-testid="jurisdiction-pack-status" className="hint">
            {jurisdictionStatusLabel(jurisdictionPack)}
          </p>
        </label>
        <label>
          <span>Legal entity</span>
          <input
            name="legalEntity"
            value={value.legalEntity}
            onChange={(event) => set("legalEntity", event.target.value)}
          />
        </label>
        <label>
          <span>Controller type</span>
          <select
            name="controllerType"
            value={value.controllerType}
            onChange={(event) => set("controllerType", event.target.value as ControllerType)}
          >
            {Object.entries(CONTROLLER_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Request received</span>
          <input
            name="requestReceivedOn"
            type="date"
            value={value.requestReceivedOn}
            onChange={(event) => set("requestReceivedOn", event.target.value)}
          />
        </label>
        <label>
          <span>Currency</span>
          <input name="currency" value={currency} readOnly />
          <p data-testid="currency-explanation">
            Fixed by jurisdiction, not a free choice — every {value.jurisdictionCode} matter uses{" "}
            {JURISDICTION_CURRENCY[value.jurisdictionCode]}.
          </p>
        </label>
      </div>
      {/* Requestor class (PRD §6.1) is shown as fixed hint text, not an
          editable control, matching Annex A exactly
          (docs/dsar-fee-agent-mockup.html:760): the point of this line is
          "there is no field for the requestor's name or ID", and an
          editable field whose own name/label carries the word "requestor"
          would sit uncomfortably next to that claim. The value itself
          still lives in MatterDetailsValue (the caller defaults it to
          FORMER_EMPLOYEE, the case PRD §14's reference fixture uses) and
          is submitted with the matter — only the editable control is
          removed, not the field. */}
      <p className="hint">
        Requestor class: <b>{REQUESTOR_CLASS_LABELS[value.requestorClass].toLowerCase()}</b>. There is no field
        for the requestor&apos;s name or ID anywhere in this tool.
      </p>
      {jurisdictionPack.displayStatus === "NO_USABLE_PACK" ? (
        <div data-testid="no-usable-pack-notice" className="posture">
          No usable rule pack — contact Legal
        </div>
      ) : showHeadsUp ? (
        <div data-testid="heads-up-warning" className="posture">
          {headsUpMessage(jurisdictionName)}
        </div>
      ) : null}
    </section>
  );
}
