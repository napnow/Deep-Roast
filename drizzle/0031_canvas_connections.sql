ALTER TABLE "image_canvas_layouts" ADD COLUMN "connections" jsonb DEFAULT '[]'::jsonb NOT NULL;
