import { z } from "zod";

// The structured review a rep fills in (and the AI assist pre-fills). Shared by the
// browser form, the save route and the Claude structured-output schema, so all three agree.
// Every field is required-but-nullable rather than optional: structured outputs need that.

export const PROVIDER_TYPES = ["funeral_home", "cemetery", "preneed_seller", "combo"] as const;
export const SERVICE_TYPES = [
  "traditional_burial",
  "graveside",
  "direct_burial",
  "traditional_cremation",
  "cremation_memorial",
  "direct_cremation",
  "not_applicable",
] as const;
export const LINE_CATEGORIES = [
  "professional_services",
  "embalming",
  "casket",
  "vault",
  "plot_crypt",
  "opening_closing",
  "marker_setting",
  "perpetual_care",
  "cash_advance",
  "preneed_admin_finance",
  "other",
] as const;
export const REVIEW_CONTRACT_TYPES = ["funeral", "cemetery", "preneed"] as const;

export const LABELS: Record<string, string> = {
  funeral_home: "Funeral home",
  cemetery: "Cemetery",
  preneed_seller: "Preneed seller",
  combo: "Funeral home + cemetery",
  traditional_burial: "Traditional burial",
  graveside: "Graveside service",
  direct_burial: "Direct burial",
  traditional_cremation: "Traditional cremation",
  cremation_memorial: "Cremation with memorial",
  direct_cremation: "Direct cremation",
  not_applicable: "Not applicable",
  professional_services: "Professional services",
  embalming: "Embalming / body prep",
  casket: "Casket / urn",
  vault: "Vault / liner",
  plot_crypt: "Plot, crypt or niche",
  opening_closing: "Opening and closing",
  marker_setting: "Marker and setting",
  perpetual_care: "Perpetual care",
  cash_advance: "Cash advance",
  preneed_admin_finance: "Preneed admin / finance",
  other: "Other",
  funeral: "Funeral (at-need)",
  preneed: "Preneed",
  trust: "Trust",
  insurance: "Insurance",
  installment: "Installment",
  unknown: "Unknown",
  yes: "Yes",
  partial: "Partial",
  no: "No",
};

export const LineItem = z.object({
  category: z.enum(LINE_CATEGORIES),
  description: z.string(),
  price: z.number().nullable(),
  flagged: z.boolean(),
  flag_reason: z.string().nullable(),
});

export const PreneedTerms = z.object({
  funding: z.enum(["trust", "insurance", "installment", "unknown"]),
  price_guaranteed: z.enum(["yes", "partial", "no", "unknown"]),
  transferable: z.boolean().nullable(),
  cancellation_refund_pct: z.number().nullable(),
  finance_charges: z.number().nullable(),
  state: z.string().nullable(),
});

export const ReviewDraft = z.object({
  provider: z.object({
    name: z.string(),
    type: z.enum(PROVIDER_TYPES),
    city: z.string().nullable(),
    state: z.string().nullable(), // 2-letter
  }),
  contract_month: z.string().nullable(), // YYYY-MM
  contract_type: z.enum(REVIEW_CONTRACT_TYPES),
  service_type: z.enum(SERVICE_TYPES),
  line_items: z.array(LineItem),
  contract_total: z.number().nullable(),
  est_savings: z.number().nullable(),
  red_flags: z.array(z.string()),
  ftc_issue: z.boolean(),
  preneed: PreneedTerms.nullable(),
  advice: z.string(),
});

export type ReviewDraft = z.infer<typeof ReviewDraft>;
export type LineItem = z.infer<typeof LineItem>;

export function emptyDraft(contractType: string): ReviewDraft {
  const type = (REVIEW_CONTRACT_TYPES as readonly string[]).includes(contractType)
    ? (contractType as ReviewDraft["contract_type"])
    : "funeral";
  return {
    provider: { name: "", type: type === "cemetery" ? "cemetery" : type === "preneed" ? "preneed_seller" : "funeral_home", city: null, state: null },
    contract_month: null,
    contract_type: type,
    service_type: type === "cemetery" ? "not_applicable" : "traditional_burial",
    line_items: [],
    contract_total: null,
    est_savings: null,
    red_flags: [],
    ftc_issue: false,
    preneed: type === "preneed" ? emptyPreneed() : null,
    advice: "",
  };
}

export function emptyPreneed(): z.infer<typeof PreneedTerms> {
  return { funding: "unknown", price_guaranteed: "unknown", transferable: null, cancellation_refund_pct: null, finance_charges: null, state: null };
}

// What must be true before a review can be sent (Phase 3 enforces this server-side too).
export function sendBlockers(d: ReviewDraft): string[] {
  const out: string[] = [];
  if (!d.provider.name.trim()) out.push("Add the seller's name.");
  if (!d.contract_month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.contract_month)) out.push("Add the contract month (YYYY-MM).");
  if (d.provider.state && !/^[A-Z]{2}$/.test(d.provider.state)) out.push("State must be a 2-letter code.");
  if (!d.line_items.length) out.push("Add at least one line item.");
  if (d.line_items.some((li) => !li.description.trim())) out.push("Every line item needs a description.");
  if (!d.advice.trim()) out.push("Write the advice to the family.");
  return out;
}

// Every free-text field that ends up in the training tables. All of it is PII-scanned before Send.
export function trainingText(d: ReviewDraft): string {
  return [d.advice, ...d.red_flags, ...d.line_items.flatMap((li) => [li.description, li.flag_reason ?? ""])].join("\n");
}

// What the family's review page shows. Stored on the submission (intake zone) for 30 days.
export type ReviewResult = {
  sent_at: string;
  seller: { name: string; city: string | null; state: string | null };
  contract_type: ReviewDraft["contract_type"];
  service_type: ReviewDraft["service_type"];
  line_items: LineItem[];
  contract_total: number | null;
  est_savings: number | null;
  red_flags: string[];
  advice: string;
};

export function toResult(d: ReviewDraft, sentAt: Date): ReviewResult {
  return {
    sent_at: sentAt.toISOString(),
    seller: { name: d.provider.name.trim(), city: d.provider.city, state: d.provider.state },
    contract_type: d.contract_type,
    service_type: d.service_type,
    line_items: d.line_items,
    contract_total: d.contract_total,
    est_savings: d.est_savings,
    red_flags: d.red_flags,
    advice: d.advice.trim(),
  };
}
