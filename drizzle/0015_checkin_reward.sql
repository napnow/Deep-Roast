ALTER TABLE "site_settings" ADD COLUMN "checkin_reward" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_checkin_reward_non_negative" CHECK ("site_settings"."checkin_reward" >= 0);
