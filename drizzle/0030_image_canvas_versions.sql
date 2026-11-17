ALTER TABLE "image_generations" ADD COLUMN "source_image_id" uuid;
--> statement-breakpoint
ALTER TABLE "image_generations" ADD COLUMN "version_group_id" uuid;
--> statement-breakpoint
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_source_not_self" CHECK ("image_generations"."source_image_id" is null or "image_generations"."source_image_id" <> "image_generations"."id");
--> statement-breakpoint
CREATE INDEX "image_generations_user_version_group_idx" ON "image_generations" USING btree ("user_id",(coalesce("version_group_id", "id")),(coalesce("created_at", timestamp '1970-01-01 00:00:00')) desc,"id" desc);
--> statement-breakpoint
CREATE TABLE "image_canvas_layouts" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "hidden_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "viewport" jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "image_canvas_layouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
