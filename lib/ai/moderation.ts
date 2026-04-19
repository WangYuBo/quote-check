// spec-coding §8.4 · notes #1
// 审核拒绝（REJECTED_BY_MODERATION）识别——独立于"LLM 调用失败"
// 两类签名：
//   A. HTTP 非 2xx + body/error 含 content_filter / content_policy 标记
//   B. HTTP 2xx 但 choices[].message.content 是典型拒答模板
//
// 新增国产模型新拒答模板时，先加 fixture 再改此函数（spec-qa §7.3 TDD 硬约束）

const REJECTION_MARKERS = [
  '无法回答',
  '不便回应',
  '内容政策',
  '敏感话题',
  '抱歉',
  '很抱歉',
  '不能回答',
  '不宜回答',
  'content_filter',
  'content_policy',
  'safety',
  'redacted',
] as const;

interface RejectionProbe {
  readonly body?: unknown;
  readonly status?: number;
  readonly message?: string;
}

export function isModerationRejection(err: unknown): boolean {
  if (!err) return false;

  // Error 对象：message + stack 里找标记
  if (err instanceof Error) {
    return containsMarker(`${err.message}\n${err.stack ?? ''}`);
  }

  // Response-like 对象：{ body, status }
  if (typeof err === 'object') {
    const probe = err as RejectionProbe;

    // 签名 A：4xx 或明确 error code
    if (typeof probe.status === 'number' && probe.status >= 400) {
      if (containsMarker(safeSerialize(probe.body))) return true;
    }

    // 签名 B：2xx 但 content 是拒答
    const content = extractChoiceContent(probe.body);
    if (content && containsMarker(content)) return true;

    // 签名 C：对象整体序列化后含标记（兜底）
    if (containsMarker(safeSerialize(err))) return true;
  }

  return containsMarker(String(err));
}

function extractChoiceContent(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== 'object') return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : null;
}

function containsMarker(s: string): boolean {
  const lower = s.toLowerCase();
  return REJECTION_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

function safeSerialize(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v ?? '');
  } catch {
    return String(v ?? '');
  }
}
