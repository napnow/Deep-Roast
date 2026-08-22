ALTER TABLE "site_settings" ADD COLUMN "donation_enabled" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "donation_image_path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "donation_text" text DEFAULT '' NOT NULL;