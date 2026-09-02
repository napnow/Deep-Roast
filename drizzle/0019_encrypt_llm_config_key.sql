ALTER TABLE "llm_config"
  ADD COLUMN IF NOT EXISTS "ark_api_key_ciphertext" text;
ALTER TABLE "llm_config"
  ADD COLUMN IF NOT EXISTS "ark_api_key_iv" text;
ALTER TABLE "llm_config"
  ADD COLUMN IF NOT EXISTS "ark_api_key_auth_tag" text;
