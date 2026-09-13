ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cleanup_protected" boolean DEFAULT false NOT NULL;
