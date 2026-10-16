import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireRep } from "@/lib/rep";
import { LABELS } from "@/lib/review";

const usd = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
const n = (v: unknown) => (v == null ? null : Number(v));

// One-series bar list: thin bars, value as text in ink (not the bar color), a title tooltip per bar.
function Bars({ rows, format = (v: number) => String(v), label }: { rows: { key: string; value: number }[]; format?: (v: number) => string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars" role="table" aria-label={label}>
      {rows.map((r) => (
        <div className="bar-row" role="row" key={r.key} title={`${r.key}: ${format(r.value)}`}>
          <span className="bar-label" role="rowheader">{r.key}</span>
          <span className="bar-track" role="cell" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="bar-value" role="cell">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function StatsPage() {
  const rep = await requireRep();
  if (rep.role !== "admin") redirect("/rep");
  const db = sql();

  const [totals, perMonth, byType, byProvider, byCategory, flags, spot] = (await Promise.all([
    db`SELECT count(*)::int AS reviews, avg(contract_total) AS avg_total, avg(est_savings) AS avg_savings,
              sum(est_savings) AS total_savings,
              (SELECT count(*)::int FROM review_advice WHERE ftc_issue) AS ftc
       FROM contract_reviews`,
    db`SELECT contract_month AS key, count(*)::int AS value FROM contract_reviews
       GROUP BY 1 ORDER BY 1 DESC LIMIT 24`,
    db`SELECT contract_type::text AS key, count(*)::int AS value, avg(contract_total) AS avg_total FROM contract_reviews GROUP BY 1 ORDER BY 2 DESC`,
    db`SELECT p.name, p.city, p.state, count(*)::int AS reviews, avg(r.contract_total) AS avg_total, avg(r.est_savings) AS avg_savings
       FROM contract_reviews r JOIN providers p ON p.id = r.provider_id
       GROUP BY p.id ORDER BY reviews DESC, avg_total DESC NULLS LAST LIMIT 25`,
    db`SELECT category, count(*)::int AS items, avg(price) AS avg_price,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
              avg(CASE WHEN flagged THEN 1.0 ELSE 0 END) AS flagged_share
       FROM line_items WHERE price IS NOT NULL GROUP BY 1 ORDER BY items DESC`,
    db`SELECT lower(trim(f)) AS key, count(*)::int AS value FROM review_advice, unnest(red_flags) AS f
       GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    db`SELECT count(*) FILTER (WHERE r.spot_check)::int AS selected, count(sc.review_id)::int AS checked,
              count(*) FILTER (WHERE sc.verdict = 'ok')::int AS ok, count(*) FILTER (WHERE sc.verdict = 'minor')::int AS minor,
              count(*) FILTER (WHERE sc.verdict = 'major')::int AS major
       FROM contract_reviews r LEFT JOIN spot_checks sc ON sc.review_id = r.id`,
  ])) as Record<string, unknown>[][];

  const t = totals[0];
  const s = spot[0];
  const months = (perMonth as { key: string; value: number }[]).map((m) => ({ key: m.key.trim(), value: m.value })).reverse();

  return (
    <div className="wrap wide" style={{ paddingTop: 28, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Training data</h1>
        <div className="row-actions">
          <span className="note">Download:</span>
          <a className="button small secondary" href="/api/rep/admin/export?format=jsonl">JSONL</a>
          <a className="button small secondary" href="/api/rep/admin/export?format=csv-reviews">Reviews CSV</a>
          <a className="button small secondary" href="/api/rep/admin/export?format=csv-items">Line items CSV</a>
        </div>
      </div>
      <p className="note">Downloads leave out reviews a spot-checker marked &quot;major issues.&quot; No family names or contact details are in this data.</p>

      <div className="stat-row">
        <div className="stat"><span className="note">Reviews sent</span><strong>{t.reviews as number}</strong></div>
        <div className="stat"><span className="note">Average contract</span><strong>{usd(n(t.avg_total))}</strong></div>
        <div className="stat"><span className="note">Average possible savings</span><strong>{usd(n(t.avg_savings))}</strong></div>
        <div className="stat"><span className="note">Total possible savings</span><strong>{usd(n(t.total_savings))}</strong></div>
        <div className="stat"><span className="note">Possible FTC issues</span><strong>{t.ftc as number}</strong></div>
      </div>

      <div className="stats-grid">
        <section className="group">
          <h2>Reviews by contract month</h2>
          {months.length ? <Bars rows={months} label="Reviews by contract month" /> : <p className="note">No data yet.</p>}
        </section>
        <section className="group">
          <h2>Top red flags</h2>
          {flags.length ? <Bars rows={flags as { key: string; value: number }[]} label="Top red flags" /> : <p className="note">No data yet.</p>}
        </section>
      </div>

      <section className="group" style={{ marginTop: 18 }}>
        <h2>By contract type</h2>
        <table className="queue">
          <thead><tr><th>Type</th><th>Reviews</th><th>Average total</th></tr></thead>
          <tbody>
            {byType.map((r) => (
              <tr key={r.key as string}><td>{LABELS[r.key as string]}</td><td>{r.value as number}</td><td>{usd(n(r.avg_total))}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="group" style={{ marginTop: 18 }}>
        <h2>Prices by category</h2>
        <table className="queue">
          <thead><tr><th>Category</th><th>Items</th><th>Median</th><th>Average</th><th>Flagged</th></tr></thead>
          <tbody>
            {byCategory.map((r) => (
              <tr key={r.category as string}>
                <td>{LABELS[r.category as string]}</td>
                <td>{r.items as number}</td>
                <td>{usd(n(r.median_price))}</td>
                <td>{usd(n(r.avg_price))}</td>
                <td>{Math.round(Number(r.flagged_share) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="group" style={{ marginTop: 18 }}>
        <h2>Sellers</h2>
        <table className="queue">
          <thead><tr><th>Seller</th><th>Location</th><th>Reviews</th><th>Average total</th><th>Average savings</th></tr></thead>
          <tbody>
            {byProvider.map((r, i) => (
              <tr key={i}>
                <td>{r.name as string}</td>
                <td>{[r.city, (r.state as string | null)?.trim()].filter(Boolean).join(", ") || "—"}</td>
                <td>{r.reviews as number}</td>
                <td>{usd(n(r.avg_total))}</td>
                <td>{usd(n(r.avg_savings))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="group" style={{ marginTop: 18 }}>
        <h2>Spot checks</h2>
        <p>
          {s.selected as number} selected · {s.checked as number} checked · {s.ok as number} good · {s.minor as number} minor · {s.major as number} major
        </p>
      </section>
    </div>
  );
}
