ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "signup_bonus_credits" integer DEFAULT 50 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_settings_signup_bonus_credits_non_negative'
      AND conrelid = 'site_settings'::regclass
  ) THEN
    ALTER TABLE "site_settings"
      ADD CONSTRAINT "site_settings_signup_bonus_credits_non_negative"
      CHECK ("signup_bonus_credits" >= 0);
  END IF;
END $$;
