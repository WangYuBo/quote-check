import { describe, it, expect } from 'vitest';
import { isModerationRejection } from '@/lib/ai/moderation';

/**
 * spec-qa §7.3 · notes #1
 * 审核拒绝（REJECTED_BY_MODERATION）识别基线
 *
 * TDD 硬约束：新增国产模型的新拒答模板时，先加 fixture 再改检测逻辑
 */

interface ModerationFixture {
  readonly name: string;
  readonly payload: unknown;
  readonly expect: boolean;
}

const REJECTION_FIXTURES: readonly ModerationFixture[] = [
  {
    name: 'content_filter 400 错误',
    payload: { body: { error: 'content_filter' }, status: 400 },
    expect: true,
  },
  {
    name: '"很抱歉，我无法回答" 模板',
    payload: {
      body: {
        choices: [{ message: { content: '很抱歉，我无法回答这个问题' } }],
      },
      status: 200,
    },
    expect: true,
  },
  {
    name: '"涉及敏感内容，不便回应" 模板',
    payload: {
      body: {
        choices: [{ message: { content: '涉及敏感内容，我不便回应' } }],
      },
      status: 200,
    },
    expect: true,
  },
  {
    name: 'REDACTED content_policy 英文',
    payload: {
      body: {
        choices: [{ message: { content: 'REDACTED due to content policy' } }],
      },
      status: 200,
    },
    expect: true,
  },
  {
    name: '直接 Error 对象含 content_policy',
    payload: new Error('Request failed: content_policy violation detected'),
    expect: true,
  },
  {
    name: '字符串错误含 safety',
    payload: 'safety filter triggered',
    expect: true,
  },
  {
    name: '正常答复（负样本）— 孔子引文',
    payload: {
      body: {
        choices: [{ message: { content: '答：孔子说的这句话出自《论语》' } }],
      },
      status: 200,
    },
    expect: false,
  },
  {
    name: '正常答复（负样本）— JSON 对象输出',
    payload: {
      body: {
        choices: [{ message: { content: '{"match_status": "match"}' } }],
      },
      status: 200,
    },
    expect: false,
  },
  {
    name: '空输入',
    payload: null,
    expect: false,
  },
];

describe('isModerationRejection — 拒答识别 fixture 套件', () => {
  it.each(REJECTION_FIXTURES)('$name', ({ payload, expect: expected }) => {
    expect(isModerationRejection(payload)).toBe(expected);
  });
});

describe('isModerationRejection — 边界', () => {
  it('undefined 返回 false', () => {
    expect(isModerationRejection(undefined)).toBe(false);
  });

  it('数字返回 false', () => {
    expect(isModerationRejection(42)).toBe(false);
  });

  it('不拿 status 当单独信号判决（200 + 纯业务错误也不算拒答）', () => {
    expect(
      isModerationRejection({
        status: 200,
        body: { choices: [{ message: { content: '数据库超时' } }] },
      }),
    ).toBe(false);
  });
});
