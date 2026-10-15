-- Random server-side salt for hashing IPs in rate_limits, generated inside the database
-- so no one ever has to copy a secret into an env var.
CREATE TABLE app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO app_settings (key, value) VALUES ('rate_limit_salt', encode(gen_random_bytes(32), 'base64'));
