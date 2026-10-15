-- 001_init — full schema from BUILD_PLAN.md "Data model".
-- Two zones: intake (PII, purged) and training (permanent, no PII, no link back).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE submission_status AS ENUM ('new', 'in_review', 'sent', 'purged');
CREATE TYPE contract_kind     AS ENUM ('funeral', 'cemetery', 'preneed', 'not_sure');

-- ── Rep side ─────────────────────────────────────────────────────────
CREATE TABLE reps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  m365_email    text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  reviewer_code text UNIQUE NOT NULL,             -- e.g. R07; the only rep identifier in training data
  role          text NOT NULL DEFAULT 'rep' CHECK (role IN ('rep', 'admin'))
);

-- ── Intake zone: holds PII, purged on schedule ───────────────────────
CREATE TABLE submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  status          submission_status NOT NULL DEFAULT 'new',
  contact_method  text NOT NULL CHECK (contact_method IN ('email', 'sms')),
  contact_value   text,                           -- NULLed by purge
  consent_version text NOT NULL,
  consent_at      timestamptz NOT NULL,
  contract_type   contract_kind NOT NULL,
  claimed_by      uuid REFERENCES reps(id),
  sent_at         timestamptz,
  purge_after     timestamptz,                    -- sent_at + 7 days
  result_token    text UNIQUE,                    -- family's review link; NULLed at 30 days
  result_html     text                            -- rendered review for that link; NULLed at 30 days
);
CREATE INDEX submissions_queue_idx ON submissions (status, created_at);
CREATE INDEX submissions_purge_idx ON submissions (purge_after) WHERE contact_value IS NOT NULL;

CREATE TABLE submission_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  blob_key      text NOT NULL UNIQUE,             -- private Vercel Blob pathname
  mime_type     text NOT NULL,
  bytes         int  NOT NULL,
  pages         int
);

-- Per-IP throttle for the public form. key is an HMAC of the IP, never the IP itself.
CREATE TABLE rate_limits (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- ── Training zone: permanent, no PII, NO reference to submissions ───
CREATE TABLE providers (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text NOT NULL,
  type  text NOT NULL CHECK (type IN ('funeral_home', 'cemetery', 'preneed_seller', 'combo')),
  city  text,
  state char(2),
  UNIQUE NULLS NOT DISTINCT (name, city, state)
);

CREATE TABLE contract_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- fresh id, never the submission id
  provider_id      uuid REFERENCES providers(id),
  contract_month   char(7) NOT NULL CHECK (contract_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  contract_type    contract_kind NOT NULL,
  service_type     text CHECK (service_type IN (
                     'traditional_burial', 'graveside', 'direct_burial',
                     'traditional_cremation', 'cremation_memorial', 'direct_cremation', 'not_applicable')),
  contract_total   numeric(10,2),
  est_savings      numeric(10,2),
  reviewer_code    text NOT NULL,
  pii_check_passed boolean NOT NULL,
  created_at       date NOT NULL DEFAULT current_date  -- date only, so it can't be matched to a sent_at
);

CREATE TABLE line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid NOT NULL REFERENCES contract_reviews(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN (
                'professional_services', 'embalming', 'casket', 'vault', 'plot_crypt',
                'opening_closing', 'marker_setting', 'perpetual_care', 'cash_advance',
                'preneed_admin_finance', 'other')),
  description text NOT NULL,
  price       numeric(10,2),
  flagged     boolean NOT NULL DEFAULT false,
  flag_reason text
);

CREATE TABLE review_advice (
  review_id   uuid PRIMARY KEY REFERENCES contract_reviews(id) ON DELETE CASCADE,
  advice_text text NOT NULL,
  red_flags   text[] NOT NULL DEFAULT '{}',
  ftc_issue   boolean NOT NULL DEFAULT false
);

CREATE TABLE preneed_terms (
  review_id               uuid PRIMARY KEY REFERENCES contract_reviews(id) ON DELETE CASCADE,
  funding                 text CHECK (funding IN ('trust', 'insurance', 'installment', 'unknown')),
  price_guaranteed        text CHECK (price_guaranteed IN ('yes', 'partial', 'no', 'unknown')),
  transferable            boolean,
  cancellation_refund_pct numeric(5,2),
  finance_charges         numeric(10,2),
  state                   char(2)
);

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  rep_id        uuid REFERENCES reps(id),
  action        text NOT NULL,                   -- submit / claim / view_file / ai_assist / send / purge / export
  submission_id uuid,                            -- no FK so it survives purge; never contents
  detail        text,                            -- counts only (e.g. "files=3"), never contract contents or contact info
  at            timestamptz NOT NULL DEFAULT now()
);
