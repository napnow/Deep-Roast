BEGIN;

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "usage_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "credits_consumed" integer NOT NULL DEFAULT 0;

COMMIT;
