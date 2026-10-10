import { useEffect, useMemo, useRef, useState } from "react";
import type { Strings } from "./i18n.en";
import type { DocKind } from "./api";

export interface Picked {
  blob: Blob;
  name: string;
  sample: boolean;
}

export const SAMPLE_FILES = { offer: "offer-synthetic.png", kfs: "final-terms-synthetic.png" } as const;

const SAMPLES: Record<DocKind, { file: string; label: string }[]> = {
  offer: [{ file: "offer-synthetic.png", label: "Offer: promises ₹9,500 credited" }],
  kfs: [
    { file: "final-terms-synthetic.png", label: "Final terms: ₹10,000 / ₹8,000 credited / ₹10,500 repay" },
    { file: "final-terms-missing-net-synthetic.png", label: "Final terms with net credit NOT stated" },
  ],
};

/** Same limits the server enforces (server/image.ts); checked here only to give faster feedback. */
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg"];

interface Props {
  t: Strings;
  kind: DocKind;
  title: string;
  help: string;
  required: boolean;
  picked?: Picked;
  disabled: boolean;
  /** true while this document is being read by the AI */
  reading: boolean;
  onPick: (p: Picked | undefined) => void;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function UploadCard({ t, kind, title, help, required, picked, disabled, reading, onPick }: Props) {
  const url = useMemo(() => (picked ? URL.createObjectURL(picked.blob) : undefined), [picked]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputId = `file-${kind}`;
  const errId = `file-err-${kind}`;

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErr(t.errFileType);
    if (f.size > MAX_BYTES) return setErr(t.errFileSize);
    setErr(null);
    onPick({ blob: f, name: f.name, sample: false });
  };

  async function useSample(file: string) {
    try {
      const r = await fetch(`/samples/${file}`);
      if (!r.ok) throw new Error(String(r.status));
      setErr(null);
      onPick({ blob: await r.blob(), name: file, sample: true });
    } catch {
      setErr(t.errSample);
    }
  }

  return (
    <section className={`card upload ${picked ? "has-file" : ""} ${reading ? "is-reading" : ""}`} aria-labelledby={`h-${kind}`}>
      <div className="upload-head">
        <h3 id={`h-${kind}`}>
          {title} <span className={`req ${required ? "on" : ""}`}>— {required ? t.required : t.optional}</span>
        </h3>
        {picked && !reading && <span className="tick" aria-hidden="true">✓</span>}
      </div>
      <p className="meta">{help}</p>

      <input
        ref={inputRef}
        id={inputId}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg"
        disabled={disabled}
        tabIndex={picked ? -1 : 0}
        aria-describedby={err ? errId : undefined}
        data-testid={`file-${kind}`}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      {!picked && (
        <label
          className={`drop ${over ? "over" : ""} ${disabled ? "off" : ""}`}
          htmlFor={inputId}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) accept(e.dataTransfer.files?.[0]); }}
        >
          <span className="drop-icon" aria-hidden="true">↑</span>
          <span className="drop-t">{t.dropTitle}</span>
          <span className="drop-h">{t.dropHint}</span>
        </label>
      )}

      {picked && (
        <div className="picked" data-testid={`picked-${kind}`}>
          <div className="preview">
            <img alt={picked.name} src={url} />
            {reading && (
              <div className="reading" role="status">
                <span className="spinner" aria-hidden="true" /> {t.reading}
              </div>
            )}
          </div>
          <div className="file-row">
            <div className="file-meta">
              <span className="fname">{picked.name}</span>
              <span className="fsize">{kb(picked.blob.size)}</span>
            </div>
            <span className={`badge ${picked.sample ? "synthetic" : ""}`} data-testid={`source-${kind}`}>
              {picked.sample ? t.sampleStatus : t.uploadedStatus}
            </span>
          </div>
          <div className="file-actions">
            <button type="button" className="secondary sm" disabled={disabled} onClick={() => inputRef.current?.click()}>{t.replace}</button>
            <button type="button" className="ghost sm" disabled={disabled} onClick={() => { setErr(null); onPick(undefined); }}>{t.remove}</button>
          </div>
        </div>
      )}

      {err && <p className="field-err" id={errId} role="alert">{err}</p>}

      <div className="samples">
        {SAMPLES[kind].map((s) => (
          <button key={s.file} type="button" className="link" disabled={disabled} data-testid={`sample-${s.file}`} onClick={() => useSample(s.file)}>
            {t.useSample}: {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}
