-- The family's review page is rendered from structured data (escaped by React),
-- not stored HTML. Both it and result_token are wiped 30 days after sending.
ALTER TABLE submissions DROP COLUMN result_html;
ALTER TABLE submissions ADD COLUMN result jsonb;

-- Delivery outcome, so a failed email/text can be retried from the Sent tab.
ALTER TABLE submissions ADD COLUMN delivered_at timestamptz;
ALTER TABLE submissions ADD COLUMN delivery_error text;   -- short reason only, never message contents

CREATE INDEX submissions_result_expiry_idx ON submissions (sent_at) WHERE result_token IS NOT NULL;
