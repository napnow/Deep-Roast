CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"image_path" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_ciphertext" text,
	"key_iv" text,
	"key_auth_tag" text,
	"status" text DEFAULT 'active' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"credits_consumed" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);

CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '未命名卡片' NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '新对话' NOT NULL,
	"model" text DEFAULT 'doubao-seed-2-0-pro-260215' NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"plan_id" text,
	"note" text,
	"reservation_id" uuid,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "image_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"model" text DEFAULT 'gpt-image-2' NOT NULL,
	"image_url" text NOT NULL,
	"storage_key" text,
	"thumb_storage_key" text,
	"user_id" uuid NOT NULL,
	"size" text DEFAULT '1024x1024' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "image_model_credit_costs" (
	"model_id" text PRIMARY KEY NOT NULL,
	"credits_per_image" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "image_model_credit_costs_credits_per_image_check" CHECK ("image_model_credit_costs"."credits_per_image" >= 1)
);

CREATE TABLE "llm_channel_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "llm_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"api_key_ciphertext" text,
	"api_key_iv" text,
	"api_key_auth_tag" text,
	"enabled" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "llm_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ark_api_key" text DEFAULT '' NOT NULL,
	"ark_api_key_ciphertext" text,
	"ark_api_key_iv" text,
	"ark_api_key_auth_tag" text,
	"base_url" text DEFAULT '' NOT NULL,
	"text_model" text DEFAULT 'doubao-seed-2-0-pro-260215' NOT NULL,
	"image_model" text DEFAULT 'gpt-image-2' NOT NULL,
	"image_system_prompt" text DEFAULT '' NOT NULL,
	"assistant_image_prompt" text DEFAULT '' NOT NULL,
	"reverse_prompt_model" text DEFAULT '' NOT NULL,
	"enabled_text_models" text DEFAULT '["doubao-seed-2-0-pro-260215","doubao-seed-2-0-lite-260428","grok-4.20-fast"]' NOT NULL,
	"enabled_image_models" text DEFAULT '["gpt-image-2","gpt-image-2.5-flare","gpt-image-2.5-sunburst"]' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "llm_config_single_row" CHECK ("llm_config"."id" = 1)
);

CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "registration_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "registration_records_ip_unique" UNIQUE("ip")
);

CREATE TABLE "request_idempotency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"lease_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);

CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"admin_contact_text" text DEFAULT '' NOT NULL,
	"admin_contact_image_path" text DEFAULT '' NOT NULL,
	"registration_enabled" integer DEFAULT 1 NOT NULL,
	"signup_bonus_credits" integer DEFAULT 50 NOT NULL,
	"registration_ip_limit_enabled" integer DEFAULT 1 NOT NULL,
	"image_generation_enabled" integer DEFAULT 1 NOT NULL,
	"checkin_reward" integer DEFAULT 50 NOT NULL,
	"donation_enabled" integer DEFAULT 1 NOT NULL,
	"donation_image_path" text DEFAULT '' NOT NULL,
	"donation_text" text DEFAULT '' NOT NULL,
	"invitation_enabled" integer DEFAULT 1 NOT NULL,
	"invitation_reward" integer DEFAULT 200 NOT NULL,
	"invitation_invitee_reward" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "site_settings_single_row" CHECK ("site_settings"."id" = 1),
	CONSTRAINT "site_settings_signup_bonus_credits_non_negative" CHECK ("site_settings"."signup_bonus_credits" >= 0),
	CONSTRAINT "site_settings_invitation_reward_non_negative" CHECK ("site_settings"."invitation_reward" >= 0),
	CONSTRAINT "site_settings_invitation_invitee_reward_non_negative" CHECK ("site_settings"."invitation_invitee_reward" >= 0),
	CONSTRAINT "site_settings_checkin_reward_non_negative" CHECK ("site_settings"."checkin_reward" >= 0)
);

CREATE TABLE "styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_key" text NOT NULL,
	"label" text NOT NULL,
	"prefix" text NOT NULL,
	"colors" text DEFAULT '[]' NOT NULL,
	"textures" text DEFAULT '[]' NOT NULL,
	"published" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "styles_style_key_unique" UNIQUE("style_key")
);

CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid,
	"invitee_id" uuid,
	"inviter_username" text NOT NULL,
	"invitee_username" text NOT NULL,
	"reward_amount" integer DEFAULT 0 NOT NULL,
	"invitee_reward_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_invitations_reward_non_negative" CHECK ("user_invitations"."reward_amount" >= 0)
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"credits" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"cleanup_protected" boolean DEFAULT false NOT NULL,
	"invite_code" text,
	"legacy_invite_code" text,
	"last_checkin_on" text,
	"created_at" timestamp DEFAULT now(),
	"last_login_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_invite_code_unique" UNIQUE("invite_code")
);

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "llm_channel_models" ADD CONSTRAINT "llm_channel_models_channel_id_llm_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."llm_channels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "request_idempotency" ADD CONSTRAINT "request_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "api_keys_user_status_idx" ON "api_keys" USING btree ("user_id","status");
CREATE INDEX "conversations_user_updated_idx" ON "conversations" USING btree ("user_id","updated_at");
CREATE INDEX "credit_transactions_user_created_idx" ON "credit_transactions" USING btree ("user_id","created_at");
CREATE UNIQUE INDEX "credit_transactions_reservation_id_unique" ON "credit_transactions" USING btree ("reservation_id");
CREATE INDEX "image_generations_user_created_idx" ON "image_generations" USING btree ("user_id","created_at");
CREATE UNIQUE INDEX "llm_channel_models_channel_kind_model_unique" ON "llm_channel_models" USING btree ("channel_id","kind","model_id");
CREATE UNIQUE INDEX "llm_channel_models_default_kind_model_unique" ON "llm_channel_models" USING btree ("kind","model_id") WHERE "llm_channel_models"."is_default" = 1;
CREATE UNIQUE INDEX "llm_channels_name_unique" ON "llm_channels" USING btree ("name");
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");
CREATE UNIQUE INDEX "request_idempotency_user_scope_key" ON "request_idempotency" USING btree ("user_id","scope","key");
CREATE INDEX "request_idempotency_expires_at_idx" ON "request_idempotency" USING btree ("expires_at");
CREATE UNIQUE INDEX "user_invitations_invitee_unique" ON "user_invitations" USING btree ("invitee_id");
CREATE UNIQUE INDEX "users_legacy_invite_code_unique" ON "users" USING btree ("legacy_invite_code") WHERE "users"."legacy_invite_code" IS NOT NULL;
