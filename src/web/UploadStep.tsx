import type { Strings } from "./i18n.en";
import type { DocKind } from "./api";

export interface Picked {
  blob: Blob;
  name: string;
  sample: boolean;
}

const SAMPLES: Record<DocKind, { file: string; label: string }[]> = {
  offer: [{ file: "offer-synthetic.png", label: "Offer: promises ₹9,500 credited" }],
  kfs: [
    { file: "final-terms-synthetic.png", label: "Final terms: ₹10,000 / ₹8,000 credited / ₹10,500 repay" },
    { file: "final-terms-missing-net-synthetic.png", label: "Final terms with net credit NOT stated" },
  ],
};

interface Props {
  t: Strings;
  kind: DocKind;
  title: string;
  picked?: Picked;
  disabled: boolean;
  onPick: (p: Picked | undefined) => void;
}

export function UploadCard({ t, kind, title, picked, disabled, onPick }: Props) {
  async function useSample(file: string) {
    const r = await fetch(`/samples/${file}`);
    onPick({ blob: await r.blob(), name: file, sample: true });
  }
  return (
    <section className="card" aria-label={title}>
      <h3>{title}</h3>
      <label className="file">
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={disabled}
          data-testid={`file-${kind}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            onPick(f ? { blob: f, name: f.name, sample: false } : undefined);
          }}
        />
        <span>{t.choose}</span>
      </label>
      <div className="samples">
        {SAMPLES[kind].map((s) => (
          <button key={s.file} type="button" className="link" disabled={disabled} data-testid={`sample-${s.file}`} onClick={() => useSample(s.file)}>
            {t.useSample}: {s.label}
          </button>
        ))}
      </div>
      {picked && (
        <div className="picked" data-testid={`picked-${kind}`}>
          <span>{picked.name}</span>
          {picked.sample && <span className="badge synthetic">{t.sampleLabel}</span>}
          {picked.blob.type.startsWith("image/") && <img alt={picked.name} src={URL.createObjectURL(picked.blob)} />}
        </div>
      )}
    </section>
  );
}
