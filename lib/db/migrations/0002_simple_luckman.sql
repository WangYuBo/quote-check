CREATE TABLE IF NOT EXISTS "reference_paragraph" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"display_id" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"text_normalized" text NOT NULL,
	"text_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference_paragraph" ADD CONSTRAINT "reference_paragraph_reference_id_reference_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."reference"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ref_para_reference_seq" ON "reference_paragraph" USING btree ("reference_id","seq");