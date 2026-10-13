ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
UPDATE "users"
SET "last_login_at" = "updated_at"
WHERE "last_login_at" IS NULL;
