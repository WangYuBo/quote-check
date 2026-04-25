import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getReport } from '@/lib/services/task';
import { headers } from 'next/headers';

interface ReferenceHit {
  referenceId: string;
  canonicalName: string;
  versionLabel: string | null;
  hit: boolean;
  snippet: string | null;
  similarity: string | null;
}

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
  referenceHits: ReferenceHit[];
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
  if (status === 'NOT_FOUND_IN_REF') return 'text-gray-900';
  return 'text-(--color-verdict-notmatch)';
}

function confidenceBg(confidence: number): string {
  if (confidence < 0.6) return 'border-yellow-300 bg-yellow-50/50';
  return 'border-(--color-border) bg-(--color-card)';
}

function VerifyCard({ result }: { result: VerifyResult }) {
  const conf = Number(result.confidence);
  const confPct = (conf * 100).toFixed(0);
  const lowConf = conf < 0.6;

  return (
    <div className={`rounded-xl border p-5 space-y-4 shadow-sm ${confidenceBg(conf)}`}>
      {/* 引文头部 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <p className="text-base font-medium text-(--color-fg) leading-relaxed font-[family-name:var(--font-serif)]">「{result.quoteText}」</p>
          {result.sourceWorkHint && (
            <p className="text-xs text-(--color-fg-muted)">出自 {result.sourceWorkHint}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs font-medium ${matchColor(result.matchStatus)}`}>
            {MATCH_LABEL[result.matchStatus] ?? result.matchStatus}
          </span>
          <span className={`text-[11px] ${lowConf ? 'text-yellow-700' : 'text-(--color-fg-muted)'}`}>
            置信度 {confPct}%
          </span>
        </div>
      </div>

      {/* 三维度 */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* 参考文献命中 */}
      {result.referenceHits.length > 0 && (
        <div className="space-y-2 border-t border-(--color-border) pt-4">
          <p className="text-xs text-(--color-fg-muted) font-medium">参考文献命中</p>
          {result.referenceHits.map((h) => (
            <div key={h.referenceId} className="rounded-lg bg-(--color-bg) border border-(--color-border) p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-medium text-(--color-fg)">
                  {h.canonicalName}
                  {h.versionLabel ? `（${h.versionLabel}）` : ''}
                </span>
                {h.similarity && (
                  <span className="text-(--color-fg-muted)">
                    相似度 {(Number(h.similarity) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {h.snippet && (
                <p className="text-(--color-fg-muted) leading-relaxed">
                  {h.snippet}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
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
    <div className="rounded-lg border border-(--color-border) bg-(--color-card) p-3 space-y-1.5">
      <p className="text-xs text-(--color-fg-muted)">{label}</p>
      <p
        className={`text-sm font-semibold ${
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
        <p className="text-xs text-(--color-fg-muted) leading-relaxed">{explanation}</p>
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
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-(--color-fg-muted)">{report.task.displayId}</p>
            <h1 className="text-2xl font-semibold text-(--color-fg)">引用核查报告</h1>
            <p className="text-sm text-(--color-fg-muted)">
              共 {results.length} 条引文 · 机器初审，终审权归编辑
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/${taskId}/export?format=csv`}
              download
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-card) px-3 py-2 text-sm text-(--color-fg-muted) hover:bg-(--color-bg) hover:text-(--color-fg) transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              CSV
            </a>
            <a
              href={`/api/reports/${taskId}/export-docx`}
              download
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-card) px-3 py-2 text-sm text-(--color-fg-muted) hover:bg-(--color-bg) hover:text-(--color-fg) transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Word
            </a>
          </div>
        </div>

        {/* 统计条 */}
        {results.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {(
              [
                ['符合参考', results.filter((r) => r.matchStatus === 'MATCH').length, 'text-(--color-verdict-match)'],
                ['部分符合', results.filter((r) => r.matchStatus === 'PARTIAL_MATCH').length, 'text-(--color-verdict-variant)'],
                ['不符合', results.filter((r) => r.matchStatus === 'NOT_MATCH').length, 'text-(--color-verdict-notmatch)'],
                ['未找到', results.filter((r) => r.matchStatus === 'NOT_FOUND_IN_REF').length, 'text-(--color-fg)'],
              ] as [string, number, string][]
            ).map(([label, count, color]) => (
              <div
                key={label}
                className="rounded-xl border border-(--color-border) bg-(--color-card) p-4 text-center space-y-1 shadow-sm"
              >
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-(--color-fg-muted)">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* 引文卡片列表 */}
        {results.length === 0 ? (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-12 text-center shadow-sm">
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
