/**
 * Inngest 事件契约（AppEventMap）
 *
 * - 键：事件名，统一 kebab + dot-namespace（'task/proofread.requested'）
 * - 值：{ data: PayloadT }（Inngest 约定）
 * - 未来添加 proofread-run / ttl-destroy / cost-guard 相关事件时在此注册；
 *   client.send() 会自动获得类型推导
 *
 * 当前仅 system/ping.requested 一条，作为 Inngest Cloud 握手验证
 */

// 使用 type 而非 interface：Inngest EventSchemas.fromRecord<T> 要求 T 满足
// { [key: string]: { data: unknown } } 的隐式索引签名约束；TS 中 interface
// 不自动满足（允许声明合并），type alias 才能直接通过校验。
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type AppEventMap = {
  /**
   * Inngest Cloud 握手冒烟
   */
  'system/ping.requested': {
    data: {
      source: 'dev' | 'prod';
      note?: string;
    };
  };

  /**
   * 校对主工作流触发事件（MS-L-05/06/07 · ADR-002）
   *
   * 触发链：
   *   POST /api/tasks（AWAITING_CONFIRM → VERIFYING）→ inngest.send('task/proofread.requested')
   *   → proofread-run 主函数接管（parse → extract → verify → map → confidence → freeze-report）
   *
   * payload 为什么不带 manuscriptId / quoteIds：
   *   - task 行是单一真相源，函数开头 step.run('load-task') 按 taskId 读全量上下文
   *   - 事件体尽量精简，避免冗余副本（Inngest 事件会被保留，信息越少越好）
   */
  'task/proofread.requested': {
    data: {
      taskId: string;
      /** 触发用户（用于 audit_log.user_id；system-guard 重启时也标记来源） */
      userId: string;
      /** 触发来源：user = 用户确认开跑；retry = cost-guard 恢复；admin = 后台重跑 */
      triggeredBy: 'user' | 'retry' | 'admin';
      /** 触发时间（ISO），用于事件排序审计；Inngest 也有 ts 字段但便于 DB 关联 */
      requestedAt: string;
    };
  };
};

export type AppEventName = keyof AppEventMap;
