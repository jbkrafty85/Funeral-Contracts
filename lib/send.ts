import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { deleteBlobs } from "./blob";
import { sql } from "./db";
import { sendReviewReady } from "./notify";
import { scanPii } from "./pii";
import { audit, loadForEdit, type Rep } from "./rep";
import { ReviewDraft, sendBlockers, toResult, trainingText } from "./review";

export function siteOrigin(requestUrl: string) {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? new URL(requestUrl).origin;
}

type SendOutcome =
  | { ok: true; delivered: boolean; deliveryError?: string; filesDeleted: boolean }
  | { ok: false; status: number; error: string; pii?: { kind: string; match: string }[] };

// Send = the one door between the zones. In order:
//   1. Re-check everything server-side (fields, PII scan, rep's confirmation).
//   2. One transaction: write the training records (fresh ids, no link back) and close out
//      the submission with the family's 30-day result page.
//   3. Delete the uploaded files (the daily purge retries if this fails).
//   4. Email or text the family a link.
export async function performSend(rep: Rep, id: string, body: unknown, requestUrl: string): Promise<SendOutcome> {
  const access = await loadForEdit(rep, id);
  if ("error" in access && access.error) return { ok: false, status: access.status ?? 400, error: access.error };

  const input = body as { draft?: unknown; confirmNoPii?: unknown } | null;
  const parsed = ReviewDraft.safeParse(input?.draft);
  if (!parsed.success) return { ok: false, status: 400, error: "Some fields are invalid." };
  const d = parsed.data;

  const blockers = sendBlockers(d);
  if (blockers.length) return { ok: false, status: 400, error: blockers.join(" ") };
  const pii = scanPii(trainingText(d));
  if (pii.length) return { ok: false, status: 400, error: "Remove the personal details flagged in the review.", pii };
  if (input?.confirmNoPii !== true) return { ok: false, status: 400, error: "Confirm there are no personal details." };

  const db = sql();
  const sentAt = new Date();
  const token = randomBytes(24).toString("base64url");
  const reviewId = randomUUID();
  const p = d.provider;
  const name = p.name.trim().replace(/\s+/g, " ");
  const city = p.city?.trim() || null;
  const state = p.state?.trim().toUpperCase() || null;

  const updated = await db.transaction([
    // Close the submission first; if someone else already sent it, nothing below should count.
    db`UPDATE submissions
       SET status = 'sent', sent_at = ${sentAt}, purge_after = ${sentAt}::timestamptz + interval '7 days',
           result_token = ${token}, result = ${JSON.stringify(toResult(d, sentAt))}::jsonb,
           draft = NULL, draft_updated_at = NULL
       WHERE id = ${id} AND status = 'in_review'
       RETURNING contact_method, contact_value`,
    db`INSERT INTO providers (name, type, city, state) VALUES (${name}, ${p.type}, ${city}, ${state})
       ON CONFLICT (name, city, state) DO UPDATE SET type = EXCLUDED.type`,
    db`INSERT INTO contract_reviews (id, provider_id, contract_month, contract_type, service_type,
                                     contract_total, est_savings, reviewer_code, pii_check_passed, spot_check)
       SELECT ${reviewId},
              (SELECT id FROM providers WHERE name = ${name} AND city IS NOT DISTINCT FROM ${city} AND state IS NOT DISTINCT FROM ${state}),
              ${d.contract_month}, ${d.contract_type}, ${d.service_type},
              ${d.contract_total}, ${d.est_savings}, ${rep.reviewer_code}, true, random() < 0.1
       WHERE EXISTS (SELECT 1 FROM submissions WHERE id = ${id} AND result_token = ${token})`,
    ...d.line_items.map(
      (li) => db`INSERT INTO line_items (review_id, category, description, price, flagged, flag_reason)
                 SELECT ${reviewId}, ${li.category}, ${li.description.trim()}, ${li.price}, ${li.flagged}, ${li.flagged ? li.flag_reason : null}
                 WHERE EXISTS (SELECT 1 FROM contract_reviews WHERE id = ${reviewId})`,
    ),
    db`INSERT INTO review_advice (review_id, advice_text, red_flags, ftc_issue)
       SELECT ${reviewId}, ${d.advice.trim()}, ${d.red_flags}, ${d.ftc_issue}
       WHERE EXISTS (SELECT 1 FROM contract_reviews WHERE id = ${reviewId})`,
    ...(d.contract_type === "preneed" && d.preneed
      ? [
          db`INSERT INTO preneed_terms (review_id, funding, price_guaranteed, transferable, cancellation_refund_pct, finance_charges, state)
             SELECT ${reviewId}, ${d.preneed.funding}, ${d.preneed.price_guaranteed}, ${d.preneed.transferable},
                    ${d.preneed.cancellation_refund_pct}, ${d.preneed.finance_charges}, ${d.preneed.state?.toUpperCase() || null}
             WHERE EXISTS (SELECT 1 FROM contract_reviews WHERE id = ${reviewId})`,
        ]
      : []),
  ]);

  const contact = (updated[0] as { contact_method: "email" | "sms"; contact_value: string | null }[])[0];
  if (!contact) return { ok: false, status: 409, error: "This submission was already sent or returned to the queue." };
  await audit(rep.id, "send", id, `items=${d.line_items.length}`);

  // Files: no longer needed once the review exists.
  let filesDeleted = false;
  try {
    const files = (await db`SELECT blob_key FROM submission_files WHERE submission_id = ${id}`) as { blob_key: string }[];
    await deleteBlobs(files.map((f) => f.blob_key));
    await db`DELETE FROM submission_files WHERE submission_id = ${id}`;
    filesDeleted = true;
  } catch (err) {
    console.error("send: file deletion failed, purge job will retry:", err instanceof Error ? err.message : "unknown");
  }

  const delivery = await deliver(id, contact.contact_method, contact.contact_value, token, requestUrl);
  return { ok: true, delivered: delivery.ok, deliveryError: delivery.ok ? undefined : delivery.error, filesDeleted };
}

export async function deliver(id: string, method: "email" | "sms", to: string | null, token: string, requestUrl: string) {
  if (!to) return { ok: false as const, error: "Contact info already deleted" };
  const result = await sendReviewReady(method, to, `${siteOrigin(requestUrl)}/r/${token}`);
  if (result.ok) await sql()`UPDATE submissions SET delivered_at = now(), delivery_error = NULL WHERE id = ${id}`;
  else await sql()`UPDATE submissions SET delivery_error = ${result.error} WHERE id = ${id}`;
  return result;
}
