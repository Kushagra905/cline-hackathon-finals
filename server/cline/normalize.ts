import { z } from "zod";
import { parseRupeesToPaise } from "../../src/finance/money.js";
import {
  FieldKey,
  FieldStatus,
  Qualifier,
  type DocumentExtraction,
  type DocumentKind,
  type ExtractedField,
} from "../../src/shared/schema.js";

/**
 * Shape the model fills in (rupee TEXT, never converted by the model).
 * Server code below converts to integer paise and enforces status discipline.
 */
export const ModelField = z.object({
  key: FieldKey,
  status: FieldStatus,
  rupeeText: z.string().optional(),
  days: z.number().int().positive().optional(),
  count: z.number().int().positive().optional(),
  date: z.string().optional(),
  qualifier: Qualifier.optional(),
  qualifierText: z.string().optional(),
  supportingText: z.string(),
});
export const ModelExtraction = z.object({
  language: z.enum(["en", "hi", "mixed", "unknown"]),
  warnings: z.array(z.string()).optional(),
  fields: z.array(ModelField),
});
export type ModelExtraction = z.infer<typeof ModelExtraction>;

const MONEY_KEYS = new Set<FieldKey>(["principal", "netCredited", "withheldFees", "withheldTaxes", "totalRepayment"]);
export const ALL_KEYS = FieldKey.options as FieldKey[];

/**
 * Turns model output into a DocumentExtraction with every key present exactly once.
 * A field is never silently filled: absent keys become "missing"; "found" without
 * supporting text or with an unparseable value is downgraded to "ambiguous".
 */
export function normalizeExtraction(raw: unknown, kind: DocumentKind, now = new Date()): DocumentExtraction {
  const parsed = ModelExtraction.safeParse(raw);
  if (!parsed.success) throw new Error("The model returned data in an unexpected format.");
  const warnings = [...(parsed.data.warnings ?? [])];
  const byKey = new Map<FieldKey, z.infer<typeof ModelField>>();
  for (const f of parsed.data.fields) {
    if (byKey.has(f.key)) warnings.push(`Duplicate field "${f.key}" ignored.`);
    else byKey.set(f.key, f);
  }
  const fields: ExtractedField[] = ALL_KEYS.map((key) => {
    const m = byKey.get(key);
    const base = { key, documentId: kind, origin: "ai" as const };
    if (!m || m.status === "missing") return { ...base, status: "missing", supportingText: "" };
    const out: ExtractedField = {
      ...base,
      status: m.status,
      supportingText: m.supportingText.trim(),
      qualifier: m.qualifier,
      qualifierText: m.qualifierText,
    };
    let valueOk = true;
    if (MONEY_KEYS.has(key)) {
      const p = m.rupeeText === undefined ? null : parseRupeesToPaise(m.rupeeText);
      if (p === null) valueOk = false;
      else out.valuePaise = p;
    } else if (key === "tenureDays") {
      if (m.days === undefined) valueOk = false;
      else out.valueDays = m.days;
    } else if (key === "repaymentCount") {
      if (m.count === undefined) valueOk = false;
      else out.valueCount = m.count;
    } else if (key === "disbursalDate" || key === "repaymentDate") {
      if (m.date && /^\d{4}-\d{2}-\d{2}$/.test(m.date)) out.valueDate = m.date;
      else valueOk = false;
    }
    if (m.status === "found" && (out.supportingText.length === 0 || !valueOk)) {
      warnings.push(`"${key}" was marked found without usable evidence or value; downgraded to ambiguous.`);
      out.status = "ambiguous";
    }
    return out;
  });
  return {
    documentId: kind,
    kind,
    language: parsed.data.language,
    fields,
    extractedAt: now.toISOString(),
    warnings,
  };
}
