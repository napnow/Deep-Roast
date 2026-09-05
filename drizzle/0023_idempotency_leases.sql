ALTER TABLE "request_idempotency"
	ADD COLUMN IF NOT EXISTS "lease_token" uuid;
--> statement-breakpoint
UPDATE "request_idempotency"
SET "status" = 'failed',
	"response_status" = 409,
	"response_body" = '{"error":"请求在版本升级期间中断，请使用新的请求 ID 重试","code":"IDEMPOTENCY_UPGRADE_INTERRUPTED"}'::jsonb,
	"updated_at" = now(),
	"expires_at" = now() + interval '24 hours'
WHERE "status" = 'processing';
--> statement-breakpoint
UPDATE "request_idempotency"
SET "lease_token" = gen_random_uuid()
WHERE "lease_token" IS NULL;
--> statement-breakpoint
ALTER TABLE "request_idempotency"
	ALTER COLUMN "lease_token" SET DEFAULT gen_random_uuid(),
	ALTER COLUMN "lease_token" SET NOT NULL;
