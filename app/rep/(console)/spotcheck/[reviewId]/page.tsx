import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { scanPii } from "@/lib/pii";
import { audit, requireRep } from "@/lib/rep";
import { LABELS } from "@/lib/review";
import { loadTrainingRecords } from "@/lib/training";

const usd = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

async function saveCheck(formData: FormData) {
  "use server";
  const rep = await requireRep();
  const id = String(formData.get("id"));
  const verdict = String(formData.get("verdict") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  if (!["ok", "minor", "major"].includes(verdict)) redirect(`/rep/spotcheck/${id}?error=verdict`);
  if (notes && scanPii(notes).length) redirect(`/rep/spotcheck/${id}?error=pii`);

  const rows = (await sql()`
    INSERT INTO spot_checks (review_id, checker_code, verdict, notes)
    SELECT id, ${rep.reviewer_code}, ${verdict}, ${notes} FROM contract_reviews
    WHERE id = ${id} AND spot_check AND reviewer_code <> ${rep.reviewer_code}
    ON CONFLICT (review_id) DO NOTHING
    RETURNING review_id
  `) as { review_id: string }[];
  if (rows[0]) await audit(rep.id, "spot_check", null, verdict);
  redirect("/rep/spotcheck");
}

const ERRORS: Record<string, string> = {
  verdict: "Choose a result.",
  pii: "Your notes look like they contain personal details. Remove them and try again.",
};

export default async function SpotCheckPage({ params, searchParams }: { params: Promise<{ reviewId: string }>; searchParams: Promise<{ error?: string }> }) {
  const rep = await requireRep();
  const { reviewId } = await params;
  const { error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(reviewId)) notFound();
  const [r] = await loadTrainingRecords({ id: reviewId });
  if (!r || !r.spot_check.selected) notFound();
  const own = r.reviewer_code === rep.reviewer_code;
  const itemsTotal = r.line_items.reduce((n, li) => n + (li.price ?? 0), 0);

  return (
    <div className="wrap" style={{ paddingTop: 28, maxWidth: 900 }}>
      <p><Link href="/rep/spotcheck">← Spot check</Link></p>
      <h1 style={{ fontSize: "1.8rem" }}>{r.provider?.name ?? "Unknown seller"}</h1>
      <p className="note">
        {LABELS[r.contract_type]}
        {r.service_type && r.service_type !== "not_applicable" && ` · ${LABELS[r.service_type]}`} · contract {r.contract_month}
        {r.provider && (r.provider.city || r.provider.state) && ` · ${[r.provider.city, r.provider.state].filter(Boolean).join(", ")}`} · reviewed by {r.reviewer_code} on {r.created_at}
      </p>

      <div className="stat-row">
        <div className="stat"><span className="note">Contract total</span><strong>{usd(r.contract_total)}</strong></div>
        <div className="stat"><span className="note">Line items add up to</span><strong>{usd(itemsTotal)}</strong></div>
        <div className="stat"><span className="note">Estimated savings</span><strong>{usd(r.est_savings)}</strong></div>
      </div>

      <h2>Line items</h2>
      <table className="queue result-table">
        <thead><tr><th>Category</th><th>Description</th><th style={{ textAlign: "right" }}>Price</th><th>Flag</th></tr></thead>
        <tbody>
          {r.line_items.map((li, i) => (
            <tr key={i} className={li.flagged ? "flagged" : ""}>
              <td>{LABELS[li.category]}</td>
              <td>{li.description}</td>
              <td style={{ textAlign: "right" }}>{usd(li.price)}</td>
              <td>{li.flagged ? li.flag_reason || "Flagged" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.preneed && (
        <>
          <h2 style={{ marginTop: 24 }}>Preneed terms</h2>
          <p className="note">
            Funding: {LABELS[r.preneed.funding ?? "unknown"]} · Price guaranteed: {LABELS[r.preneed.price_guaranteed ?? "unknown"]} · Transferable:{" "}
            {r.preneed.transferable == null ? "Unknown" : r.preneed.transferable ? "Yes" : "No"} · Refund on cancel:{" "}
            {r.preneed.cancellation_refund_pct ?? "—"}% · Finance charges: {usd(r.preneed.finance_charges)} · State: {r.preneed.state ?? "—"}
          </p>
        </>
      )}

      <h2 style={{ marginTop: 24 }}>Red flags {r.ftc_issue && <span className="note">(possible FTC issue)</span>}</h2>
      {r.red_flags.length ? <ul>{r.red_flags.map((f, i) => <li key={i}>{f}</li>)}</ul> : <p className="note">None</p>}

      <h2 style={{ marginTop: 24 }}>Advice</h2>
      <div className="advice">{r.advice.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>

      {own ? (
        <p className="warn" style={{ marginTop: 24 }}>This is your own review. Another reviewer has to check it.</p>
      ) : r.spot_check.verdict ? (
        <p className="status" style={{ marginTop: 24 }}>Already checked by {r.spot_check.checker_code}.</p>
      ) : (
        <form action={saveCheck} className="group" style={{ marginTop: 28, display: "grid", gap: 12 }}>
          <input type="hidden" name="id" value={r.id} />
          <strong>Your check</strong>
          {error && <p className="error">{ERRORS[error] ?? "Something went wrong."}</p>}
          <label className="check"><input type="radio" name="verdict" value="ok" required /> Good. Fine to train on.</label>
          <label className="check"><input type="radio" name="verdict" value="minor" /> Minor issues (wording, a category or flag I&apos;d change)</label>
          <label className="check"><input type="radio" name="verdict" value="major" /> Major issues (wrong prices or advice, or personal details). Leave it out of training.</label>
          <label style={{ display: "grid", gap: 4 }}>
            <span className="note">Notes for the reviewer (no family details)</span>
            <textarea name="notes" rows={4} />
          </label>
          <div><button className="button" type="submit">Save check</button></div>
        </form>
      )}
    </div>
  );
}
