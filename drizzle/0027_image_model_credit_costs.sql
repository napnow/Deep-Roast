CREATE TABLE IF NOT EXISTS "image_model_credit_costs" (
	"model_id" text PRIMARY KEY NOT NULL,
	"credits_per_image" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "image_model_credit_costs_credits_per_image_check" CHECK ("credits_per_image" >= 1)
);
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "image_model_credit_costs"
		ADD CONSTRAINT "image_model_credit_costs_credits_per_image_check"
		CHECK ("credits_per_image" >= 1);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
