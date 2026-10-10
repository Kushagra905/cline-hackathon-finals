interface Props {
  labels: readonly string[];
  /** one short line per step, shown in the desktop rail only */
  hints?: readonly string[];
  /** zero-based index of the current step */
  current: number;
  navLabel: string;
}

/**
 * Visible step progression: upload → extract → review → confirm → costs.
 * Vertical workflow rail on desktop, compact horizontal indicator on mobile (CSS only).
 */
export function Stepper({ labels, hints, current, navLabel }: Props) {
  return (
    <nav aria-label={navLabel} className="stepper">
      <ol>
        {labels.map((l, i) => {
          const state = i < current ? "done" : i === current ? "now" : "todo";
          return (
            <li key={l} className={state} aria-current={i === current ? "step" : undefined} data-testid={`step-${i}`} data-state={state}>
              <span className="dot" aria-hidden="true">{i < current ? "✓" : i + 1}</span>
              <span className="lab">
                <span className="lab-t">{l}</span>
                {hints?.[i] && <span className="lab-h">{hints[i]}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
