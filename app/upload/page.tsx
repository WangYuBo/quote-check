'use client';

import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';

const ALLOWED_EXT = ['.txt', '.md', '.docx'];
const MAX_SIZE = 20 * 1024 * 1024;
const MAX_REFS = 10;

interface RefItem {
  file: File;
  canonicalName: string;
  role: 'CANON' | 'ANNOTATED' | 'TRANSLATED' | 'TOOL' | 'OTHER';
  referenceId: string | null;
  uploading: boolean;
  error: string | null;
}

type Step = 1 | 2 | 3;

function StepIndicator({ current, step }: { current: Step; step: Step }) {
  const isActive = current === step;
  const isDone = current > step;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          isDone
            ? 'bg-(--color-primary) text-(--color-primary-fg)'
            : isActive
              ? 'bg-(--color-primary) text-(--color-primary-fg) ring-2 ring-(--color-primary)/30'
              : 'bg-(--color-border) text-(--color-fg-muted)'
        }`}
      >
        {isDone ? <Check size={16} /> : step}
      </div>
      <span
        className={`text-sm hidden sm:inline ${
          isActive ? 'text-(--color-fg) font-medium' : 'text-(--color-fg-muted)'
        }`}
      >
        {step === 1 && '上传书稿'}
        {step === 2 && '参考文献'}
        {step === 3 && '开始核查'}
      </span>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  const manuscriptInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [refDragging, setRefDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'creating' | 'paying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<{
    filename: string;
    paragraphCount: number;
    charCount: number;
  } | null>(null);
  const [manuscriptId, setManuscriptId] = useState<string | null>(null);
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [copyrightDeclared, setCopyrightDeclared] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // 支付相关状态
  const [payStep, setPayStep] = useState<'idle' | 'waiting' | 'paid' | 'expired'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  useEffect(() => {
    authClient
      .getSession()
      .then(({ data }) => {
        if (!data?.user) {
          router.push('/login');
        } else {
          setSessionChecked(true);
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (!sessionChecked) {
    return (
      <main className="min-h-screen bg-(--color-bg) flex items-center justify-center p-8">
        <p className="text-(--color-fg-muted)">检查登录状态…</p>
      </main>
    );
  }

  function validateFile(file: File): string | null {
    const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) return `不支持 ${ext}，仅支持 .txt / .md / .docx`;
    if (file.size > MAX_SIZE) return `文件超过 20MB 上限`;
    return null;
  }

  async function handleManuscriptFile(file: File) {
    const err = validateFile(file);
    if (err) { setErrorMsg(err); setStatus('error'); return; }

    setStatus('uploading');
    setErrorMsg('');
    setPreview(null);
    setManuscriptId(null);

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/manuscripts', { method: 'POST', body: fd });
    let data: {
      manuscriptId?: string; paragraphCount?: number; charCount?: number; error?: string;
    };
    try { data = await res.json() as typeof data; } catch { data = {}; }
    if (!res.ok) { setErrorMsg(data.error ?? '上传失败'); setStatus('error'); return; }

    setPreview({ filename: file.name, paragraphCount: data.paragraphCount ?? 0, charCount: data.charCount ?? 0 });
    setManuscriptId(data.manuscriptId ?? null);
    setStatus('idle');
    setCurrentStep(2);
  }

  async function handleRefFile(file: File) {
    const err = validateFile(file);
    if (err) { setErrorMsg(err); return; }
    if (refs.length >= MAX_REFS) { setErrorMsg(`最多上传 ${MAX_REFS} 个参考文献`); return; }

    const newItem: RefItem = {
      file,
      canonicalName: file.name.replace(/\.[^.]+$/, ''),
      role: 'CANON',
      referenceId: null,
      uploading: false,
      error: null,
    };
    setRefs((prev) => [...prev, newItem]);
  }

  async function uploadRef(idx: number) {
    const item = refs[idx];
    if (!item || !copyrightDeclared) {
      if (!copyrightDeclared) setErrorMsg('请先勾选版权声明');
      return;
    }
    if (!item.canonicalName.trim()) { setErrorMsg('请填写规范名称'); return; }

    setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, uploading: true, error: null } : r));
    setErrorMsg('');

    const fd = new FormData();
    fd.append('file', item.file);
    fd.append('canonicalName', item.canonicalName.trim());
    fd.append('role', item.role);
    fd.append('copyrightDeclared', 'true');

    const res = await fetch('/api/references', { method: 'POST', body: fd });
    let data: { referenceId?: string; error?: string };
    try { data = await res.json() as typeof data; } catch { data = {}; }
    if (!res.ok) {
      setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, uploading: false, error: data.error ?? '上传失败' } : r));
    } else {
      setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, uploading: false, referenceId: data.referenceId ?? null } : r));
    }
  }

  function removeRef(idx: number) {
    setRefs((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSkipRefs() {
    setCurrentStep(3);
  }

  /** 用户点击"微信支付" → 创建支付订单 + 显示二维码 */
  async function handlePay() {
    if (!manuscriptId) return;
    setStatus('paying');
    setErrorMsg('');

    const uploadedRefIds = refs
      .filter((r) => r.referenceId !== null)
      .map((r) => r.referenceId as string);

    try {
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manuscriptId, referenceIds: uploadedRefIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? '创建支付订单失败');
        setStatus('error');
        return;
      }

      setQrCode(data.qrCode);
      setPaymentOrderId(data.paymentOrderId);
      setCreatedTaskId(data.taskId);
      setPayStep('waiting');
      setStatus('idle');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '网络错误');
      setStatus('error');
    }
  }

  /** 轮询支付状态 */
  useEffect(() => {
    if (payStep !== 'waiting' || !paymentOrderId) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/status?id=${encodeURIComponent(paymentOrderId)}`);
        const data = await res.json();
        if (data.status === 'paid' && createdTaskId) {
          setPayStep('paid');
          clearInterval(timer);
          setTimeout(() => router.push(`/tasks/${createdTaskId}`), 800);
        } else if (data.status === 'expired') {
          setPayStep('expired');
          clearInterval(timer);
        }
      } catch {
        // 静默重试
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [payStep, paymentOrderId, createdTaskId, router]);

  /** 二维码过期 → 重新支付 */
  function handleRetry() {
    setPayStep('idle');
    setQrCode(null);
    setPaymentOrderId(null);
    setCreatedTaskId(null);
    setStatus('idle');
    setErrorMsg('');
  }

  const pendingRefs = refs.filter((r) => !r.referenceId && !r.uploading);
  const allRefsDone = refs.length > 0 && refs.every((r) => r.referenceId !== null);

  return (
    <main className="min-h-screen bg-(--color-bg)">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-(--color-fg)">新建核查任务</h1>
          <p className="text-sm text-(--color-fg-muted)">
            上传书稿，添加参考文献，系统自动比对引文
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2">
          <StepIndicator current={currentStep} step={1} />
          <div className={`w-12 sm:w-20 h-px ${currentStep > 1 ? 'bg-(--color-primary)' : 'bg-(--color-border)'}`} />
          <StepIndicator current={currentStep} step={2} />
          <div className={`w-12 sm:w-20 h-px ${currentStep > 2 ? 'bg-(--color-primary)' : 'bg-(--color-border)'}`} />
          <StepIndicator current={currentStep} step={3} />
        </div>

        {/* Step 1: 上传书稿 */}
        {currentStep === 1 && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-(--color-primary) text-(--color-primary-fg) flex items-center justify-center text-xs font-medium">1</div>
              <h2 className="text-lg font-medium text-(--color-fg)">上传书稿</h2>
            </div>

            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-(--color-primary) bg-(--color-primary)/5 scale-[1.01]'
                  : 'border-(--color-border) hover:border-(--color-primary) hover:bg-(--color-bg)'
              }`}
              onClick={() => manuscriptInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && manuscriptInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleManuscriptFile(file);
              }}
            >
              <input
                ref={manuscriptInputRef}
                type="file"
                className="hidden"
                accept=".txt,.md,.docx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleManuscriptFile(f); }}
              />
              {status === 'uploading' ? (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-(--color-fg-muted)">正在解析书稿…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-(--color-bg) border border-(--color-border) flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-(--color-fg-muted)">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-(--color-fg) font-medium">拖拽或点击选择书稿文件</p>
                    <p className="text-sm text-(--color-fg-muted) mt-1">.txt / .md / .docx · 最大 20MB</p>
                  </div>
                </div>
              )}
            </div>

            {errorMsg && status === 'error' && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{errorMsg}</p>
            )}
          </div>
        )}

        {/* Step 2: 参考文献 */}
        {currentStep === 2 && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-(--color-primary) text-(--color-primary-fg) flex items-center justify-center text-xs font-medium">2</div>
              <h2 className="text-lg font-medium text-(--color-fg)">参考文献 <span className="text-sm text-(--color-fg-muted) font-normal">（可选）</span></h2>
            </div>

            {/* 版权声明 */}
            <label className="flex items-start gap-2.5 text-sm text-(--color-fg-muted) cursor-pointer group">
              <input
                type="checkbox"
                checked={copyrightDeclared}
                onChange={(e) => setCopyrightDeclared(e.target.checked)}
                className="mt-0.5 accent-(--color-primary)"
              />
              <span className="group-hover:text-(--color-fg) transition-colors">
                本人确认上传的参考文献为自有版权、公有领域或已获授权使用，并对此承担相应责任。
              </span>
            </label>

            {/* 参考文献列表 */}
            {refs.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-(--color-border) p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-(--color-fg-muted) shrink-0">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    </svg>
                    <span className="text-sm font-medium text-(--color-fg) truncate">{item.file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRef(idx)}
                    className="text-xs text-(--color-fg-muted) hover:text-red-500 shrink-0 ml-2"
                  >
                    移除
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={item.canonicalName}
                    onChange={(e) => setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, canonicalName: e.target.value } : r))}
                    placeholder="规范名称（如：论语）"
                    className="flex-1 text-sm border border-(--color-border) rounded-lg px-3 py-1.5 bg-(--color-bg) text-(--color-fg) placeholder:text-(--color-fg-muted)/50 focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20 focus:border-(--color-primary)"
                    disabled={!!item.referenceId}
                  />
                  <select
                    value={item.role}
                    onChange={(e) => setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, role: e.target.value as RefItem['role'] } : r))}
                    className="text-sm border border-(--color-border) rounded-lg px-2 py-1.5 bg-(--color-bg) text-(--color-fg) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20 focus:border-(--color-primary)"
                    disabled={!!item.referenceId}
                  >
                    <option value="CANON">原典</option>
                    <option value="ANNOTATED">注释本</option>
                    <option value="TRANSLATED">译本</option>
                    <option value="TOOL">工具书</option>
                    <option value="OTHER">其他</option>
                  </select>
                </div>

                {item.error && <p className="text-xs text-red-500">{item.error}</p>}

                {item.referenceId ? (
                  <p className="text-xs text-(--color-verdict-match) flex items-center gap-1">
                    <Check size={12} /> 已上传（{item.referenceId.slice(0, 8)}…）
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void uploadRef(idx)}
                    disabled={item.uploading || !copyrightDeclared}
                    className="text-xs px-3 py-1.5 rounded-lg bg-(--color-primary) text-(--color-primary-fg) disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {item.uploading ? '上传中…' : '确认上传'}
                  </button>
                )}
              </div>
            ))}

            {/* 添加参考文献 — 拖拽或点击 */}
            {refs.length < MAX_REFS && (
              <div
                role="button"
                tabIndex={0}
                className={`border-2 border-dashed rounded-xl py-6 text-center cursor-pointer transition-all ${
                  refDragging
                    ? 'border-(--color-primary) bg-(--color-primary)/5 scale-[1.01]'
                    : 'border-(--color-border) hover:border-(--color-primary) hover:bg-(--color-bg)'
                }`}
                onClick={() => refInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && refInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setRefDragging(true); }}
                onDragLeave={() => setRefDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setRefDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void handleRefFile(file);
                }}
              >
                <p className="text-sm text-(--color-fg-muted)">+ 添加参考文献（拖拽或点击选择文件）</p>
              </div>
            )}
            <input
              ref={refInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleRefFile(f); e.target.value = ''; }}
            />

            {pendingRefs.length > 0 && (
              <p className="text-xs text-(--color-fg-muted) flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-(--color-warning) inline-block" />
                有 {pendingRefs.length} 个参考文献尚未点击"确认上传"，不会计入本次核查。
              </p>
            )}

            {/* 底部操作 */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-sm text-(--color-fg-muted) hover:text-(--color-fg) transition-colors"
              >
                ← 返回上一步
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSkipRefs}
                  className="text-sm text-(--color-fg-muted) hover:text-(--color-fg) transition-colors"
                >
                  跳过此步骤
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={pendingRefs.length > 0}
                  className="px-4 py-2 rounded-lg bg-(--color-primary) text-(--color-primary-fg) text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {refs.length === 0 ? '下一步' : allRefsDone ? '下一步' : `下一步（${pendingRefs.length} 个未上传）`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 支付 + 开始核查 */}
        {currentStep === 3 && payStep === 'idle' && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-(--color-primary) text-(--color-primary-fg) flex items-center justify-center text-xs font-medium">3</div>
              <h2 className="text-lg font-medium text-(--color-fg)">确认并支付</h2>
            </div>

            {preview && (
              <div className="rounded-xl bg-(--color-bg) border border-(--color-border) divide-y divide-(--color-border)">
                <div className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm text-(--color-fg-muted)">书稿</span>
                  <span className="text-sm font-medium text-(--color-fg)">{preview.filename}</span>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm text-(--color-fg-muted)">字数</span>
                  <span className="text-sm font-medium text-(--color-fg)">{preview.charCount.toLocaleString()} 字</span>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm text-(--color-fg-muted)">参考文献</span>
                  <span className="text-sm font-medium text-(--color-fg)">{refs.filter((r) => r.referenceId).length} 份</span>
                </div>
                <div className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm text-(--color-fg-muted)">费用</span>
                  <span className="text-sm font-medium text-(--color-fg)">
                    {preview.charCount.toLocaleString()} 字 × ¥3/千字 = 约 ¥{Math.max(1, Math.ceil(preview.charCount / 1000) * 3).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{errorMsg}</p>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-sm text-(--color-fg-muted) hover:text-(--color-fg) transition-colors"
              >
                ← 返回上一步
              </button>
              <button
                type="button"
                disabled={status === 'paying'}
                onClick={() => void handlePay()}
                className="inline-flex items-center gap-2 rounded-xl bg-[oklch(0.55_0.15_145)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {status === 'paying' ? (
                  <>处理中…</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="18" cy="14" r="1.5" fill="currentColor"/>
                    </svg>
                    微信支付 ¥{preview ? Math.max(1, Math.ceil(preview.charCount / 1000) * 3).toFixed(2) : '0.00'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 支付等待：展示二维码 */}
        {payStep === 'waiting' && qrCode && preview && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="w-7 h-7 rounded-full bg-(--color-primary) text-(--color-primary-fg) flex items-center justify-center text-xs font-medium mx-auto">3</div>
              <h2 className="text-lg font-medium text-(--color-fg)">请使用微信扫码支付</h2>
            </div>

            <div className="flex justify-center">
              <div className="rounded-xl border border-(--color-border) bg-white p-4 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="微信支付二维码"
                  className="h-52 w-52"
                />
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-(--color-fg)">
                ¥{Math.max(1, Math.ceil(preview.charCount / 1000) * 3).toFixed(2)}
              </p>
              <p className="text-sm text-(--color-fg-muted)">二维码有效期为 2 小时，请尽快支付</p>
              <p className="text-sm text-(--color-fg-muted)">支付成功后自动开始核查</p>
            </div>

            <div className="flex justify-center pt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-(--color-primary) animate-pulse" />
            </div>
          </div>
        )}

        {/* 支付成功过渡 */}
        {payStep === 'paid' && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6">
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-[oklch(0.55_0.15_145)] text-white flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-(--color-fg)">支付成功</h2>
              <p className="text-sm text-(--color-fg-muted)">正在跳转到任务页面…</p>
            </div>
          </div>
        )}

        {/* 二维码过期 */}
        {payStep === 'expired' && (
          <div className="rounded-xl border border-(--color-border) bg-(--color-card) p-8 space-y-6">
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-500 flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-(--color-fg)">二维码已过期</h2>
              <p className="text-sm text-(--color-fg-muted)">请重新生成二维码进行支付</p>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-(--color-primary) px-6 py-2.5 text-sm font-medium text-(--color-primary-fg) hover:opacity-90 transition-opacity"
              >
                重新支付
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
