-- Red flags become one row each with a fixed category (so trends can be counted) plus the
-- reviewer's short note. Existing free-text flags move over as category 'other'.
CREATE TABLE red_flags (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES contract_reviews(id) ON DELETE CASCADE,
  category  text NOT NULL CHECK (category IN (
              'price_above_typical', 'casket_or_urn_markup', 'unneeded_item', 'package_not_itemized',
              'cash_advance_markup', 'ftc_rights_issue', 'vault_or_liner_requirement', 'cemetery_fee_issue',
              'preneed_not_guaranteed', 'preneed_cancellation_refund', 'preneed_not_transferable',
              'preneed_funding_risk', 'finance_charges', 'missing_or_unclear_terms', 'sales_pressure_or_chain',
              'other')),
  note      text
);
CREATE INDEX red_flags_review_idx ON red_flags (review_id);
CREATE INDEX red_flags_category_idx ON red_flags (category);

INSERT INTO red_flags (review_id, category, note)
SELECT review_id, 'other', f FROM review_advice, unnest(red_flags) AS f WHERE trim(f) <> '';

ALTER TABLE review_advice DROP COLUMN red_flags;
