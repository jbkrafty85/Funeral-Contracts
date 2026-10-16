import Link from "next/link";
import { sql } from "@/lib/db";
import { requireRep } from "@/lib/rep";
import { LABELS } from "@/lib/review";

type Row = { id: string; created_at: string; contract_month: string; contract_type: string; reviewer_code: string; p_name: string | null; verdict: string | null; checker_code: string | null };

export default async function SpotCheckQueue({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const rep = await requireRep();
  const { done } = await searchParams;
  const showDone = done === "1";

  const rows = (await sql()`
    SELECT r.id, r.created_at::text, r.contract_month, r.contract_type::text, r.reviewer_code, p.name AS p_name,
           sc.verdict, sc.checker_code
    FROM contract_reviews r
    LEFT JOIN providers p ON p.id = r.provider_id
    LEFT JOIN spot_checks sc ON sc.review_id = r.id
    WHERE r.spot_check AND (${showDone} OR (sc.review_id IS NULL AND r.reviewer_code <> ${rep.reviewer_code}))
    ORDER BY r.created_at ASC
    LIMIT 200
  `) as Row[];

  return (
    <div className="wrap wide" style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: "1.8rem" }}>Spot check</h1>
      <p className="note">
        About 1 in 10 sent reviews is picked for a second look. You can&apos;t check your own. The contract is already deleted, so judge the
        saved record: do the categories, prices, flags and advice make sense together, and is it free of personal details?
      </p>
      <div className="tabs">
        <Link href="/rep/spotcheck" className={"tab" + (!showDone ? " active" : "")}>To check</Link>
        <Link href="/rep/spotcheck?done=1" className={"tab" + (showDone ? " active" : "")}>All selected</Link>
      </div>
      {rows.length === 0 ? (
        <p className="note" style={{ padding: "24px 0" }}>{showDone ? "No reviews selected yet." : "Nothing waiting for you."}</p>
      ) : (
        <table className="queue">
          <thead>
            <tr><th>Sent</th><th>Seller</th><th>Contract</th><th>Month</th><th>Reviewer</th><th>Result</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at}</td>
                <td>{r.p_name ?? "—"}</td>
                <td>{LABELS[r.contract_type]}</td>
                <td>{r.contract_month}</td>
                <td>{r.reviewer_code}</td>
                <td>{r.verdict ? `${VERDICTS[r.verdict]} (${r.checker_code})` : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {!r.verdict && r.reviewer_code !== rep.reviewer_code && (
                    <Link className="button small" href={`/rep/spotcheck/${r.id}`}>Check</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const VERDICTS: Record<string, string> = { ok: "Good", minor: "Minor issues", major: "Major issues" };
