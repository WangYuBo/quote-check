import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getReport } from '@/lib/services/task';
import { headers } from 'next/headers';

interface VerifyResult {
  id: string;
  quoteId: string;
  quoteText: string;
  sourceWorkHint: string | null;
  matchStatus: 'MATCH' | 'PARTIAL_MATCH' | 'NOT_MATCH' | 'NOT_FOUND_IN_REF';
  verdictTextAccuracy: {
    verdict: string;
    explanation: string;
    suggestedCorrection?: string;
  };
  verdictInterpretation: {
    verdict: string;
    explanation: string;
  };
  verdictContext: {
    verdict: string;
    explanation: string;
  };
  confidence: string;
  confidenceBreakdown: {
    refHit: number;
    locationValid: number;
    crossModel: number;
    weights: { w1: number; w2: number; w3: number };
    algoVersion: string;
  };
}

const MATCH_LABEL: Record<string, string> = {
  MATCH: '符合参考',
  PARTIAL_MATCH: '部分符合',
  NOT_MATCH: '不符合参考',
  NOT_FOUND_IN_REF: '未在参考中找到',
};

const VERDICT_LABEL: Record<string, string> = {
  MATCH: '一致',
  VARIANT: '存在异文',
  MISMATCH: '不一致',
  NOT_FOUND_IN_REF: '未找到',
  CONSISTENT: '一致',
  PARTIAL: '部分一致',
  DIVERGENT: '有偏差',
  APPROPRIATE: '符合语境',
  AMBIGUOUS: '语境模糊',
  OUT_OF_CONTEXT: '超出语境',
  NOT_APPLICABLE: '—',
};

function matchColor(status: string): string {
  if (status === 'MATCH') return 'text-(--color-verdict-match)';
  if (status === 'PARTIAL_MATCH') return 'text-(--color-verdict-variant)';
  return 'text-(--color-verdict-notmatch)';
}

function confidenceBg(confidence: number): string {
  if (confidence < 0.6) return 'bg-yellow-50 border-yellow-300';
  return 'bg-white border-(--color-border)';
}

function VerifyCard({ result }: { result: VerifyResult }) {
  const conf = Number(result.confidence);
  const lowConf = conf < 0.6;

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${confidenceBg(conf)}`}>
      {/* 引文头部 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <p className="font-medium text-(--color-fg) leading-snug">「{result.quoteText}」</p>
          {result.sourceWorkHint && (
            <p className="text-xs text-(--color-fg-muted)">出自 {result.sourceWorkHint}</p>
          )}
        </div>
        <span className={`text-xs font-medium shrink-0 ${matchColor(result.matchStatus)}`}>
          {MATCH_LABEL[result.matchStatus] ?? result.matchStatus}
        </span>
      </div>

      {lowConf && (
        <p className="text-xs bg-yellow-100 text-yellow-800 rounded-lg px-3 py-1.5">
          置信度较低（{(conf * 100).toFixed(0)}%），建议人工优先复核
        </p>
      )}

      {/* 三维度 */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <DimCell
          label="字词准确性"
          verdict={result.verdictTextAccuracy.verdict}
          explanation={result.verdictTextAccuracy.explanation}
        />
        <DimCell
          label="解释一致性"
          verdict={result.verdictInterpretation.verdict}
          explanation={result.verdictInterpretation.explanation}
        />
        <DimCell
          label="上下文相符"
          verdict={result.verdictContext.verdict}
          explanation={result.verdictContext.explanation}
        />
      </div>
    </div>
  );
}

function DimCell({
  label,
  verdict,
  explanation,
}: {
  label: string;
  verdict: string;
  explanation: string;
}) {
  const label_ = VERDICT_LABEL[verdict] ?? verdict;
  const isGood = verdict === 'MATCH' || verdict === 'CONSISTENT' || verdict === 'APPROPRIATE';
  const isNA = verdict === 'NOT_APPLICABLE';

  return (
    <div className="rounded-lg border border-(--color-border) bg-white p-3 space-y-1.5">
      <p className="text-(--color-fg-muted)">{label}</p>
      <p
        className={`font-medium ${
          isNA
            ? 'text-(--color-fg-muted)'
            : isGood
              ? 'text-(--color-verdict-match)'
              : 'text-(--color-verdict-notmatch)'
        }`}
      >
        {label_}
      </p>
      {explanation && !isNA && (
        <p className="text-(--color-fg-muted) leading-relaxed line-clamp-3">{explanation}</p>
      )}
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    return (
      <main className="min-h-screen bg-(--color-bg) flex items-center justify-center p-8">
        <p className="text-(--color-fg-muted)">请先登录</p>
      </main>
    );
  }

  const report = await getReport(taskId);
  if (!report || report.task.userId !== session.user.id) notFound();

  const results = report.results as VerifyResult[];

  return (
    <main className="min-h-screen bg-(--color-bg)">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* 头部 */}
        <div className="space-y-1">
          <p className="text-xs text-(--color-fg-muted)">{report.task.displayId}</p>
          <h1 className="text-2xl font-semibold text-(--color-fg)">引用核查报告</h1>
          <p className="text-sm text-(--color-fg-muted)">
            共 {results.length} 条引文 · 机器初审，终审权归编辑
          </p>
        </div>

        {/* 统计条 */}
        {results.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {(
              [
                ['符合参考', results.filter((r) => r.matchStatus === 'MATCH').length],
                ['部分符合', results.filter((r) => r.matchStatus === 'PARTIAL_MATCH').length],
                ['不符合', results.filter((r) => r.matchStatus === 'NOT_MATCH').length],
                ['未找到', results.filter((r) => r.matchStatus === 'NOT_FOUND_IN_REF').length],
              ] as [string, number][]
            ).map(([label, count]) => (
              <div
                key={label}
                className="rounded-xl border border-(--color-border) bg-white p-4 text-center space-y-1"
              >
                <p className="text-2xl font-bold text-(--color-fg)">{count}</p>
                <p className="text-xs text-(--color-fg-muted)">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* 引文卡片列表 */}
        {results.length === 0 ? (
          <div className="rounded-xl border border-(--color-border) bg-white p-10 text-center">
            <p className="text-(--color-fg-muted)">未找到引文</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((r) => (
              <VerifyCard key={r.id} result={r} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
