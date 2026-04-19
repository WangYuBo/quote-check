CREATE TYPE "public"."match_status_enum" AS ENUM('MATCH', 'PARTIAL_MATCH', 'NOT_MATCH', 'NOT_FOUND_IN_REF');--> statement-breakpoint
CREATE TYPE "public"."quote_kind_enum" AS ENUM('DIRECT', 'INDIRECT', 'NOTED');--> statement-breakpoint
CREATE TYPE "public"."reference_role_enum" AS ENUM('CANON', 'ANNOTATED', 'TRANSLATED', 'TOOL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."user_role_enum" AS ENUM('B', 'C', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"op" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" uuid,
	"metadata_json" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manuscript" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_id" varchar(32) NOT NULL,
	"filename" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size" bigint NOT NULL,
	"char_count" integer,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"parsed_at" timestamp with time zone,
	"parse_error" text,
	"destroyed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "paragraph" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"display_id" varchar(48) NOT NULL,
	"text" text NOT NULL,
	"text_hash" varchar(64) NOT NULL,
	"text_normalized" text,
	"chapter" varchar(200),
	"has_quote" boolean DEFAULT false NOT NULL,
	"has_footnote" boolean DEFAULT false NOT NULL,
	"destroyed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_version" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"version_tag" varchar(16) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"byte_size" integer NOT NULL,
	"note" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paragraph_id" uuid NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"display_id" varchar(48) NOT NULL,
	"quote_text" text NOT NULL,
	"quote_normalized" text,
	"kind" "quote_kind_enum" NOT NULL,
	"source_work_hint" varchar(200),
	"canonical_name" varchar(200),
	"location_hint" text,
	"context_window" text,
	"destroyed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_id" varchar(64) NOT NULL,
	"canonical_name" varchar(200) NOT NULL,
	"version_label" varchar(200),
	"role" "reference_role_enum" NOT NULL,
	"filename" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size" bigint NOT NULL,
	"char_count" integer,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"copyright_declared_by" uuid,
	"copyright_declared_at" timestamp with time zone,
	"parsed_at" timestamp with time zone,
	"parse_error" text,
	"content_hash" varchar(64) NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"version_stamp_json" jsonb NOT NULL,
	"results_aggregate" jsonb NOT NULL,
	"frozen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "result_reference_hit" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" uuid NOT NULL,
	"reference_id" uuid NOT NULL,
	"hit" boolean NOT NULL,
	"snippet" text,
	"location_json" jsonb,
	"similarity" numeric(4, 3),
	"retrieval_method" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"display_id" varchar(32) NOT NULL,
	"reference_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING_PARSE' NOT NULL,
	"cost_estimated_cents" integer,
	"cost_actual_cents" integer,
	"cost_ceiling_cents" integer,
	"cost_confirmed_at" timestamp with time zone,
	"cost_confirmed_by" uuid,
	"total_quotes" integer,
	"verified_quotes" integer DEFAULT 0 NOT NULL,
	"failed_quotes" integer DEFAULT 0 NOT NULL,
	"version_stamp" jsonb,
	"version_stamp_frozen_at" timestamp with time zone,
	"moderation_rejected_at" timestamp with time zone,
	"moderation_reason" text,
	"ttl_expires_at" timestamp with time zone NOT NULL,
	"destroyed_at" timestamp with time zone,
	"inngest_run_id" varchar(128),
	"paused_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(100),
	"image" text,
	"role" "user_role_enum" DEFAULT 'C' NOT NULL,
	"agreement_version" varchar(32),
	"agreement_accepted_at" timestamp with time zone,
	"organization" varchar(200),
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_agreement_acceptance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agreement_version" varchar(32) NOT NULL,
	"agreement_role" "user_role_enum" NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"checksum" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"match_status" "match_status_enum" NOT NULL,
	"verdict_text_accuracy" jsonb NOT NULL,
	"verdict_interpretation" jsonb NOT NULL,
	"verdict_context" jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"confidence_breakdown" jsonb NOT NULL,
	"moderation_status" varchar(32) DEFAULT 'OK' NOT NULL,
	"moderation_detail" jsonb,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"raw_response_snapshot" jsonb,
	"raw_response_destroyed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "manuscript" ADD CONSTRAINT "manuscript_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "paragraph" ADD CONSTRAINT "paragraph_manuscript_id_manuscript_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscript"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote" ADD CONSTRAINT "quote_paragraph_id_paragraph_id_fk" FOREIGN KEY ("paragraph_id") REFERENCES "public"."paragraph"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote" ADD CONSTRAINT "quote_manuscript_id_manuscript_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscript"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference" ADD CONSTRAINT "reference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reference" ADD CONSTRAINT "reference_copyright_declared_by_user_id_fk" FOREIGN KEY ("copyright_declared_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_snapshot" ADD CONSTRAINT "report_snapshot_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "result_reference_hit" ADD CONSTRAINT "result_reference_hit_result_id_verification_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."verification_result"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "result_reference_hit" ADD CONSTRAINT "result_reference_hit_reference_id_reference_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."reference"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task" ADD CONSTRAINT "task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task" ADD CONSTRAINT "task_manuscript_id_manuscript_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscript"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task" ADD CONSTRAINT "task_cost_confirmed_by_user_id_fk" FOREIGN KEY ("cost_confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_agreement_acceptance" ADD CONSTRAINT "user_agreement_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_result" ADD CONSTRAINT "verification_result_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_result" ADD CONSTRAINT "verification_result_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_user" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_account_provider_account" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_user_op" ON "audit_log" USING btree ("user_id","op","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_target" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manuscript_user" ON "manuscript" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_manuscript_display_id" ON "manuscript" USING btree ("display_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manuscript_destroyed" ON "manuscript" USING btree ("destroyed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_paragraph_manuscript_seq" ON "paragraph" USING btree ("manuscript_id","seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_paragraph_hash" ON "paragraph" USING btree ("text_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prompt_sha256" ON "prompt_version" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quote_paragraph" ON "quote" USING btree ("paragraph_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quote_manuscript_seq" ON "quote" USING btree ("manuscript_id","seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quote_canonical" ON "quote" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reference_user_canonical" ON "reference" USING btree ("user_id","canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_reference_display_id" ON "reference" USING btree ("display_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reference_content_hash" ON "reference" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_report_snapshot_task" ON "report_snapshot" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_snapshot_frozen" ON "report_snapshot" USING btree ("frozen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hit_result" ON "result_reference_hit" USING btree ("result_id","hit");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hit_reference" ON "result_reference_hit" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_hit_result_reference" ON "result_reference_hit" USING btree ("result_id","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_user" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_session_token" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_expires" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_user_status" ON "task" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_manuscript" ON "task" USING btree ("manuscript_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_ttl" ON "task" USING btree ("ttl_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_task_display_id" ON "task" USING btree ("display_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_agreement_user_version" ON "user_agreement_acceptance" USING btree ("user_id","agreement_version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agreement_user" ON "user_agreement_acceptance" USING btree ("user_id","accepted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_verification_expires" ON "verification" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_result_task" ON "verification_result" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_result_quote" ON "verification_result" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_result_task_status" ON "verification_result" USING btree ("task_id","match_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_result_idempotency" ON "verification_result" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_result_raw_destroyed" ON "verification_result" USING btree ("raw_response_destroyed_at");