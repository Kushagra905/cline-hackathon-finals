import { useState } from "react";
import { parseRupeesToPaise } from "../finance/money";
import type { ExtractedField, FieldKey } from "../shared/schema";
import type { DocState } from "./api";
import type { Strings } from "./i18n.en";
import { money } from "./i18n";

const MONEY: FieldKey[] = ["principal", "netCredited", "withheldFees", "withheldTaxes", "totalRepayment"];
const SHOWN: FieldKey[] = ["principal", "netCredited", "withheldFees", "withheldTaxes", "totalRepayment", "tenureDays", "otherCharges", "repaymentCount"];
const OPTIONAL: FieldKey[] = ["otherCharges", "repaymentCount", "withheldTaxes"];

interface Props {
  t: Strings;
  title: string;
  doc: DocState;
  onChange: (next: DocState) => void;
}

function displayValue(f: ExtractedField): string {
  if (f.valuePaise !== undefined) return money(f.valuePaise);
  if (f.valueDays !== undefined) return String(f.valueDays);
  if (f.valueCount !== undefined) return String(f.valueCount);
  return "";
}

export function ReviewCard({ t, title, doc, onChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const kind = doc.original.kind;

  // Any edit un-confirms that field. Only a click on Confirm adds a key to doc.confirmed.
  const update = (key: FieldKey, patch: Partial<ExtractedField>, confirmed: boolean) => {
    const fields = doc.fields.map((f) => (f.key === key ? { ...f, ...patch } : f));
    const rest = doc.confirmed.filter((k) => k !== key);
    onChange({ ...doc, fields, confirmed: confirmed ? [...rest, key] : rest });
  };

  const applyEdit = (f: ExtractedField, text: string) => {
    setDrafts((d) => ({ ...d, [f.key]: text }));
    const clean = text.trim();
    if (clean === "") return;
    const base = { origin: "user" as const, status: "found" as const, supportingText: f.supportingText || "Entered by you" };
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
    const orig = doc.original.fields.find((x) => x.key === f.key);
    if (!orig) return;
    clearDraft(f.key);
    update(f.key, { ...orig }, false);
  };

  const statusLabel = (s: ExtractedField["status"]) => (s === "found" ? t.found : s === "missing" ? t.missing : t.ambiguous);

  return (
    <section className="card review" data-testid={`review-${kind}`}>
      <h3>{title}</h3>
      <p className="meta">
        <span className="badge live" data-testid="live-badge">{t.liveAi}</span> {t.model}: {doc.modelId} · {doc.original.language}
      </p>
      {doc.original.warnings.length > 0 && <ul className="warn">{doc.original.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      {SHOWN.map((key) => {
        const f = doc.fields.find((x) => x.key === key);
        if (!f) return null;
        const aiSaw = doc.original.fields.some((x) => x.key === key && x.status !== "missing");
        if (OPTIONAL.includes(key) && !aiSaw && f.origin !== "user") return null;
        const isConfirmed = doc.confirmed.includes(key);
        const edited = f.origin === "user";
        const canConfirm = f.status === "found" && !bad[key];
        return (
          <div key={key} className={`field ${f.status} ${isConfirmed ? "ok" : ""}`} data-testid={`field-${kind}-${key}`}>
            <div className="fhead">
              <strong>{t.keys[key]}</strong>
              <span className={`badge ${f.status}`} data-testid="status">{statusLabel(f.status)}</span>
              {edited ? <span className="badge user">{t.edited}</span> : aiSaw && <span className="badge">{t.aiOrigin}</span>}
              <span className={`conf ${isConfirmed ? "yes" : ""}`} data-testid="confirmed-state">{isConfirmed ? `✓ ${t.confirmed}` : t.notConfirmed}</span>
            </div>
            {key !== "otherCharges" && (
              <label className="valuerow">
                <span>{MONEY.includes(key) ? t.rupees : t.value}</span>
                <input
                  inputMode="decimal"
                  aria-invalid={bad[key] ? true : undefined}
                  data-testid={`input-${kind}-${key}`}
                  value={drafts[key] ?? displayValue(f)}
                  placeholder={f.status === "missing" ? t.notInDoc : ""}
                  onChange={(e) => applyEdit(f, e.target.value)}
                />
              </label>
            )}
            {f.qualifierText && <div className="qual">“{f.qualifierText}”</div>}
            <blockquote className="evidence" aria-label={t.evidence}>
              {f.supportingText ? f.supportingText : <em>{t.notInDoc}</em>}
            </blockquote>
            <div className="actions">
              <button type="button" disabled={!canConfirm} data-testid={`confirm-${kind}-${key}`} onClick={() => update(key, {}, !isConfirmed)}>
                {isConfirmed ? "↩" : "✓"} {t.confirm}
              </button>
              <button type="button" className="secondary" onClick={() => markMissing(f)}>{t.markMissing}</button>
              {edited && <button type="button" className="secondary" onClick={() => reset(f)}>{t.reset}</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
