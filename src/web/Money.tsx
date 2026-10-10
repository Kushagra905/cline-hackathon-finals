import { money } from "./i18n";

/**
 * Financial figure with typographic emphasis. Purely presentational: the value comes from
 * integer paise (server-calculated or user-confirmed) and the text content is exactly money(paise).
 */
export function Money({ paise }: { paise: number | undefined }) {
  const s = money(paise);
  const m = /^(-?₹)([\d,]+)(\.\d{2})$/.exec(s);
  if (!m) return <>{s}</>;
  return (
    <>
      <span className="cur">{m[1]}</span>
      {m[2]}
      <span className="dec">{m[3]}</span>
    </>
  );
}
