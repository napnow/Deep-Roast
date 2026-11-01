ALTER TABLE "llm_config"
  ADD COLUMN IF NOT EXISTS "polish_prompt_model" text NOT NULL DEFAULT '';
