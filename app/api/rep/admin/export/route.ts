import { audit, currentRep } from "@/lib/rep";
import { loadTrainingRecords, type TrainingRecord } from "@/lib/training";

// Admin-only download of the training zone. It holds no family PII by design: prices, seller,
// month, the reviewer code and the reviewer's advice. Reviews a spot-checker marked "major"
// are left out unless ?include=all.
export async function GET(request: Request) {
  const rep = await currentRep();
  if (!rep) return new Response("Unauthorized", { status: 401 });
  if (rep.role !== "admin") return new Response("Admins only", { status: 403 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "jsonl";
  const includeAll = url.searchParams.get("include") === "all";

  const records = (await loadTrainingRecords()).filter((r) => includeAll || r.spot_check.verdict !== "major");
  await audit(rep.id, "export", null, `${format} rows=${records.length}${includeAll ? " all" : ""}`);

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "jsonl") {
    return file(records.map((r) => JSON.stringify(r)).join("\n") + "\n", `training-${stamp}.jsonl`, "application/x-ndjson");
  }
  if (format === "csv-items") return file(toCsv(itemRows(records)), `training-line-items-${stamp}.csv`, "text/csv");
  if (format === "csv-reviews") return file(toCsv(reviewRows(records)), `training-reviews-${stamp}.csv`, "text/csv");
  return new Response("Unknown format", { status: 400 });
}

function file(body: string, name: string, type: string) {
  return new Response(body, {
    headers: { "Content-Type": `${type}; charset=utf-8`, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

function base(r: TrainingRecord) {
  return {
    review_id: r.id,
    reviewed_on: r.created_at,
    contract_month: r.contract_month,
    contract_type: r.contract_type,
    service_type: r.service_type,
    seller: r.provider?.name ?? "",
    seller_type: r.provider?.type ?? "",
    seller_city: r.provider?.city ?? "",
    seller_state: r.provider?.state ?? "",
    contract_total: r.contract_total,
    est_savings: r.est_savings,
    reviewer_code: r.reviewer_code,
    spot_check: r.spot_check.verdict ?? (r.spot_check.selected ? "pending" : ""),
  };
}

function itemRows(records: TrainingRecord[]) {
  return records.flatMap((r) =>
    r.line_items.map((li) => ({ ...base(r), category: li.category, description: li.description, price: li.price, flagged: li.flagged, flag_reason: li.flag_reason })),
  );
}

function reviewRows(records: TrainingRecord[]) {
  return records.map((r) => ({
    ...base(r),
    line_item_count: r.line_items.length,
    flagged_count: r.line_items.filter((li) => li.flagged).length,
    ftc_issue: r.ftc_issue,
    red_flag_categories: r.red_flags.map((f) => f.category).join(" | "),
    red_flag_notes: r.red_flags.map((f) => f.note ?? "").join(" | "),
    preneed_funding: r.preneed?.funding ?? "",
    preneed_price_guaranteed: r.preneed?.price_guaranteed ?? "",
    preneed_transferable: r.preneed?.transferable ?? "",
    preneed_refund_pct: r.preneed?.cancellation_refund_pct ?? "",
    preneed_finance_charges: r.preneed?.finance_charges ?? "",
    preneed_state: r.preneed?.state ?? "",
    advice: r.advice,
  }));
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Quote everything that needs it; neutralize spreadsheet formulas.
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
