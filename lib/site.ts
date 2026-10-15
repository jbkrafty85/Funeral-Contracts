// Public brand. Standalone by design: no name, logo, colors, phone or links tied to any other organization.
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Funeral Contract Review";

// Promised turnaround (BUILD_PLAN.md open decisions: default 1 business day).
export const TURNAROUND = "1 business day";

export const CONTRACT_TYPES = [
  {
    value: "funeral",
    label: "Funeral I'm arranging now",
    card: "Funeral (arranging now)",
    blurb: "Arranging a funeral now? Send us the statement before you sign.",
  },
  {
    value: "cemetery",
    label: "Cemetery",
    card: "Cemetery",
    blurb: "Buying a plot, crypt or niche? Cemetery charges add up fast.",
  },
  {
    value: "preneed",
    label: "Preneed (paying ahead)",
    card: "Preneed (paying ahead)",
    blurb: "Paying ahead for a funeral? Know what's guaranteed before you sign.",
  },
  { value: "not_sure", label: "Not sure", card: null, blurb: null },
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number]["value"];

// Upload limits (BUILD_PLAN.md Phase 1: max 10 files, 20 MB).
export const MAX_FILES = 10;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

// Times in the rep console are shown in the team's time zone, on the server and in the browser alike.
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "America/New_York";

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
