'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

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

export default function UploadPage() {
  const router = useRouter();
  const manuscriptInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<{
    filename: string;
    paragraphCount: number;
    charCount: number;
  } | null>(null);
  const [manuscriptId, setManuscriptId] = useState<string | null>(null);
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [copyrightDeclared, setCopyrightDeclared] = useState(false);

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
    const data = (await res.json()) as {
      manuscriptId?: string; paragraphCount?: number; charCount?: number; error?: string;
    };

    if (!res.ok) { setErrorMsg(data.error ?? '上传失败'); setStatus('error'); return; }

    setPreview({ filename: file.name, paragraphCount: data.paragraphCount ?? 0, charCount: data.charCount ?? 0 });
    setManuscriptId(data.manuscriptId ?? null);
    setStatus('idle');
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
    const data = (await res.json()) as { referenceId?: string; error?: string };

    if (!res.ok) {
      setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, uploading: false, error: data.error ?? '上传失败' } : r));
    } else {
      setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, uploading: false, referenceId: data.referenceId ?? null } : r));
    }
  }

  function removeRef(idx: number) {
    setRefs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleStart() {
    if (!manuscriptId) return;
    setStatus('creating');

    const uploadedRefIds = refs
      .filter((r) => r.referenceId !== null)
      .map((r) => r.referenceId as string);

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manuscriptId, referenceIds: uploadedRefIds }),
    });
    const data = (await res.json()) as { taskId?: string; error?: string };

    if (!res.ok) { setErrorMsg(data.error ?? '创建任务失败'); setStatus('error'); return; }

    router.push(`/tasks/${data.taskId}`);
  }

  const pendingRefs = refs.filter((r) => !r.referenceId && !r.uploading);

  return (
    <main className="min-h-screen bg-(--color-bg) flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-fg) mb-2">上传书稿</h1>
          <p className="text-sm text-(--color-fg-muted) mb-6">
            支持 .txt / .md / .docx，上限 20MB。系统对照参考文献从三个维度比对引文，终审权归编辑。
          </p>

          {/* 书稿拖拽区 */}
          <div
            role="button"
            tabIndex={0}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-(--color-primary) bg-blue-50'
                : 'border-(--color-border) hover:border-(--color-primary)'
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
              <p className="text-(--color-fg-muted)">正在解析…</p>
            ) : preview ? (
              <div className="space-y-1">
                <p className="font-medium text-(--color-fg)">{preview.filename}</p>
                <p className="text-sm text-(--color-fg-muted)">
                  {preview.paragraphCount} 段落 · {preview.charCount.toLocaleString()} 字符
                </p>
                <p className="text-xs text-(--color-fg-muted)">点击重新上传</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-(--color-fg)">拖拽或点击选择书稿文件</p>
                <p className="text-sm text-(--color-fg-muted)">.txt / .md / .docx · 最大 20MB</p>
              </div>
            )}
          </div>
        </div>

        {/* 参考文献区（书稿上传后展示） */}
        {manuscriptId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-(--color-fg)">参考文献（可选）</h2>
              <span className="text-xs text-(--color-fg-muted)">{refs.length}/{MAX_REFS}</span>
            </div>

            {/* 版权声明 */}
            <label className="flex items-start gap-2 text-sm text-(--color-fg-muted) cursor-pointer">
              <input
                type="checkbox"
                checked={copyrightDeclared}
                onChange={(e) => setCopyrightDeclared(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                本人确认上传的参考文献为自有版权、公有领域或已获授权使用，并对此承担相应责任。
              </span>
            </label>

            {/* 已添加的参考文献列表 */}
            {refs.map((item, idx) => (
              <div key={idx} className="border border-(--color-border) rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-(--color-fg) truncate max-w-xs">
                    {item.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRef(idx)}
                    className="text-xs text-(--color-fg-muted) hover:text-red-500"
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
                    className="flex-1 text-sm border border-(--color-border) rounded-lg px-3 py-1.5 bg-(--color-bg) text-(--color-fg)"
                    disabled={!!item.referenceId}
                  />
                  <select
                    value={item.role}
                    onChange={(e) => setRefs((prev) => prev.map((r, i) => i === idx ? { ...r, role: e.target.value as RefItem['role'] } : r))}
                    className="text-sm border border-(--color-border) rounded-lg px-2 py-1.5 bg-(--color-bg) text-(--color-fg)"
                    disabled={!!item.referenceId}
                  >
                    <option value="CANON">原典</option>
                    <option value="ANNOTATED">注释本</option>
                    <option value="TRANSLATED">译本</option>
                    <option value="TOOL">工具书</option>
                    <option value="OTHER">其他</option>
                  </select>
                </div>

                {item.error && (
                  <p className="text-xs text-red-500">{item.error}</p>
                )}

                {item.referenceId ? (
                  <p className="text-xs text-green-600">✓ 已上传（{item.referenceId.slice(0, 8)}…）</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void uploadRef(idx)}
                    disabled={item.uploading || !copyrightDeclared}
                    className="text-xs px-3 py-1.5 rounded-lg bg-(--color-primary) text-(--color-primary-fg) disabled:opacity-50"
                  >
                    {item.uploading ? '上传中…' : '确认上传'}
                  </button>
                )}
              </div>
            ))}

            {/* 添加参考文献按钮 */}
            {refs.length < MAX_REFS && (
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                className="w-full py-2.5 border-2 border-dashed border-(--color-border) rounded-xl text-sm text-(--color-fg-muted) hover:border-(--color-primary) transition-colors"
              >
                + 添加参考文献
              </button>
            )}
            <input
              ref={refInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleRefFile(f); e.target.value = ''; }}
            />

            {pendingRefs.length > 0 && (
              <p className="text-xs text-(--color-fg-muted)">
                ⚠ 有 {pendingRefs.length} 个参考文献尚未点击"确认上传"，不会计入本次核查。
              </p>
            )}
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{errorMsg}</p>
        )}

        {preview && manuscriptId && (
          <button
            type="button"
            disabled={status === 'creating'}
            onClick={() => void handleStart()}
            className="w-full py-3 rounded-xl bg-(--color-primary) text-(--color-primary-fg) font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === 'creating' ? '正在发起…' : '开始引用核查'}
          </button>
        )}
      </div>
    </main>
  );
}
