ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_code" text;
--> statement-breakpoint
UPDATE "users"
SET "invite_code" = replace(gen_random_uuid()::text, '-', '')
WHERE "role" = 'user' AND ("invite_code" IS NULL OR "invite_code" = '');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_code_unique" ON "users" USING btree ("invite_code");
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "invitation_enabled" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "invitation_reward" integer DEFAULT 200 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "site_settings"
    ADD CONSTRAINT "site_settings_invitation_reward_non_negative"
    CHECK ("site_settings"."invitation_reward" >= 0);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inviter_id" uuid,
  "invitee_id" uuid,
  "inviter_username" text NOT NULL,
  "invitee_username" text NOT NULL,
  "reward_amount" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "user_invitations_reward_non_negative"
    CHECK ("user_invitations"."reward_amount" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_invitations"
    ADD CONSTRAINT "user_invitations_inviter_id_users_id_fk"
    FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_invitations"
    ADD CONSTRAINT "user_invitations_invitee_id_users_id_fk"
    FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_invitations_invitee_unique"
  ON "user_invitations" USING btree ("invitee_id");
