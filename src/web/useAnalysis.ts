import { useState } from "react";
import { ApiError, calculate, extract, type CalcResponse, type DocKind, type DocState } from "./api";
import type { Strings } from "./i18n.en";
import { SAMPLE_FILES, type Picked } from "./UploadStep";

export type Phase = "upload" | "extracting" | "review";
type PickedMap = Partial<Record<DocKind, Picked>>;

const fetchSample = async (file: string): Promise<Picked> => {
  const r = await fetch(`/samples/${file}`);
  if (!r.ok) throw new ApiError("sample_unavailable");
  return { blob: await r.blob(), name: file, sample: true };
};

/** Owns session state. Extraction is a real server call; nothing here fabricates AI results. */
export function useAnalysis(t: Strings) {
  const [picked, setPicked] = useState<PickedMap>({});
  const [docs, setDocs] = useState<Partial<Record<DocKind, DocState>>>({});
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [result, setResult] = useState<CalcResponse | null>(null);

  const errText = (e: unknown) =>
    e instanceof ApiError
      ? e.code === "not_configured"
        ? t.errNotConfigured
        : e.code === "rate_limited"
          ? t.errRateLimited
          : e.code === "timeout"
            ? t.errTimeout
        : ["bad_image", "not_png_or_jpeg", "too_large", "empty"].includes(e.code)
          ? t.errBadImage
          : e.message && e.message !== e.code
            ? `${t.errGeneric} (${e.message})`
            : t.errGeneric
      : t.errGeneric;

  async function runExtraction(p: PickedMap = picked) {
    if (!p.kfs) return;
    setError(null);
    setResult(null);
    setPhase("extracting");
    try {
      const kinds = (["offer", "kfs"] as DocKind[]).filter((k) => p[k]);
      // each document is extracted separately, in its own model call
      const out = await Promise.all(kinds.map((k) => extract(k, (p[k] as Picked).blob)));
      const next: Partial<Record<DocKind, DocState>> = {};
      kinds.forEach((k, i) => {
        const x = out[i];
        next[k] = {
          original: x.extraction,
          fields: x.extraction.fields.map((f) => ({ ...f })),
          confirmed: [],
          modelId: x.modelId,
          toolCalls: x.toolCalls,
          toolsExposed: x.toolsExposed,
        };
      });
      setDocs(next);
      setPhase("review");
    } catch (e) {
      setError(errText(e));
      setPhase("upload");
    }
  }

  async function tryExample() {
    setError(null);
    try {
      const [offer, kfs] = await Promise.all([fetchSample(SAMPLE_FILES.offer), fetchSample(SAMPLE_FILES.kfs)]);
      const p = { offer, kfs };
      setPicked(p);
      await runExtraction(p);
    } catch (e) {
      setError(errText(e));
    }
  }

  async function runCalc() {
    if (!docs.kfs) return;
    setCalcBusy(true);
    setError(null);
    try {
      setResult(await calculate(docs.offer, docs.kfs));
    } catch (e) {
      setError(errText(e));
    } finally {
      setCalcBusy(false);
    }
  }

  const reset = () => {
    setPicked({});
    setDocs({});
    setResult(null);
    setError(null);
    setPhase("upload");
  };

  const setDoc = (k: DocKind, d: DocState) => {
    setDocs((prev) => ({ ...prev, [k]: d }));
    setResult(null); // any change invalidates a previous result
  };

  return { picked, setPicked, docs, phase, error, calcBusy, result, runExtraction, tryExample, runCalc, reset, setDoc };
}
