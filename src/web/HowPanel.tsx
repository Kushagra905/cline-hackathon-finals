import type { DocKind, DocState } from "./api";
import type { Strings } from "./i18n.en";

interface Props {
  t: Strings;
  docs: Partial<Record<DocKind, DocState>>;
  labels: Record<DocKind, string>;
}

/**
 * Compact explanation of who does what. Runtime facts come ONLY from what the server
 * reported for the extraction calls that actually happened in this session.
 */
export function HowPanel({ t, docs, labels }: Props) {
  const kinds = (["offer", "kfs"] as DocKind[]).filter((k) => docs[k]);
  return (
    <details className="how" data-testid="how-panel" open={kinds.length > 0}>
      <summary>
        <span className="how-title">{t.howTitle}</span>
        <span className="how-line">{t.howLine}</span>
      </summary>
      <div className="how-body">
      <div className="three">
        <div className="who"><span className="n" aria-hidden="true">1</span><strong>{t.howAi}</strong><p>{t.howAiBody}</p></div>
        <div className="who"><span className="n" aria-hidden="true">2</span><strong>{t.howUser}</strong><p>{t.howUserBody}</p></div>
        <div className="who"><span className="n" aria-hidden="true">3</span><strong>{t.howCode}</strong><p>{t.howCodeBody}</p></div>
      </div>
      <h4>{t.howRuntime}</h4>
      {kinds.length === 0 ? (
        <p className="meta">{t.howNoRuntime}</p>
      ) : (
        <ul className="runtime" data-testid="runtime">
          {kinds.map((k) => {
            const d = docs[k] as DocState;
            return (
              <li key={k} data-testid={`runtime-${k}`}>
                <strong>{labels[k]}</strong>
                <span>{t.howStatus}: {t.howLive}</span>
                <span>{t.howModel}: <code>{d.modelId}</code></span>
                <span>{t.howTool}: {t.howToolRan} {d.toolCalls} {t.howToolTimes}</span>
                <span>{t.howOnlyTool}: <code>{d.toolsExposed.join(", ") || "—"}</code></span>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </details>
  );
}
