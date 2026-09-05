ALTER TABLE "llm_config"
	ADD COLUMN IF NOT EXISTS "assistant_image_prompt" text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_channels" (
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
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "llm_channels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "llm_channels"
	ADD COLUMN IF NOT EXISTS "api_key_ciphertext" text;
--> statement-breakpoint
ALTER TABLE "llm_channels"
	ADD COLUMN IF NOT EXISTS "api_key_iv" text;
--> statement-breakpoint
ALTER TABLE "llm_channels"
	ADD COLUMN IF NOT EXISTS "api_key_auth_tag" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_channel_models" (
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
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "llm_channel_models"
		ADD CONSTRAINT "llm_channel_models_channel_id_llm_channels_id_fk"
		FOREIGN KEY ("channel_id") REFERENCES "public"."llm_channels"("id")
		ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "llm_channel_models_channel_kind_model_unique"
	ON "llm_channel_models" ("channel_id", "kind", "model_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "llm_channel_models_default_kind_model_unique"
	ON "llm_channel_models" ("kind", "model_id")
	WHERE "is_default" = 1;
--> statement-breakpoint
DO $$
DECLARE
	legacy_channel_id uuid;
BEGIN
	-- Existing channel rows are production data and remain authoritative.
	-- Copy an existing encrypted credential without decrypting it in SQL.
	IF NOT EXISTS (SELECT 1 FROM "llm_channels") THEN
		INSERT INTO "llm_channels" (
			"name", "base_url", "api_key", "api_key_ciphertext",
			"api_key_iv", "api_key_auth_tag", "enabled", "sort_order"
		)
		SELECT 'Legacy default channel', "base_url", "ark_api_key",
			"ark_api_key_ciphertext", "ark_api_key_iv", "ark_api_key_auth_tag", 1, 0
		FROM "llm_config"
		WHERE "id" = 1
			AND btrim("base_url") <> ''
			AND (
				btrim("ark_api_key") <> '' OR
				("ark_api_key_ciphertext" IS NOT NULL AND "ark_api_key_iv" IS NOT NULL AND "ark_api_key_auth_tag" IS NOT NULL)
			)
		RETURNING "id" INTO legacy_channel_id;
	END IF;

	IF legacy_channel_id IS NOT NULL THEN
		BEGIN
			WITH cfg AS (
				SELECT "text_model", "image_model", "enabled_text_models", "enabled_image_models"
				FROM "llm_config"
				WHERE "id" = 1
			), model_candidates AS (
				SELECT value AS model_id, 'text' AS kind
				FROM cfg, jsonb_array_elements_text(
					COALESCE(NULLIF(cfg."enabled_text_models", ''), '[]')::jsonb
				) AS items(value)
				UNION ALL
				SELECT value AS model_id, 'image' AS kind
				FROM cfg, jsonb_array_elements_text(
					COALESCE(NULLIF(cfg."enabled_image_models", ''), '[]')::jsonb
				) AS items(value)
				UNION ALL
				SELECT cfg."text_model", 'text' FROM cfg WHERE cfg."text_model" <> ''
				UNION ALL
				SELECT cfg."image_model", 'image' FROM cfg WHERE cfg."image_model" <> ''
			), models AS (
				SELECT DISTINCT model_id, kind FROM model_candidates
			)
			INSERT INTO "llm_channel_models" (
				"channel_id", "model_id", "kind", "enabled", "is_default", "sort_order"
			)
			SELECT
				legacy_channel_id,
				models.model_id,
				models.kind,
				1,
				1,
				row_number() OVER (PARTITION BY models.kind ORDER BY models.model_id)
			FROM models
			WHERE models.model_id <> ''
			ON CONFLICT ("channel_id", "kind", "model_id") DO UPDATE SET
				"enabled" = 1,
				"is_default" = GREATEST("llm_channel_models"."is_default", EXCLUDED."is_default");
		EXCEPTION WHEN others THEN
			INSERT INTO "llm_channel_models" (
				"channel_id", "model_id", "kind", "enabled", "is_default", "sort_order"
			)
			SELECT legacy_channel_id, cfg."text_model", 'text', 1, 1, 0
			FROM "llm_config" cfg
			WHERE cfg."id" = 1 AND cfg."text_model" <> ''
			UNION ALL
			SELECT legacy_channel_id, cfg."image_model", 'image', 1, 1, 0
			FROM "llm_config" cfg
			WHERE cfg."id" = 1 AND cfg."image_model" <> ''
			ON CONFLICT ("channel_id", "kind", "model_id") DO UPDATE SET
				"enabled" = 1,
				"is_default" = 1;
		END;
	END IF;
END $$;
