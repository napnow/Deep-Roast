ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "legacy_invite_code" text;
--> statement-breakpoint
UPDATE "users"
SET "legacy_invite_code" = "invite_code"
WHERE "role" = 'user'
  AND length("invite_code") > 8
  AND ("legacy_invite_code" IS NULL OR "legacy_invite_code" = '');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_legacy_invite_code_unique"
  ON "users" USING btree ("legacy_invite_code")
  WHERE "legacy_invite_code" IS NOT NULL;
--> statement-breakpoint
DO $$
DECLARE
  target_user record;
  short_code text;
BEGIN
  FOR target_user IN
    SELECT "id"
    FROM "users"
    WHERE "role" = 'user' AND length("invite_code") > 8
  LOOP
    LOOP
      short_code := substr(md5(gen_random_uuid()::text), 1, 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "users"
        WHERE "invite_code" = short_code
           OR "legacy_invite_code" = short_code
      );
    END LOOP;
    UPDATE "users"
    SET "invite_code" = short_code
    WHERE "id" = target_user."id";
  END LOOP;
END $$;
