import type { ConceptDiff, FieldKey } from "../shared/schema";
import type { CalcResponse } from "./api";
import type { Strings } from "./i18n.en";
import { money } from "./i18n";
import { Money } from "./Money";

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

function Evidence({ d, side, t }: { d: ConceptDiff; side: "offer" | "kfs"; t: Strings }) {
  const e = side === "offer" ? d.offerEvidence : d.kfsEvidence;
  if (!e) return null;
  // A user-edited value has no document evidence of its own: show the original text as history only.
  return (
    <blockquote className={`evidence ${e.origin === "user" ? "old" : ""}`}>
      {e.origin === "user" && <span className="badge user">{t.userEdited}</span>}
      {e.text ? e.text : <em>{t.notInDoc}</em>}
    </blockquote>
  );
}

export function ResultCard({ t, res, kfsNet, kfsRepay }: Props) {
  const calc = res.calculation;
  const change = res.comparison.netCreditedChangePaise;
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
        <section className="card summary" data-testid="calc" aria-labelledby="res-h">
          <div className="summary-head">
            <h3 id="res-h">{t.resultTitle}</h3>
            <span className="badge code">{t.codeCalculated}</span>
          </div>
          {/* every figure below is the confirmed final-terms value or the server's paise calculation */}
          <dl className="headline">
            <div>
              <dt>{t.youReceive}</dt>
              <dd className="fig" data-testid="net"><Money paise={kfsNet} /></dd>
              <span className="sub">{t.netCredited}</span>
            </div>
            <div>
              <dt>{t.youRepay}</dt>
              <dd className="fig" data-testid="repay"><Money paise={kfsRepay} /></dd>
              <span className="sub">{t.totalRepayment}</span>
            </div>
          </dl>
          <dl className="secondary-stats">
            <div>
              <dt>{t.cost}</dt>
              <dd data-testid="cost"><Money paise={calc.borrowingCostPaise} /></dd>
              <small>{t.costHelp}</small>
            </div>
            <div>
              <dt>{t.duration}</dt>
              <dd data-testid="duration">{calc.tenureDays ? `${calc.tenureDays} ${t.days}` : "—"}</dd>
              {calc.costPerDayPaise !== undefined && <small>{t.perDay}: {money(calc.costPerDayPaise)}</small>}
            </div>
          </dl>
          <p className="explain" data-testid="explanation">
            {t.costTemplate(money(calc.borrowingCostPaise), money(kfsRepay), money(kfsNet), calc.tenureDays)}
          </p>
          <p className="meta">{t.caveatWithheld}</p>
        </section>
      )}

      {change !== undefined && (
        <section className="card change" data-testid="net-change" aria-labelledby="chg-h">
          <div>
            <h3 id="chg-h">{t.changeInReceived}</h3>
            <p className="meta">{t.changeInReceivedHelp}</p>
          </div>
          <p className="chg" data-testid="net-change-value">
            {change === 0 ? money(0) : `${change < 0 ? "−" : "+"}${money(Math.abs(change))}`}{" "}
            <span>({change < 0 ? t.lessReceived : change > 0 ? t.moreReceived : t.sameReceived})</span>
          </p>
        </section>
      )}

      {res.comparison.diffs.some((d) => d.presence !== "neither") && (
      <section className="card" data-testid="compare" aria-labelledby="cmp-h">
        <h3 id="cmp-h">{t.compareTitle}</h3>
        {res.comparison.notes.map((n, i) => (
          <p key={i} className="note" data-testid={`note-${n.code}`}>
            {n.code === "offer_principal_not_net_credit" ? t.notePrincipal : `${t.noteQualifier} “${n.qualifierText ?? ""}”`}
          </p>
        ))}
        <div className="table" role="list">
          {res.comparison.diffs.filter((d) => d.presence !== "neither").map((d) => (
            <div key={d.key} role="listitem" className={`row ${d.presence === "both" ? (d.differs ? "differs" : "same") : "nc"}`} data-testid={`diff-${d.key}`}>
              <div className="rk"><strong>{t.keys[d.key]}</strong>
                <span className="badge" data-testid="diff-state">{d.presence !== "both" ? t.notComparable : d.differs ? t.differs : t.same}</span>
              </div>
              <div className="rv">
                <div className="side"><span className="lbl">{t.offer}</span><span className="val">{fmt(d, "offer", t)}</span><Evidence d={d} side="offer" t={t} /></div>
                <div className="side"><span className="lbl">{t.final}</span><span className="val">{fmt(d, "kfs", t)}</span><Evidence d={d} side="kfs" t={t} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
