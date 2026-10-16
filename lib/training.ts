import "server-only";
import { sql } from "./db";

// Read side of the training zone. Nothing here can reach a submission — there is no link.

export type TrainingRecord = {
  id: string;
  created_at: string;
  contract_month: string;
  contract_type: string;
  service_type: string | null;
  provider: { name: string; type: string; city: string | null; state: string | null } | null;
  contract_total: number | null;
  est_savings: number | null;
  reviewer_code: string;
  line_items: { category: string; description: string; price: number | null; flagged: boolean; flag_reason: string | null }[];
  advice: string;
  red_flags: { category: string; note: string | null }[];
  ftc_issue: boolean;
  preneed: {
    funding: string | null;
    price_guaranteed: string | null;
    transferable: boolean | null;
    cancellation_refund_pct: number | null;
    finance_charges: number | null;
    state: string | null;
  } | null;
  spot_check: { selected: boolean; verdict: string | null; checker_code: string | null; notes: string | null };
};

const num = (v: unknown) => (v == null ? null : Number(v));

export async function loadTrainingRecords(opts: { id?: string } = {}): Promise<TrainingRecord[]> {
  const db = sql();
  const id = opts.id ?? null;
  const [reviews, items, advice, preneed, flags] = (await Promise.all([
    db`SELECT r.id, r.created_at::text, r.contract_month, r.contract_type::text, r.service_type, r.contract_total, r.est_savings,
              r.reviewer_code, r.spot_check, p.name AS p_name, p.type AS p_type, p.city AS p_city, p.state AS p_state,
              sc.verdict, sc.checker_code, sc.notes AS sc_notes
       FROM contract_reviews r
       LEFT JOIN providers p ON p.id = r.provider_id
       LEFT JOIN spot_checks sc ON sc.review_id = r.id
       WHERE ${id}::uuid IS NULL OR r.id = ${id}::uuid
       ORDER BY r.created_at, r.contract_month`,
    db`SELECT review_id, category, description, price, flagged, flag_reason FROM line_items
       WHERE ${id}::uuid IS NULL OR review_id = ${id}::uuid ORDER BY review_id, id`,
    db`SELECT review_id, advice_text, ftc_issue FROM review_advice WHERE ${id}::uuid IS NULL OR review_id = ${id}::uuid`,
    db`SELECT * FROM preneed_terms WHERE ${id}::uuid IS NULL OR review_id = ${id}::uuid`,
    db`SELECT review_id, category, note FROM red_flags WHERE ${id}::uuid IS NULL OR review_id = ${id}::uuid ORDER BY review_id, id`,
  ])) as Record<string, unknown>[][];

  const byReview = <T,>(rows: Record<string, unknown>[], map: (r: Record<string, unknown>) => T) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = r.review_id as string;
      m.set(k, [...(m.get(k) ?? []), map(r)]);
    }
    return m;
  };
  const itemMap = byReview(items, (r) => ({
    category: r.category as string,
    description: r.description as string,
    price: num(r.price),
    flagged: r.flagged as boolean,
    flag_reason: (r.flag_reason as string | null) ?? null,
  }));
  const flagMap = byReview(flags, (r) => ({ category: r.category as string, note: (r.note as string | null) ?? null }));
  const adviceMap = new Map(advice.map((a) => [a.review_id as string, a]));
  const preneedMap = new Map(preneed.map((p) => [p.review_id as string, p]));

  return reviews.map((r) => {
    const a = adviceMap.get(r.id as string);
    const p = preneedMap.get(r.id as string);
    return {
      id: r.id as string,
      created_at: r.created_at as string,
      contract_month: (r.contract_month as string).trim(),
      contract_type: r.contract_type as string,
      service_type: (r.service_type as string | null) ?? null,
      provider: r.p_name
        ? { name: r.p_name as string, type: r.p_type as string, city: r.p_city as string | null, state: (r.p_state as string | null)?.trim() ?? null }
        : null,
      contract_total: num(r.contract_total),
      est_savings: num(r.est_savings),
      reviewer_code: r.reviewer_code as string,
      line_items: itemMap.get(r.id as string) ?? [],
      advice: (a?.advice_text as string) ?? "",
      red_flags: flagMap.get(r.id as string) ?? [],
      ftc_issue: Boolean(a?.ftc_issue),
      preneed: p
        ? {
            funding: p.funding as string | null,
            price_guaranteed: p.price_guaranteed as string | null,
            transferable: p.transferable as boolean | null,
            cancellation_refund_pct: num(p.cancellation_refund_pct),
            finance_charges: num(p.finance_charges),
            state: (p.state as string | null)?.trim() ?? null,
          }
        : null,
      spot_check: {
        selected: Boolean(r.spot_check),
        verdict: (r.verdict as string | null) ?? null,
        checker_code: (r.checker_code as string | null) ?? null,
        notes: (r.sc_notes as string | null) ?? null,
      },
    };
  });
}
