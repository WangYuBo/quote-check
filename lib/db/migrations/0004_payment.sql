--> statement-breakpoint
-- 支付订单表
CREATE TABLE IF NOT EXISTS payment_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "user"(id),
  amount_fen integer NOT NULL,
  gateway varchar(32) NOT NULL DEFAULT 'xorpay',
  gateway_order_id varchar(128),
  gateway_qr_code text,
  payment_method varchar(16) NOT NULL DEFAULT 'wechat',
  status varchar(32) NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_payment_task ON payment_order(task_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_order(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_payment_gateway_order ON payment_order(gateway_order_id);
--> statement-breakpoint
-- task.status 增加 PENDING_PAYMENT
ALTER TABLE task DROP CONSTRAINT IF EXISTS chk_task_status_allowed;
--> statement-breakpoint
ALTER TABLE task ADD CONSTRAINT chk_task_status_allowed
  CHECK (status IN (
    'PENDING_PARSE',
    'PARSING',
    'PENDING_ESTIMATE',
    'AWAITING_CONFIRM',
    'PENDING_PAYMENT',
    'VERIFYING',
    'PAUSED_COST',
    'REJECTED_BY_MODERATION',
    'COMPLETED',
    'FAILED',
    'CANCELED'
  ));
