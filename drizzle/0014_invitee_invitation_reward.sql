ALTER TABLE "site_settings" ADD COLUMN "invitation_invitee_reward" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD COLUMN "invitee_reward_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_invitation_invitee_reward_non_negative" CHECK ("site_settings"."invitation_invitee_reward" >= 0);