import { useState } from "react";
import { ApiError, calculate, extract, type CalcResponse, type DocKind, type DocState } from "./api";
import { STRINGS, type Lang } from "./i18n";
import { ResultCard } from "./ResultStep";
import { ReviewCard } from "./ReviewStep";
import { UploadCard, type Picked } from "./UploadStep";

type Phase = "upload" | "extracting" | "review";

export function App() {
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];
  const [picked, setPicked] = useState<Partial<Record<DocKind, Picked>>>({});
  const [docs, setDocs] = useState<Partial<Record<DocKind, DocState>>>({});
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [result, setResult] = useState<CalcResponse | null>(null);

  const errText = (e: unknown) =>
    e instanceof ApiError
      ? e.code === "not_configured"
        ? t.errNotConfigured
        : e.code === "bad_image" || e.code === "not_png_or_jpeg" || e.code === "too_large" || e.code === "empty"
          ? t.errBadImage
          : e.message && e.message !== e.code
            ? `${t.errGeneric} (${e.message})`
            : t.errGeneric
      : t.errGeneric;

  async function runExtraction() {
    if (!picked.kfs) return;
    setError(null);
    setResult(null);
    setPhase("extracting");
    try {
      const kinds = (["offer", "kfs"] as DocKind[]).filter((k) => picked[k]);
      // each document is extracted separately, in its own model call
      const out = await Promise.all(kinds.map((k) => extract(k, (picked[k] as Picked).blob)));
      const next: Partial<Record<DocKind, DocState>> = {};
      kinds.forEach((k, i) => {
        const x = out[i];
        next[k] = { original: x.extraction, fields: x.extraction.fields.map((f) => ({ ...f })), confirmed: [], modelId: x.modelId };
      });
      setDocs(next);
      setPhase("review");
    } catch (e) {
      setError(errText(e));
      setPhase("upload");
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

  const kfsField = (key: "netCredited" | "totalRepayment") => docs.kfs?.fields.find((f) => f.key === key)?.valuePaise;
  const busy = phase === "extracting";

  return (
    <main>
      <header>
        <div>
          <h1>LoanClear</h1>
          <p className="tag">{t.tagline}</p>
        </div>
        <div className="lang" role="group" aria-label="Language">
          <button type="button" className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} data-testid="lang-en" onClick={() => setLang("en")}>English</button>
          <button type="button" className={lang === "hi" ? "on" : ""} aria-pressed={lang === "hi"} data-testid="lang-hi" onClick={() => setLang("hi")}>हिन्दी</button>
        </div>
      </header>

      {error && (
        <div className="error" role="alert" data-testid="error">
          <strong>{t.errTitle}</strong> {error}
        </div>
      )}

      {phase !== "review" && (
        <>
          <div className="grid">
            <UploadCard t={t} kind="offer" title={t.offerDoc} picked={picked.offer} disabled={busy} onPick={(p) => setPicked((s) => ({ ...s, offer: p }))} />
            <UploadCard t={t} kind="kfs" title={t.kfsDoc} picked={picked.kfs} disabled={busy} onPick={(p) => setPicked((s) => ({ ...s, kfs: p }))} />
          </div>
          <div className="bar">
            <button type="button" className="primary" disabled={!picked.kfs || busy} data-testid="extract" onClick={runExtraction}>
              {busy ? t.extracting : error ? t.retry : t.extract}
            </button>
            {busy && <span className="spinner" role="status" aria-label={t.extracting} data-testid="loading" />}
          </div>
        </>
      )}

      {phase === "review" && docs.kfs && (
        <>
          <h2>{t.review}</h2>
          <p className="meta">{t.reviewHelp}</p>
          <div className="grid">
            {docs.offer && <ReviewCard t={t} title={t.offerDoc} doc={docs.offer} onChange={(d) => setDoc("offer", d)} />}
            <ReviewCard t={t} title={t.kfsDoc} doc={docs.kfs} onChange={(d) => setDoc("kfs", d)} />
          </div>
          <div className="bar">
            <button type="button" className="primary" disabled={calcBusy} data-testid="calculate" onClick={runCalc}>
              {calcBusy ? t.calculating : t.calculate}
            </button>
            <button type="button" className="secondary" onClick={reset}>{t.start}</button>
          </div>
          {result && <ResultCard t={t} res={result} kfsNet={kfsField("netCredited")} kfsRepay={kfsField("totalRepayment")} />}
        </>
      )}
    </main>
  );
}
