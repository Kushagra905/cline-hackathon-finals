import { useEffect, useRef, useState } from "react";
import { missingCriticalKeys } from "../finance/facts";
import type { DocKind } from "./api";
import { HowPanel } from "./HowPanel";
import { STRINGS, type Lang } from "./i18n";
import { ResultCard } from "./ResultStep";
import { ReviewBoard } from "./ReviewStep";
import { Stepper } from "./Stepper";
import { UploadCard } from "./UploadStep";
import { useAnalysis } from "./useAnalysis";

export function App() {
  const [lang, setLang] = useState<Lang>("en");
  const t = STRINGS[lang];
  const a = useAnalysis(t);
  const { picked, docs, phase, error, calcBusy, result } = a;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  // move focus to the review heading once extraction finishes (keyboard / screen-reader users)
  useEffect(() => {
    if (phase === "review") headingRef.current?.focus();
  }, [phase]);

  const kfsField = (key: "netCredited" | "totalRepayment") => docs.kfs?.fields.find((f) => f.key === key)?.valuePaise;
  const busy = phase === "extracting";

  // steps: 0 upload, 1 extract, 2 review, 3 confirm, 4 costs
  const kfsMissing = docs.kfs ? missingCriticalKeys({ fields: docs.kfs.fields, confirmedKeys: docs.kfs.confirmed }) : [];
  const calcOk = !!result && !result.blocked && !!result.calculation?.ok;
  const step = phase === "upload" ? 0 : phase === "extracting" ? 1 : calcOk ? 4 : docs.kfs && docs.kfs.confirmed.length > 0 ? 3 : 2;
  const critTotal = 3; // net credited, total repayment, tenure
  const critDone = critTotal - kfsMissing.filter((k) => ["netCredited", "totalRepayment", "tenureDays"].includes(k)).length;
  const labels: Record<DocKind, string> = { offer: t.offerDoc, kfs: t.kfsDoc };
  const inReview = phase === "review" && !!docs.kfs;

  // a successful calculation moves focus to the summary at the top of the workspace
  useEffect(() => {
    if (calcOk) resultsRef.current?.focus();
  }, [calcOk]);

  const resultCard = result && <ResultCard t={t} res={result} kfsNet={kfsField("netCredited")} kfsRepay={kfsField("totalRepayment")} />;

  return (
    <>
      <a className="skip" href="#main">{t.skipLink}</a>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">LC</span>
          <span className="wordmark">LoanClear</span>
          <span className="tag">{t.tagline}</span>
        </div>
        <div className="lang" role="group" aria-label="Language / भाषा">
          <button type="button" className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} lang="en" data-testid="lang-en" onClick={() => setLang("en")}>English</button>
          <button type="button" className={lang === "hi" ? "on" : ""} aria-pressed={lang === "hi"} lang="hi" data-testid="lang-hi" onClick={() => setLang("hi")}>हिन्दी</button>
        </div>
      </header>

      <div className="shell">
        <aside className="rail">
          <p className="rail-t">{t.workflow}</p>
          <Stepper labels={t.steps} hints={t.stepHints} current={step} navLabel={t.stepNow} />
          <p className="rail-step" aria-hidden="true">{t.stepOf(step + 1, t.steps.length)} · {t.steps[step]}</p>
        </aside>

        <main id="main" className="workspace">
          {error && (
            <div className="error" role="alert" data-testid="error">
              <strong>{t.errTitle}</strong> {error}
            </div>
          )}

          {!inReview && (
            <>
              <div className="page-head">
                <h1>{t.uploadTitle}</h1>
                <p className="lead">{t.uploadHelp}</p>
              </div>

              <section className="example" aria-labelledby="try-h">
                <div>
                  <span className="badge synthetic">{t.sampleLabel}</span>
                  <h2 id="try-h">{t.tryExample}</h2>
                  <p>{t.tryExampleHelp}</p>
                </div>
                <button type="button" className="primary" disabled={busy} data-testid="try-example" onClick={a.tryExample}>
                  {busy ? t.extracting : t.tryExample}
                </button>
              </section>

              <p className="or"><span>{t.orUpload}</span></p>
              <div className="grid two-col">
                <UploadCard t={t} kind="offer" title={t.offerUploadTitle} help={t.offerUploadHelp} required={false} picked={picked.offer} disabled={busy} reading={busy && !!picked.offer} onPick={(p) => a.setPicked((s) => ({ ...s, offer: p }))} />
                <UploadCard t={t} kind="kfs" title={t.kfsUploadTitle} help={t.kfsUploadHelp} required picked={picked.kfs} disabled={busy} reading={busy && !!picked.kfs} onPick={(p) => a.setPicked((s) => ({ ...s, kfs: p }))} />
              </div>

              <div className="action-bar">
                <p className="meta" aria-live="polite">{busy ? t.extracting : picked.kfs ? t.readyHint : t.needKfs}</p>
                <div className="action-btns">
                  {busy && <span className="spinner" role="status" aria-label={t.extracting} data-testid="loading" />}
                  <button type="button" className="primary" disabled={!picked.kfs || busy} data-testid="extract" onClick={() => a.runExtraction()}>
                    {busy ? t.extracting : error ? t.retry : `${t.extract} →`}
                  </button>
                </div>
              </div>
            </>
          )}

          {inReview && docs.kfs && (
            <>
              {calcOk && (
                <div className="results-block">
                  <div className="page-head">
                    <h1 tabIndex={-1} ref={resultsRef}>{t.resultsTitle}</h1>
                    <p className="lead">{t.resultsHelp}</p>
                  </div>
                  {resultCard}
                </div>
              )}

              <div className="page-head">
                {calcOk ? <h2 tabIndex={-1} ref={headingRef}>{t.factsUsed}</h2> : <h1 tabIndex={-1} ref={headingRef}>{t.review}</h1>}
                <p className="lead">{t.reviewHelp}</p>
                <p className="progress" data-testid="progress" aria-live="polite">
                  <span>{t.critical}: <strong>{critDone} {t.of} {critTotal}</strong> {t.progress.toLowerCase()}</span>
                  <span className="bar-track" aria-hidden="true"><span style={{ width: `${(critDone / critTotal) * 100}%` }} /></span>
                </p>
              </div>

              <ReviewBoard t={t} offer={docs.offer} kfs={docs.kfs} onChange={(k, d) => a.setDoc(k, d)} />

              <div className="action-bar">
                <button type="button" className="ghost" onClick={a.reset}>{t.start}</button>
                <button type="button" className="primary" disabled={calcBusy} data-testid="calculate" onClick={a.runCalc}>
                  {calcBusy ? t.calculating : `${t.calculate} →`}
                </button>
              </div>
              {/* blocked / unsupported states stay next to the action that produced them */}
              {!calcOk && resultCard}
            </>
          )}

          <HowPanel t={t} docs={docs} labels={labels} />
        </main>
      </div>
    </>
  );
}
