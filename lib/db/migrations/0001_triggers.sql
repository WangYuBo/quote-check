-- 0001_triggers.sql
-- 版本戳只读 + 报告冻结 + append-only 审计 + task.status CHECK + GIN / trigram 索引
-- + result_reference_hit 监控视图与冷归档表（盲区 D5 改进）
--
-- 执行顺序：drizzle-kit 生成的 0000_init.sql → 本 0001_triggers.sql
-- spec-database-design §5 · real.md #7 · notes #6/#7 · ADR-006/011/012
--
-- 手写迁移说明：
--   Drizzle Kit 暂不原生支持触发器 / 视图 / CHECK 约束的 DDL 生成；
--   该文件由 drizzle-kit migrate 一并应用。所有语句必须幂等，可重复执行。

-- ═════════════════════════════════════════════════════
-- T-01: report_snapshot 冻结后不可 UPDATE/DELETE
--   real.md #7 · ADR-006 · notes #7
-- ═════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_frozen_report_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'report_snapshot is frozen at % and cannot be modified (real.md #7)',
      OLD.frozen_at
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL; -- DELETE：拒绝；UPDATE：被上面 RAISE 阻断
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_snapshot_freeze ON report_snapshot;
CREATE TRIGGER trg_report_snapshot_freeze
BEFORE UPDATE OR DELETE ON report_snapshot
FOR EACH ROW
EXECUTE FUNCTION prevent_frozen_report_mutation();

-- ═════════════════════════════════════════════════════
-- T-02: task.version_stamp 一旦冻结即只读
--   （version_stamp_frozen_at IS NOT NULL 之后不许改 version_stamp 字段）
-- ═════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_version_stamp_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version_stamp_frozen_at IS NOT NULL THEN
    IF OLD.version_stamp IS DISTINCT FROM NEW.version_stamp THEN
      RAISE EXCEPTION 'task.version_stamp is frozen at % and cannot be modified (real.md #7)',
        OLD.version_stamp_frozen_at
        USING ERRCODE = 'check_violation';
    END IF;
    -- frozen_at 自身一旦写入不可清回 NULL 或改写
    IF OLD.version_stamp_frozen_at IS DISTINCT FROM NEW.version_stamp_frozen_at THEN
      RAISE EXCEPTION 'task.version_stamp_frozen_at is one-way; cannot be cleared or changed'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_version_stamp_freeze ON task;
CREATE TRIGGER trg_task_version_stamp_freeze
BEFORE UPDATE ON task
FOR EACH ROW
EXECUTE FUNCTION prevent_version_stamp_mutation();

-- ═════════════════════════════════════════════════════
-- T-03: verification_result 核心字段写入后不可改
--   设计：重试以 idempotency_key 为维度新插；核心字段一旦写入即定稿
--   允许：raw_response_snapshot / raw_response_destroyed_at（TTL 销毁用）
-- ═════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_result_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.verdict_text_accuracy   IS DISTINCT FROM NEW.verdict_text_accuracy
     OR OLD.verdict_interpretation IS DISTINCT FROM NEW.verdict_interpretation
     OR OLD.verdict_context        IS DISTINCT FROM NEW.verdict_context
     OR OLD.confidence             IS DISTINCT FROM NEW.confidence
     OR OLD.match_status           IS DISTINCT FROM NEW.match_status
     OR OLD.idempotency_key        IS DISTINCT FROM NEW.idempotency_key
     OR OLD.task_id                IS DISTINCT FROM NEW.task_id
     OR OLD.quote_id               IS DISTINCT FROM NEW.quote_id THEN
    RAISE EXCEPTION 'verification_result core fields are immutable once written (notes #7)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verification_result_immutable ON verification_result;
CREATE TRIGGER trg_verification_result_immutable
BEFORE UPDATE ON verification_result
FOR EACH ROW
EXECUTE FUNCTION prevent_result_mutation();

-- ═════════════════════════════════════════════════════
-- T-04: audit_log append-only（notes #6）
--   一律拒绝 UPDATE / DELETE
-- ═════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (notes #6)'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
CREATE TRIGGER trg_audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

-- ═════════════════════════════════════════════════════
-- T-05: user_agreement_acceptance append-only（MS-L-11 / real.md #3）
--   复用 prevent_audit_log_mutation 函数
-- ═════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_agreement_append_only ON user_agreement_acceptance;
CREATE TRIGGER trg_agreement_append_only
BEFORE UPDATE OR DELETE ON user_agreement_acceptance
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

-- ═════════════════════════════════════════════════════
-- T-06: prompt_version 一旦登记即不可改（ADR-012 · real.md #7）
--   需要新版本时以新 key（如 'v2-extract'）插入新行
-- ═════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_prompt_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'prompt_version is immutable once registered; create a new version key instead (ADR-012)'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompt_version_immutable ON prompt_version;
CREATE TRIGGER trg_prompt_version_immutable
BEFORE UPDATE OR DELETE ON prompt_version
FOR EACH ROW
EXECUTE FUNCTION prevent_prompt_version_mutation();

-- ═════════════════════════════════════════════════════
-- I-01: task.reference_ids GIN 索引
--   drizzle-kit 对数组 GIN 无原生语法
-- ═════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_task_reference_ids_gin
  ON task USING GIN (reference_ids);

-- ═════════════════════════════════════════════════════
-- I-02: pg_trgm 扩展 + paragraph / quote trigram 索引
--   近似检索辅助（n-gram 匹配），中文分词不走 tsvector
-- ═════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_paragraph_text_trgm
  ON paragraph USING GIN (text_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_quote_normalized_trgm
  ON quote USING GIN (quote_normalized gin_trgm_ops);

-- ═════════════════════════════════════════════════════
-- C-03: task.status 值域 CHECK（替代 pgEnum，D-03a）
--   值域与 lib/db/schema.ts TASK_STATUS_VALUES 同源；
--   新状态加值三处同步：(a) 常量 (b) 本 CHECK (c) §8.2 Zod
-- ═════════════════════════════════════════════════════
ALTER TABLE task
  DROP CONSTRAINT IF EXISTS chk_task_status_allowed;

ALTER TABLE task
  ADD CONSTRAINT chk_task_status_allowed
  CHECK (status IN (
    'PENDING_PARSE',
    'PARSING',
    'PENDING_ESTIMATE',
    'AWAITING_CONFIRM',
    'VERIFYING',
    'PAUSED_COST',
    'REJECTED_BY_MODERATION',
    'COMPLETED',
    'FAILED',
    'CANCELED'
  ));

-- ═════════════════════════════════════════════════════
-- M-01: result_reference_hit 监控视图（盲区 D5 改进）
--   Inngest cron 每日 01:00 拉取；超阈值触发 Sentry 告警
-- ═════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_result_reference_hit_stats AS
SELECT
  (SELECT count(*) FROM result_reference_hit)                   AS total_rows,
  (SELECT count(*) FROM result_reference_hit WHERE hit = true)  AS hit_true_rows,
  (SELECT count(*) FROM result_reference_hit WHERE hit = false) AS hit_false_rows,
  (SELECT avg(cnt) FROM (
      SELECT count(*) AS cnt FROM result_reference_hit GROUP BY result_id
  ) t)                                                          AS avg_hits_per_result,
  (SELECT max(cnt) FROM (
      SELECT count(*) AS cnt FROM result_reference_hit GROUP BY result_id
  ) t)                                                          AS max_hits_per_result,
  pg_size_pretty(pg_total_relation_size('result_reference_hit')) AS total_size;

COMMENT ON VIEW v_result_reference_hit_stats IS
  'D5 监控：total_rows > 2_000_000 时触发归档迁移（见 M-02）';

-- ═════════════════════════════════════════════════════
-- M-02: result_reference_hit 冷归档表（盲区 D5 改进）
--   超阈值时把 90 天前已完成任务的 hit 迁入归档；应用层查历史 UNION ALL
-- ═════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS result_reference_hit_archive (
  id                bigint PRIMARY KEY,
  result_id         uuid        NOT NULL,
  reference_id      uuid        NOT NULL,
  hit               boolean     NOT NULL,
  snippet           text,
  location_json     jsonb,
  similarity        numeric(4,3),
  retrieval_method  varchar(32),
  created_at        timestamptz NOT NULL,
  archived_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hit_archive_result
  ON result_reference_hit_archive (result_id);

COMMENT ON TABLE result_reference_hit_archive IS
  'D5 冷归档：仅 >90 天且 task.completed_at 非 NULL 的 hit；应用层查历史 UNION 主表';
