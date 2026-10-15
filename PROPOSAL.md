# Funeral Contracts rebuild — structure and schema proposal

For approval before any Phase 1 code is written (per BUILD_PLAN.md kickoff).

## Next.js project structure (App Router, TypeScript)

```
funeral-contracts/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                  Homepage: headline, 3 contract-type cards, "Start a free review"
│   │   ├── submit/page.tsx           Intake form (files, contract type, email or mobile, consent)
│   │   ├── submit/thanks/page.tsx    "We'll send your review within 1 business day"
│   │   ├── privacy/page.tsx          Consent details v1, word for word (Phase 5)
│   │   └── r/[token]/page.tsx        Family's review page, expires 30 days (Phase 3)
│   ├── rep/                          Behind Microsoft 365 sign-in (Phase 2)
│   │   ├── page.tsx                  Queue: new / in review / sent, oldest first
│   │   ├── review/[id]/page.tsx      Contract viewer left, structured form right
│   │   └── admin/                    Export, stats, audit log (Phases 4–5)
│   └── api/
│       ├── upload/route.ts           Issues client-upload tokens for private Vercel Blob
│       ├── submissions/route.ts      Creates submission + file rows (bot check, rate limit)
│       ├── auth/[...nextauth]/route.ts
│       ├── rep/assist/route.ts       AI assist — reps only, server-side Claude call
│       ├── rep/send/route.ts         Writes training rows, delivers review, deletes blobs
│       └── cron/purge/route.ts       Daily: wipe contact info past purge_after
├── lib/
│   ├── db.ts                         Postgres client (Neon serverless driver)
│   ├── blob.ts                       Private blob put/get/delete
│   ├── pii.ts                        PII scan for advice text (names, phones, emails, SSN, DOB, policy #)
│   ├── consent.ts                    CONSENT_VERSION + text (single source for form and privacy page)
│   ├── notify.ts                     Resend email + SMS sender
│   └── ai/knowledge-base.ts          Prompt from old api/ask.js + new cemetery and preneed sections
├── db/migrations/001_init.sql
├── auth.ts                           Auth.js config, Entra ID, single-tenant
├── middleware.ts                     Guards /rep and /api/rep
├── vercel.json                       Cron schedule
└── BUILD_PLAN.md
```

Server-only rule: anything touching contact info, blobs or Claude lives in `lib/` with `import "server-only"`, so it can never ship to the browser.

## Database schema (Postgres)

```sql
-- ── Intake zone: holds PII, purged on schedule ──────────────────────
CREATE TYPE submission_status AS ENUM ('new','in_review','sent','purged');
CREATE TYPE contract_kind     AS ENUM ('funeral','cemetery','preneed','not_sure');

CREATE TABLE submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  status           submission_status NOT NULL DEFAULT 'new',
  contact_method   text CHECK (contact_method IN ('email','sms')),
  contact_value    text,                 -- NULLed by purge
  consent_version  text NOT NULL,
  consent_at       timestamptz NOT NULL,
  contract_type    contract_kind NOT NULL,
  claimed_by       uuid REFERENCES reps(id),
  sent_at          timestamptz,
  purge_after      timestamptz,          -- sent_at + 7 days
  result_token     text UNIQUE,          -- family's review link, NULLed at 30 days
  result_html      text                  -- rendered review for the link page, NULLed at 30 days
);

CREATE TABLE submission_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  blob_key       text NOT NULL,
  mime_type      text NOT NULL,
  bytes          int  NOT NULL,
  pages          int
);

-- ── Training zone: permanent, no PII, NO reference to submissions ───
CREATE TABLE providers (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name   text NOT NULL,
  type   text NOT NULL CHECK (type IN ('funeral_home','cemetery','preneed_seller','combo')),
  city   text,
  state  char(2),
  UNIQUE (name, city, state)
);

CREATE TABLE contract_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- fresh id, not the submission id
  provider_id      uuid REFERENCES providers(id),
  contract_month   char(7) NOT NULL,     -- 'YYYY-MM'
  contract_type    contract_kind NOT NULL,
  service_type     text,                 -- traditional_burial / graveside / direct_burial / traditional_cremation / cremation_memorial / direct_cremation / n/a
  contract_total   numeric(10,2),
  est_savings      numeric(10,2),
  reviewer_code    text NOT NULL,        -- e.g. R07, not a name
  pii_check_passed boolean NOT NULL,
  created_at       date NOT NULL DEFAULT current_date   -- date only, so it can't be timed against a submission
);

CREATE TABLE line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid NOT NULL REFERENCES contract_reviews(id) ON DELETE CASCADE,
  category     text NOT NULL,   -- professional_services / embalming / casket / vault / plot_crypt /
                                -- opening_closing / marker_setting / perpetual_care / cash_advance /
                                -- preneed_admin_finance / other
  description  text NOT NULL,
  price        numeric(10,2),
  flagged      boolean NOT NULL DEFAULT false,
  flag_reason  text
);

CREATE TABLE review_advice (
  review_id    uuid PRIMARY KEY REFERENCES contract_reviews(id) ON DELETE CASCADE,
  advice_text  text NOT NULL,
  red_flags    text[] NOT NULL DEFAULT '{}',
  ftc_issue    boolean NOT NULL DEFAULT false
);

CREATE TABLE preneed_terms (
  review_id               uuid PRIMARY KEY REFERENCES contract_reviews(id) ON DELETE CASCADE,
  funding                 text CHECK (funding IN ('trust','insurance','installment','unknown')),
  price_guaranteed        text CHECK (price_guaranteed IN ('yes','partial','no','unknown')),
  transferable            boolean,
  cancellation_refund_pct numeric(5,2),
  finance_charges         numeric(10,2),
  state                   char(2)
);

-- ── Rep side ────────────────────────────────────────────────────────
CREATE TABLE reps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  m365_email    text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  reviewer_code text UNIQUE NOT NULL,
  role          text NOT NULL DEFAULT 'rep' CHECK (role IN ('rep','admin'))
);

CREATE TABLE audit_log (
  id             bigserial PRIMARY KEY,
  rep_id         uuid REFERENCES reps(id),
  action         text NOT NULL,          -- claim / view_file / ai_assist / send / purge / export
  submission_id  uuid,                   -- no FK, survives purge; never contents
  at             timestamptz NOT NULL DEFAULT now()
);
```

Note: `reps` must be created before `submissions` in the real migration (FK order); it's grouped last here for reading.

## Two choices I made beyond the plan (flag if you disagree)

1. **`result_html` + `result_token` on submissions.** The plan's 30-day review link needs the review text stored somewhere the family can reach. It stays in the intake zone and is wiped at 30 days. The training copy lives separately in `review_advice`.
2. **`created_at` on `contract_reviews` is a date, not a timestamp.** With an exact timestamp you could match a training row to a submission's `sent_at` and re-identify it. Date only removes that link.

## Phase 0 status

- Done locally (not pushed): homepage replaced with a "coming soon" page, `/api/ask` deleted.
- Needs you: make the repo private, set a spend cap on the Anthropic key, and give me a way to push.
