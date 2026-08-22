ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_iv" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_auth_tag" text;--> statement-breakpoint
-- Repair an earlier schema drift: production already has this column, while clean installs still need it.
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "image_generation_enabled" integer DEFAULT 1 NOT NULL;
