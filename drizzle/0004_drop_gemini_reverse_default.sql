-- 去掉写死的 gemini-3.5-flash：默认空，已存的旧默认一并清掉
ALTER TABLE "llm_config" ALTER COLUMN "reverse_prompt_model" SET DEFAULT '';
UPDATE "llm_config"
SET "reverse_prompt_model" = ''
WHERE "reverse_prompt_model" = 'gemini-3.5-flash';
