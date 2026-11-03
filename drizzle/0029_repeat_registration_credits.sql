CREATE TABLE IF NOT EXISTS "registration_risk_marks" (
	"ip_hash" text PRIMARY KEY NOT NULL,
	"cleanup_count" integer DEFAULT 1 NOT NULL,
	"last_cleaned_at" timestamp DEFAULT now() NOT NULL,
	"restricted_until" timestamp NOT NULL,
	"last_username" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_risk_marks_restricted_until_idx"
	ON "registration_risk_marks" USING btree ("restricted_until");
--> statement-breakpoint
ALTER TABLE "site_settings"
	ADD COLUMN IF NOT EXISTS "repeat_registration_limit_enabled" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_settings"
	ADD COLUMN IF NOT EXISTS "repeat_registration_window_days" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_settings"
	ADD COLUMN IF NOT EXISTS "repeat_registration_signup_bonus" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_settings"
	ADD COLUMN IF NOT EXISTS "repeat_registration_checkin_reward" integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_settings"
	ADD COLUMN IF NOT EXISTS "repeat_registration_invitation_reward" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users"
	ADD COLUMN IF NOT EXISTS "restricted_until" timestamp;
--> statement-breakpoint
ALTER TABLE "users"
	ADD COLUMN IF NOT EXISTS "registration_ip_hash" text;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'site_settings_repeat_registration_window_days_range'
			AND conrelid = 'site_settings'::regclass
	) THEN
		ALTER TABLE "site_settings"
			ADD CONSTRAINT "site_settings_repeat_registration_window_days_range"
			CHECK ("repeat_registration_window_days" BETWEEN 1 AND 365);
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'site_settings_repeat_registration_invitation_reward_non_negative'
			AND conrelid = 'site_settings'::regclass
	) THEN
		ALTER TABLE "site_settings"
			ADD CONSTRAINT "site_settings_repeat_registration_invitation_reward_non_negative"
			CHECK ("repeat_registration_invitation_reward" >= 0);
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'site_settings_repeat_registration_signup_bonus_non_negative'
			AND conrelid = 'site_settings'::regclass
	) THEN
		ALTER TABLE "site_settings"
			ADD CONSTRAINT "site_settings_repeat_registration_signup_bonus_non_negative"
			CHECK ("repeat_registration_signup_bonus" >= 0);
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'site_settings_repeat_registration_checkin_reward_non_negative'
			AND conrelid = 'site_settings'::regclass
	) THEN
		ALTER TABLE "site_settings"
			ADD CONSTRAINT "site_settings_repeat_registration_checkin_reward_non_negative"
			CHECK ("repeat_registration_checkin_reward" >= 0);
	END IF;
END $$;
