import { useState } from "react";
import { parseRupeesToPaise } from "../finance/money";
import type { ExtractedField, FieldKey } from "../shared/schema";
import type { DocState } from "./api";
import type { Strings } from "./i18n.en";
import { money } from "./i18n";

const MONEY: FieldKey[] = ["principal", "netCredited", "withheldFees", "withheldTaxes", "totalRepayment"];
const SHOWN: FieldKey[] = ["principal", "netCredited", "withheldFees", "withheldTaxes", "totalRepayment", "tenureDays", "otherCharges", "repaymentCount"];
const OPTIONAL: FieldKey[] = ["otherCharges", "repaymentCount", "withheldTaxes"];

/** Related financial fields are grouped; each row aligns the offer and final-terms values. */
const GROUPS: { title: "groupReceive" | "groupRepay"; keys: FieldKey[] }[] = [
  { title: "groupReceive", keys: ["principal", "netCredited", "withheldFees", "withheldTaxes"] },
  { title: "groupRepay", keys: ["totalRepayment", "tenureDays", "otherCharges", "repaymentCount"] },
];

function displayValue(f: ExtractedField): string {
  if (f.valuePaise !== undefined) return money(f.valuePaise);
  if (f.valueDays !== undefined) return String(f.valueDays);
  if (f.valueCount !== undefined) return String(f.valueCount);
  return "";
}

/** A field is shown unless it is an optional concept the AI did not see and the user did not add. */
function isVisible(doc: DocState | undefined, key: FieldKey): boolean {
  if (!doc) return false;
  const f = doc.fields.find((x) => x.key === key);
  if (!f) return false;
  const aiSaw = doc.original.fields.some((x) => x.key === key && x.status !== "missing");
  return !(OPTIONAL.includes(key) && !aiSaw && f.origin !== "user");
}

/** Per-document editing state and actions (logic unchanged from the original review card). */
function useEditor(doc: DocState | undefined, onChange: (next: DocState) => void) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Record<string, boolean>>({});

  // Any edit un-confirms that field. Only a click on Confirm adds a key to doc.confirmed.
  const update = (key: FieldKey, patch: Partial<ExtractedField>, confirmed: boolean) => {
    if (!doc) return;
    const fields = doc.fields.map((f) => (f.key === key ? { ...f, ...patch } : f));
    const rest = doc.confirmed.filter((k) => k !== key);
    onChange({ ...doc, fields, confirmed: confirmed ? [...rest, key] : rest });
  };

  const applyEdit = (f: ExtractedField, text: string) => {
    setDrafts((d) => ({ ...d, [f.key]: text }));
    const clean = text.trim();
    if (clean === "") return;
    if (!doc) return;
    const base = { origin: "user" as const, status: "found" as const, supportingText: "", qualifier: undefined, qualifierText: undefined };
    if (MONEY.includes(f.key)) {
      const p = parseRupeesToPaise(clean);
      setBad((b) => ({ ...b, [f.key]: p === null }));
      if (p !== null) update(f.key, { ...base, valuePaise: p }, false);
    } else {
      const n = Number(clean);
      const ok = Number.isInteger(n) && n > 0;
      setBad((b) => ({ ...b, [f.key]: !ok }));
      if (ok) update(f.key, f.key === "repaymentCount" ? { ...base, valueCount: n } : { ...base, valueDays: n }, false);
    }
  };

  const clearDraft = (key: FieldKey) => {
    setDrafts((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
    setBad((b) => ({ ...b, [key]: false }));
  };

  const markMissing = (f: ExtractedField) => {
    clearDraft(f.key);
    update(f.key, { status: "missing", valuePaise: undefined, valueDays: undefined, valueCount: undefined, origin: "user" }, false);
  };


  const reset = (f: ExtractedField) => {
    const orig = doc?.original.fields.find((x) => x.key === f.key);
    if (!orig) return;
    clearDraft(f.key);
    update(f.key, { ...orig }, false);
  };

  return { drafts, bad, update, applyEdit, markMissing, reset };
}

type Editor = ReturnType<typeof useEditor>;

interface CellProps {
  t: Strings;
  doc: DocState;
  fieldKey: FieldKey;
  ed: Editor;
  sideLabel: string;
}

/** One document's value for one field: value, status, confirmation and supporting text. */
function FieldCell({ t, doc, fieldKey: key, ed, sideLabel }: CellProps) {
  const kind = doc.original.kind;
  const f = doc.fields.find((x) => x.key === key) as ExtractedField;
  const aiSaw = doc.original.fields.some((x) => x.key === key && x.status !== "missing");
  const isConfirmed = doc.confirmed.includes(key);
  const edited = f.origin === "user";
  const orig = doc.original.fields.find((x) => x.key === key);
  const needsAttention = !isConfirmed && (f.status === "ambiguous" || (f.status === "missing" && ["netCredited", "totalRepayment", "tenureDays"].includes(key)));
  const canConfirm = f.status === "found" && !ed.bad[key];
  const statusLabel = (s: ExtractedField["status"]) => (s === "found" ? t.found : s === "missing" ? t.missing : t.ambiguous);
  const inputId = `in-${kind}-${key}`;

  return (
    <div className={`field ${f.status} ${isConfirmed ? "ok" : ""} ${edited ? "edited" : ""} ${needsAttention ? "attn" : ""}`} data-testid={`field-${kind}-${key}`}>
      <div className="fhead">
        <span className="side-lbl">{sideLabel}</span>
        <span className={`conf ${isConfirmed ? "yes" : ""}`} data-testid="confirmed-state">{isConfirmed ? `✓ ${t.confirmed}` : t.notConfirmed}</span>
      </div>
      {/* field name repeated in each cell for the stacked mobile layout and screen readers */}
      <strong className="fname-in">{t.keys[key]}</strong>
      {key !== "otherCharges" && (
        <div className="valuerow">
          <label className="sr-only" htmlFor={inputId}>{`${t.keys[key]} (${sideLabel}): ${MONEY.includes(key) ? t.rupees : t.value}`}</label>
          <input
            id={inputId}
            className="value-in"
            inputMode="decimal"
            aria-invalid={ed.bad[key] ? true : undefined}
            data-testid={`input-${kind}-${key}`}
            value={ed.drafts[key] ?? displayValue(f)}
            placeholder={f.status === "missing" ? t.notInDoc : ""}
            onChange={(e) => ed.applyEdit(f, e.target.value)}
          />
          {key === "tenureDays" && <span className="unit">{t.days}</span>}
        </div>
      )}
      <div className="badges">
        <span className={`badge ${f.status}`} data-testid="status">{statusLabel(f.status)}</span>
        {edited ? <span className="badge user" data-testid="edited-badge">{t.userEdited}</span> : aiSaw && <span className="badge">{t.aiOrigin}</span>}
        {needsAttention && !edited && <span className="badge attn">{t.unresolved}</span>}
      </div>
      {!edited && f.qualifierText && <div className="qual">“{f.qualifierText}”</div>}
      {edited ? (
        <div className="history" data-testid={`history-${kind}-${key}`}>
          <p className="hlabel">{t.originalDocValue}</p>
          <blockquote className="evidence old" aria-label={t.originalDocValue}>
            {orig?.supportingText ? orig.supportingText : <em>{t.notInDoc}</em>}
          </blockquote>
          {orig && orig.status !== "missing" && (orig.valuePaise !== undefined || orig.valueDays !== undefined || orig.valueCount !== undefined) && (
            <p className="hlabel">{t.originalAiValue}: <strong>{displayValue(orig)}</strong></p>
          )}
          <p className="hnote">{t.editedBy}</p>
        </div>
      ) : (
        <blockquote className="evidence" aria-label={t.evidence}>
          {f.supportingText ? f.supportingText : <em>{t.notInDoc}</em>}
        </blockquote>
      )}
      <div className="actions">
        <button type="button" className={isConfirmed ? "secondary sm" : "confirm sm"} disabled={!canConfirm} data-testid={`confirm-${kind}-${key}`} onClick={() => ed.update(key, {}, !isConfirmed)}>
          {isConfirmed ? "↩" : "✓"} {t.confirm}
        </button>
        <button type="button" className="ghost sm" onClick={() => ed.markMissing(f)}>{t.markMissing}</button>
        {edited && <button type="button" className="ghost sm" onClick={() => ed.reset(f)}>{t.reset}</button>}
      </div>
    </div>
  );
}


function DocHead({ t, title, doc }: { t: Strings; title: string; doc: DocState }) {
  return (
    <div className="doc-head" data-testid={`review-${doc.original.kind}`}>
      <h3>{title}</h3>
      <p className="meta">
        <span className="badge live" data-testid="live-badge">{t.liveAi}</span> <span className="mono">{doc.modelId}</span> · {doc.original.language}
      </p>
      {doc.original.warnings.length > 0 && <ul className="warn">{doc.original.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </div>
  );
}

interface BoardProps {
  t: Strings;
  offer?: DocState;
  kfs: DocState;
  onChange: (kind: "offer" | "kfs", next: DocState) => void;
}

/**
 * Review board: one row per field with its meaning on the left and the offer / final-terms
 * values aligned beside it (stacked on mobile). Edits and confirmations stay per document.
 */
export function ReviewBoard({ t, offer, kfs, onChange }: BoardProps) {
  const edOffer = useEditor(offer, (d) => onChange("offer", d));
  const edKfs = useEditor(kfs, (d) => onChange("kfs", d));

  return (
    <section className={`card board ${offer ? "two" : "one"}`} aria-label={t.review}>
      <div className="brow bhead">
        <div className="bkey"><span className="col-lbl">{t.fieldCol}</span></div>
        {offer && <DocHead t={t} title={t.offerDoc} doc={offer} />}
        <DocHead t={t} title={t.kfsDoc} doc={kfs} />
      </div>
      {GROUPS.map((g) => {
        const keys = g.keys.filter((k) => SHOWN.includes(k) && (isVisible(offer, k) || isVisible(kfs, k)));
        if (keys.length === 0) return null;
        return (
          <div key={g.title} className="bgroup" role="group" aria-label={t[g.title]}>
            <h4 className="group-t">{t[g.title]}</h4>
            {keys.map((k) => (
              <div key={k} className="brow">
                <div className="bkey">
                  <strong>{t.keys[k]}</strong>
                  <p>{t.meanings[k]}</p>
                </div>
                {offer && (isVisible(offer, k) ? <FieldCell t={t} doc={offer} fieldKey={k} ed={edOffer} sideLabel={t.offer} /> : <div className="field na"><span className="side-lbl">{t.offer}</span> <em>{t.notInDoc}</em></div>)}
                {isVisible(kfs, k) ? <FieldCell t={t} doc={kfs} fieldKey={k} ed={edKfs} sideLabel={t.final} /> : <div className="field na"><span className="side-lbl">{t.final}</span> <em>{t.notInDoc}</em></div>}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

