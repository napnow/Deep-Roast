ALTER TABLE "llm_config" ADD COLUMN IF NOT EXISTS "reverse_prompt_model" text DEFAULT 'gemini-3.5-flash' NOT NULL;
