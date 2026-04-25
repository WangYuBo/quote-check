CREATE TABLE IF NOT EXISTS "api_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"pricing_version" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cost_fen" integer NOT NULL,
	"phase" text NOT NULL,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "cost_estimated_fen" integer;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "cost_actual_fen" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_call" ADD CONSTRAINT "api_call_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_call" ADD CONSTRAINT "api_call_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_call_task" ON "api_call" USING btree ("task_id","called_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_call_user_month" ON "api_call" USING btree ("user_id","called_at");