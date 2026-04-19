import { describe, it, expect, beforeEach } from 'vitest';
import { loadPromptRaw, clearPromptCache, PROMPT_VERSION } from '@/lib/ai/prompts';
import type { PromptKey } from '@/lib/ai/prompts';

/**
 * spec-qa §7.1 · spec-coding §10.3 · real.md #7 · MAS-2
 * Prompt 合规红线（CI 阻断）
 */

const PROMPT_KEYS: readonly PromptKey[] = ['extract', 'verify', 'map'];

const FORBIDDEN_WORDS = ['错误', '有误', '错引', '误引', '判错'] as const;
const FORBIDDEN_MARKETING = ['自动校对', '取代人工', '解放编辑', 'AI 校对机器人'] as const;

beforeEach(() => {
  clearPromptCache();
});

describe('Prompt 合规 · 文件存在与版本锁定', () => {
  it.each(PROMPT_KEYS)('prompts/%s/%s.txt 可加载', (key) => {
    const record = loadPromptRaw(key);
    expect(record.text.length).toBeGreaterThan(0);
    expect(record.version).toBe(PROMPT_VERSION);
    expect(record.key).toBe(key);
  });

  it('SHA256 为 64 位十六进制', () => {
    for (const key of PROMPT_KEYS) {
      const { sha256 } = loadPromptRaw(key);
      expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('缓存命中：二次调用返回同一对象', () => {
    const a = loadPromptRaw('verify');
    const b = loadPromptRaw('verify');
    expect(a).toBe(b);
  });
});

describe('Prompt 合规 · 判决词禁入（侵占编辑终审权）', () => {
  it.each(PROMPT_KEYS)('%s.txt 不含"错误/有误/错引/误引/判错"', (key) => {
    const { text } = loadPromptRaw(key);
    for (const word of FORBIDDEN_WORDS) {
      expect(
        text.includes(word),
        `${key}.txt 命中禁忌判决词 "${word}"——系统不判错，只报符合/不符合（real.md #1）`,
      ).toBe(false);
    }
  });
});

describe('Prompt 合规 · 营销话术禁入（notes #5）', () => {
  it.each(PROMPT_KEYS)('%s.txt 不含营销替代话术', (key) => {
    const { text } = loadPromptRaw(key);
    for (const phrase of FORBIDDEN_MARKETING) {
      expect(
        text.includes(phrase),
        `${key}.txt 命中营销话术 "${phrase}"——系统是辅助，不替代编辑`,
      ).toBe(false);
    }
  });
});

describe('Prompt 合规 · 结构约束（verify.txt 特化）', () => {
  it('verify.txt 声明中立角色（不是"校对专家"/不做"差错判定"）', () => {
    const { text } = loadPromptRaw('verify');
    // 中性角色声明的正面特征：含"核查"或"比对"
    expect(text).toMatch(/核查|比对/);
    // 必含终审权归属声明
    expect(text).toContain('编辑');
  });

  it('verify.txt 含三维度字段名（match_status）', () => {
    const { text } = loadPromptRaw('verify');
    expect(text).toContain('match_status');
    expect(text).toContain('text_accuracy');
    expect(text).toContain('interpretation_accuracy');
    expect(text).toContain('context_appropriateness');
  });

  it('verify.txt 不含自评字段 confidence/score（real.md #2）', () => {
    const { text } = loadPromptRaw('verify');
    // 允许出现在"禁止"说明中；本测试只扫 JSON schema 字段定义区
    // 更严格的模式：抽 ```json ... ``` 块后再扫
    const jsonBlocks = text.match(/```json[\s\S]*?```/g) ?? [];
    for (const block of jsonBlocks) {
      // JSON 字段形如 "confidence": ... 或 "score": ...
      expect(block).not.toMatch(/"confidence"\s*:/);
      expect(block).not.toMatch(/"score"\s*:/);
    }
  });
});
