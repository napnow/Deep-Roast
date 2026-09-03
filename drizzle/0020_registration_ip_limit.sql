ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "registration_ip_limit_enabled" integer NOT NULL DEFAULT 1;
