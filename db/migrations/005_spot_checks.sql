-- Second-reviewer spot check on ~10% of sent reviews (training zone, no PII).
-- The contract is already deleted, so the check judges the saved record: sensible
-- categories, consistent flags, advice quality, no personal details.
ALTER TABLE contract_reviews ADD COLUMN spot_check boolean NOT NULL DEFAULT false;

CREATE TABLE spot_checks (
  review_id    uuid PRIMARY KEY REFERENCES contract_reviews(id) ON DELETE CASCADE,
  checker_code text NOT NULL,
  verdict      text NOT NULL CHECK (verdict IN ('ok', 'minor', 'major')),
  notes        text,
  checked_on   date NOT NULL DEFAULT current_date
);
