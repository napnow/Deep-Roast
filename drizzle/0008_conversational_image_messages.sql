ALTER TABLE "messages" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "llm_config" ADD COLUMN "assistant_image_prompt" text DEFAULT '' NOT NULL;
