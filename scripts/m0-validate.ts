import { z } from "zod";
import { parseRupeesToPaise } from "../src/finance/money.js";

/**
 * Milestone 0 extraction contract (spike only). The model returns rupee TEXT
 * plus verbatim supporting text; the server code parses to integer paise.
 */
export const SpikeKey = z.enum([
  "principal",
  "netCredited",
  "withheldFees",
  "totalRepayment",
  "tenureDays",
]);
export type SpikeKey = z.infer<typeof SpikeKey>;

export const SpikeField = z.object({
  key: SpikeKey,
  status: z.enum(["found", "missing", "ambiguous"]),
  rupeeText: z.string().optional(),
  days: z.number().int().positive().optional(),
  qualifierText: z.string().optional(),
  supportingText: z.string(),
});
export type SpikeField = z.infer<typeof SpikeField>;

export const SpikeExtraction = z.object({
  documentId: z.string(),
  fields: z.array(SpikeField),
});
export type SpikeExtraction = z.infer<typeof SpikeExtraction>;

export interface ExpectedField {
  status: "found" | "missing" | "ambiguous";
  valuePaise?: number;
  valueDays?: number;
}

export interface ValidationReport {
  ok: boolean;
  problems: string[];
  paise: Partial<Record<SpikeKey, number>>;
}

/** Validates structure, status discipline and expected values. Pure; no I/O. */
export function validateExtraction(
  raw: unknown,
  expectedDocumentId: string,
  expected: Partial<Record<SpikeKey, ExpectedField>>,
): ValidationReport {
  const problems: string[] = [];
  const paise: Partial<Record<SpikeKey, number>> = {};
  const parsed = SpikeExtraction.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, problems: ["schema: " + parsed.error.message], paise };
  }
  const doc = parsed.data;
  if (doc.documentId !== expectedDocumentId) {
    problems.push(`documentId ${doc.documentId} != ${expectedDocumentId}`);
  }
  const byKey = new Map<SpikeKey, SpikeField>();
  for (const f of doc.fields) {
    if (byKey.has(f.key)) problems.push(`duplicate field ${f.key}`);
    byKey.set(f.key, f);
    if (f.status === "found") {
      if (f.supportingText.trim().length === 0) problems.push(`${f.key}: found without supportingText`);
      if (f.key === "tenureDays") {
        if (f.days === undefined) problems.push(`${f.key}: found without days`);
      } else {
        const p = f.rupeeText === undefined ? null : parseRupeesToPaise(f.rupeeText);
        if (p === null) problems.push(`${f.key}: unparseable rupeeText ${JSON.stringify(f.rupeeText)}`);
        else paise[f.key] = p;
      }
    } else if (f.rupeeText !== undefined || f.days !== undefined) {
      problems.push(`${f.key}: ${f.status} field must not carry a value`);
    }
  }
  for (const [key, exp] of Object.entries(expected) as [SpikeKey, ExpectedField][]) {
    const f = byKey.get(key);
    const actualStatus = f?.status ?? "missing"; // an absent field counts as missing, never filled
    if (actualStatus !== exp.status) {
      problems.push(`${key}: status ${actualStatus} != expected ${exp.status}`);
      continue;
    }
    if (exp.status === "found") {
      if (exp.valuePaise !== undefined && paise[key] !== exp.valuePaise) {
        problems.push(`${key}: paise ${paise[key]} != expected ${exp.valuePaise}`);
      }
      if (exp.valueDays !== undefined && f?.days !== exp.valueDays) {
        problems.push(`${key}: days ${f?.days} != expected ${exp.valueDays}`);
      }
    }
  }
  return { ok: problems.length === 0, problems, paise };
}
