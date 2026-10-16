import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { LABELS, RED_FLAG_LABELS, type ReviewResult } from "@/lib/review";
import { TIME_ZONE } from "@/lib/site";

export const metadata: Metadata = { title: "Your contract review", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const usd = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));
const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone: TIME_ZONE, month: "long", day: "numeric", year: "numeric" });

export default async function ReviewResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rows = /^[A-Za-z0-9_-]{20,64}$/.test(token)
    ? ((await sql()`
        SELECT result FROM submissions
        WHERE result_token = ${token} AND result IS NOT NULL AND sent_at > now() - interval '30 days'
      `) as { result: ReviewResult }[])
    : [];
  const r = rows[0]?.result;

  if (!r) {
    return (
      <div className="wrap narrow" style={{ paddingTop: 56 }}>
        <h1>This review link has expired</h1>
        <p>Review links work for 30 days after we send them. After that, the review is removed from this site.</p>
        <Link href="/submit" className="button secondary">Send a contract for review</Link>
      </div>
    );
  }

  const sent = new Date(r.sent_at);
  const expires = new Date(sent.getTime() + 30 * 86_400_000);
  const where = [r.seller.city, r.seller.state].filter(Boolean).join(", ");

  return (
    <div className="wrap result" style={{ paddingTop: 40 }}>
      <p className="note">Sent {day(sent)} · this page is available until {day(expires)}. You may want to print or save it.</p>
      <h1>Your contract review</h1>
      <p className="lead" style={{ color: "var(--muted)" }}>
        {LABELS[r.contract_type]} contract with <strong>{r.seller.name}</strong>
        {where && ` (${where})`}
        {r.service_type !== "not_applicable" && ` · ${LABELS[r.service_type]}`}
      </p>

      <div className="stat-row">
        <div className="stat"><span className="note">Contract total</span><strong>{usd(r.contract_total)}</strong></div>
        {r.est_savings != null && r.est_savings > 0 && (
          <div className="stat"><span className="note">Possible savings</span><strong>{usd(r.est_savings)}</strong></div>
        )}
        <div className="stat"><span className="note">Items to question</span><strong>{r.line_items.filter((li) => li.flagged).length}</strong></div>
      </div>

      <section className="advice">
        {r.advice.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
      </section>

      {r.red_flags.length > 0 && (
        <section>
          <h2>Things to ask about</h2>
          <ul>{r.red_flags.map((f, i) => <li key={i}>{typeof f === "string" ? f : f.note || RED_FLAG_LABELS[f.category]}</li>)}</ul>
        </section>
      )}

      <section>
        <h2>Line by line</h2>
        <table className="queue result-table">
          <thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Price</th><th>Our note</th></tr></thead>
          <tbody>
            {r.line_items.map((li, i) => (
              <tr key={i} className={li.flagged ? "flagged" : ""}>
                <td>{li.description}<div className="note">{LABELS[li.category]}</div></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{usd(li.price)}</td>
                <td>{li.flagged ? li.flag_reason || "Worth asking about" : "Looks typical"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="note" style={{ marginTop: 28 }}>
        This review is informational and is not legal or financial advice. It&apos;s based only on the documents you sent us.
      </p>
    </div>
  );
}
