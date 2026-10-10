import type { ConceptDiff, FieldKey } from "../shared/schema";
import type { CalcResponse } from "./api";
import type { Strings } from "./i18n.en";
import { money } from "./i18n";

interface Props {
  t: Strings;
  res: CalcResponse;
  kfsNet?: number;
  kfsRepay?: number;
}

const fmt = (d: ConceptDiff, side: "offer" | "kfs", t: Strings): string => {
  const days = side === "offer" ? d.offerValueDays : d.kfsValueDays;
  const paise = side === "offer" ? d.offerValuePaise : d.kfsValuePaise;
  if (d.unit === "days") return days === undefined ? t.notStated : `${days} ${t.days}`;
  return paise === undefined ? t.notStated : money(paise);
};

export function ResultCard({ t, res, kfsNet, kfsRepay }: Props) {
  const calc = res.calculation;
  return (
    <div data-testid="result">
      {res.blocked && (
        <section className="card blocked" role="alert" data-testid="blocked">
          <h3>{t.blockedTitle}</h3>
          <p>{t.blockedBody}</p>
          <ul>{res.missing?.map((k: FieldKey) => <li key={k} data-testid={`missing-${k}`}>{t.keys[k]}</li>)}</ul>
        </section>
      )}
      {!res.blocked && calc && !calc.ok && (
        <section className="card blocked" role="alert" data-testid="unsupported">
          <h3>{t.blockedTitle}</h3>
          <p>{t.unsupported}</p>
        </section>
      )}
      {!res.blocked && calc?.ok && (
        <section className="card result" data-testid="calc">
          <h3>{t.resultTitle}</h3>
          <dl className="stats">
            <div><dt>{t.netCredited}</dt><dd data-testid="net">{money(kfsNet)}</dd></div>
            <div><dt>{t.totalRepayment}</dt><dd data-testid="repay">{money(kfsRepay)}</dd></div>
            <div className="big"><dt>{t.cost}</dt><dd data-testid="cost">{money(calc.borrowingCostPaise)}</dd></div>
            <div><dt>{t.duration}</dt><dd data-testid="duration">{calc.tenureDays ? `${calc.tenureDays} ${t.days}` : "—"}</dd></div>
            {calc.costPerDayPaise !== undefined && <div><dt>{t.perDay}</dt><dd>{money(calc.costPerDayPaise)}</dd></div>}
          </dl>
          <p data-testid="explanation">
            {t.costTemplate(money(calc.borrowingCostPaise), money(kfsRepay), money(kfsNet), calc.tenureDays)}
          </p>
          <p className="meta">{t.caveatWithheld}</p>
        </section>
      )}

      <section className="card" data-testid="compare">
        <h3>{t.compareTitle}</h3>
        {res.comparison.notes.map((n, i) => (
          <p key={i} className="note" data-testid={`note-${n.code}`}>
            {n.code === "offer_principal_not_net_credit" ? t.notePrincipal : `${t.noteQualifier} “${n.qualifierText ?? ""}”`}
          </p>
        ))}
        <div className="table" role="table">
          {res.comparison.diffs.filter((d) => d.presence !== "neither").map((d) => (
            <div key={d.key} role="row" className={`row ${d.presence === "both" ? (d.differs ? "differs" : "same") : "nc"}`} data-testid={`diff-${d.key}`}>
              <div className="rk"><strong>{t.keys[d.key]}</strong>
                <span className="badge" data-testid="diff-state">{d.presence !== "both" ? t.notComparable : d.differs ? t.differs : t.same}</span>
              </div>
              <div className="rv">
                <div><span className="lbl">{t.offer}</span> {fmt(d, "offer", t)}
                  {d.offerEvidence && <blockquote className="evidence">{d.offerEvidence.text}</blockquote>}</div>
                <div><span className="lbl">{t.final}</span> {fmt(d, "kfs", t)}
                  {d.kfsEvidence && <blockquote className="evidence">{d.kfsEvidence.text}</blockquote>}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
