CREATE TABLE "styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_key" text NOT NULL,
	"label" text NOT NULL,
	"prefix" text NOT NULL,
	"colors" text DEFAULT '[]' NOT NULL,
	"textures" text DEFAULT '[]' NOT NULL,
	"published" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "styles_style_key_unique" UNIQUE("style_key")
);
