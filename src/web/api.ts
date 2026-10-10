import type { ConceptDiff, DocumentExtraction, ExtractedField, FieldKey } from "../shared/schema";
import type { CompareNote } from "../finance/compare";

export type DocKind = "offer" | "kfs";

export interface DocState {
  /** immutable AI output, kept so the original stays viewable beside user edits */
  original: DocumentExtraction;
  /** current values (AI value or user edit) */
  fields: ExtractedField[];
  /** keys the USER confirmed by clicking. The server/AI never sets this. */
  confirmed: FieldKey[];
  modelId: string;
}

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

export async function extract(kind: DocKind, blob: Blob): Promise<{ extraction: DocumentExtraction; modelId: string; toolsExposed: string[] }> {
  let res: Response;
  try {
    res = await fetch(`/api/extract/${kind}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob });
  } catch {
    throw new ApiError("network");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; extraction?: DocumentExtraction; modelId?: string; toolsExposed?: string[]; source?: string };
  if (!res.ok || !data.extraction) throw new ApiError(data.error ?? "failed", data.message);
  if (data.source !== "live-ai") throw new ApiError("failed", "Unexpected response source");
  return { extraction: data.extraction, modelId: data.modelId ?? "", toolsExposed: data.toolsExposed ?? [] };
}

export interface CalcResponse {
  blocked: boolean;
  missing?: FieldKey[];
  calculation?: { ok: boolean; error?: string; borrowingCostPaise?: number; tenureDays?: number; costPerDayPaise?: number; caveats: string[] };
  comparison: { diffs: ConceptDiff[]; notes: CompareNote[] };
}

export async function calculate(offer: DocState | undefined, kfs: DocState): Promise<CalcResponse> {
  const body = {
    offer: offer ? { fields: offer.fields, confirmedKeys: offer.confirmed } : undefined,
    kfs: { fields: kfs.fields, confirmedKeys: kfs.confirmed },
  };
  const res = await fetch("/api/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new ApiError("calc_failed");
  return (await res.json()) as CalcResponse;
}
