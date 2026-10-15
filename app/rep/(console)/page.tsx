import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { audit, requireRep } from "@/lib/rep";
import { LABELS } from "@/lib/review";
import { deliver } from "@/lib/send";
import { formatTime } from "@/lib/site";

const TABS = [
  { status: "new", label: "New" },
  { status: "in_review", label: "In review" },
  { status: "sent", label: "Sent" },
] as const;

type Row = {
  id: string;
  created_at: string;
  contract_type: string;
  files: number;
  claimed_name: string | null;
  claimed_by: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  delivery_error: string | null;
  can_resend: boolean;
};

async function resend(formData: FormData) {
  "use server";
  const rep = await requireRep();
  const id = String(formData.get("id"));
  const rows = (await sql()`
    SELECT contact_method, contact_value, result_token FROM submissions
    WHERE id = ${id} AND status = 'sent' AND result_token IS NOT NULL AND (claimed_by = ${rep.id} OR ${rep.role} = 'admin')
  `) as { contact_method: "email" | "sms"; contact_value: string | null; result_token: string }[];
  const s = rows[0];
  if (s) {
    const h = await headers();
    await deliver(id, s.contact_method, s.contact_value, s.result_token, `https://${h.get("host")}/`);
    await audit(rep.id, "resend", id);
  }
  revalidatePath("/rep");
}

async function claim(formData: FormData) {
  "use server";
  const rep = await requireRep();
  const id = String(formData.get("id"));
  const rows = (await sql()`
    UPDATE submissions SET status = 'in_review', claimed_by = ${rep.id}
    WHERE id = ${id} AND status = 'new' AND claimed_by IS NULL
    RETURNING id
  `) as { id: string }[];
  if (!rows[0]) {
    revalidatePath("/rep");
    return;
  }
  await audit(rep.id, "claim", id);
  redirect(`/rep/review/${id}`);
}

function age(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ status?: string; sent?: string }> }) {
  const rep = await requireRep();
  const { status: raw, sent } = await searchParams;
  const status = TABS.find((t) => t.status === raw)?.status ?? "new";

  const counts = (await sql()`
    SELECT (CASE WHEN status = 'purged' THEN 'sent' ELSE status::text END) AS status, count(*)::int AS n FROM submissions GROUP BY 1
  `) as { status: string; n: number }[];
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  const rows = (await sql()`
    SELECT s.id, s.created_at, s.contract_type::text, s.claimed_by, r.display_name AS claimed_name,
           (SELECT count(*)::int FROM submission_files f WHERE f.submission_id = s.id) AS files,
           s.sent_at, s.delivered_at, s.delivery_error,
           (s.status = 'sent' AND s.contact_value IS NOT NULL AND s.result_token IS NOT NULL) AS can_resend
    FROM submissions s LEFT JOIN reps r ON r.id = s.claimed_by
    WHERE s.status = ${status} OR (${status} = 'sent' AND s.status = 'purged')
    ORDER BY CASE WHEN ${status} = 'sent' THEN -extract(epoch FROM s.sent_at) ELSE extract(epoch FROM s.created_at) END ASC
    LIMIT 200
  `) as Row[];

  return (
    <div className="wrap wide" style={{ paddingTop: 28 }}>
      <h1 style={{ fontSize: "1.8rem" }}>Review queue</h1>
      {sent === "delivered" && <p className="status">Review sent and delivered. The uploaded contract was deleted.</p>}
      {sent === "undelivered" && (
        <p className="warn">Review saved and the contract deleted, but the email or text didn&apos;t go out. Use Resend below once delivery is set up.</p>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <Link key={t.status} href={`/rep?status=${t.status}`} className={"tab" + (t.status === status ? " active" : "")} role="tab" aria-selected={t.status === status}>
            {t.label} <span className="count">{count(t.status)}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="note" style={{ padding: "24px 0" }}>Nothing here.</p>
      ) : (
        <table className="queue">
          <thead>
            <tr>
              <th>Received</th>
              <th>Contract</th>
              <th>{status === "sent" ? "Sent" : "Files"}</th>
              <th>Reviewer</th>
              {status === "sent" && <th>Delivery</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {formatTime(r.created_at)}
                  <div className="note">{age(r.created_at)}</div>
                </td>
                <td>{r.contract_type === "not_sure" ? "Not sure" : LABELS[r.contract_type]}</td>
                <td>{status === "sent" ? (r.sent_at ? formatTime(r.sent_at) : "—") : r.files}</td>
                <td>{r.claimed_name ?? "—"}</td>
                {status === "sent" && (
                  <td>
                    {r.delivered_at ? (
                      "Delivered"
                    ) : (
                      <span className="error" style={{ fontWeight: 500 }}>Not delivered{r.delivery_error ? `: ${r.delivery_error}` : ""}</span>
                    )}
                  </td>
                )}
                <td style={{ textAlign: "right" }}>
                  {status === "new" && (
                    <form action={claim}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="button small" type="submit">Claim</button>
                    </form>
                  )}
                  {status === "in_review" && (r.claimed_by === rep.id || rep.role === "admin") && (
                    <Link className="button small secondary" href={`/rep/review/${r.id}`}>Open</Link>
                  )}
                  {status === "sent" && !r.delivered_at && r.can_resend && (r.claimed_by === rep.id || rep.role === "admin") && (
                    <form action={resend}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="button small secondary" type="submit">Resend</button>
                    </form>
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
