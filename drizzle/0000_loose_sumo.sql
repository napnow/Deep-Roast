CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '新对话' NOT NULL,
	"model" text DEFAULT 'doubao-seed-2-0-pro-260215' NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "image_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"model" text DEFAULT 'doubao-seedream-4-5-251128' NOT NULL,
	"image_url" text NOT NULL,
	"user_id" uuid NOT NULL,
	"size" text DEFAULT '1024x1024' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "llm_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ark_api_key" text DEFAULT '' NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"text_model" text DEFAULT 'doubao-seed-2-0-pro-260215' NOT NULL,
	"image_model" text DEFAULT 'doubao-seedream-4-5-251128' NOT NULL,
	"image_system_prompt" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "llm_config_single_row" CHECK ("llm_config"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;