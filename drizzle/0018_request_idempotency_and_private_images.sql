CREATE TABLE IF NOT EXISTS "request_idempotency" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "status" text DEFAULT 'processing' NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "expires_at" timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "request_idempotency_user_scope_key"
  ON "request_idempotency" ("user_id", "scope", "key");
CREATE INDEX IF NOT EXISTS "request_idempotency_expires_at_idx"
  ON "request_idempotency" ("expires_at");
ALTER TABLE "image_generations"
  ADD COLUMN IF NOT EXISTS "storage_key" text;
ALTER TABLE "image_generations"
  ADD COLUMN IF NOT EXISTS "thumb_storage_key" text;
CREATE UNIQUE INDEX IF NOT EXISTS "image_generations_storage_key_unique"
  ON "image_generations" ("storage_key");
