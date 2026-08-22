CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "admin_contact_text" text NOT NULL DEFAULT '',
  "admin_contact_image_path" text NOT NULL DEFAULT '',
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "site_settings_single_row" CHECK ("id" = 1)
);

INSERT INTO "site_settings" ("id") VALUES (1)
ON CONFLICT ("id") DO NOTHING;
