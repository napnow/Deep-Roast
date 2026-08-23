CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_generations_user_created_idx" ON "image_generations" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_created_idx" ON "credit_transactions" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_status_idx" ON "api_keys" ("user_id", "status");
