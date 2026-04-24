'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const ALLOWED_EXT = ['.txt', '.md', '.docx'];
const MAX_SIZE = 20 * 1024 * 1024;

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<{
    filename: string;
    paragraphCount: number;
    charCount: number;
  } | null>(null);
  const [manuscriptId, setManuscriptId] = useState<string | null>(null);

  function validateFile(file: File): string | null {
    const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) return `不支持 ${ext}，仅支持 .txt / .md / .docx`;
    if (file.size > MAX_SIZE) return `文件超过 20MB 上限`;
    return null;
  }

  async function handleFile(file: File) {
    const err = validateFile(file);
    if (err) {
      setErrorMsg(err);
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setErrorMsg('');
    setPreview(null);
    setManuscriptId(null);

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/manuscripts', { method: 'POST', body: fd });
    const data = (await res.json()) as {
      manuscriptId?: string;
      displayId?: string;
      paragraphCount?: number;
      charCount?: number;
      error?: string;
    };

    if (!res.ok) {
      setErrorMsg(data.error ?? '上传失败');
      setStatus('error');
      return;
    }

    setPreview({
      filename: file.name,
      paragraphCount: data.paragraphCount ?? 0,
      charCount: data.charCount ?? 0,
    });
    setManuscriptId(data.manuscriptId ?? null);
    setStatus('idle');
  }

  async function handleStart() {
    if (!manuscriptId) return;
    setStatus('creating');

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manuscriptId }),
    });
    const data = (await res.json()) as { taskId?: string; error?: string };

    if (!res.ok) {
      setErrorMsg(data.error ?? '创建任务失败');
      setStatus('error');
      return;
    }

    router.push(`/tasks/${data.taskId}`);
  }

  return (
    <main className="min-h-screen bg-(--color-bg) flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold text-(--color-fg) mb-2">上传书稿</h1>
        <p className="text-sm text-(--color-fg-muted) mb-8">
          支持 .txt / .md / .docx，上限 20MB。系统对照参考文献从三个维度比对引文，终审权归编辑。
        </p>

        {/* 拖拽区 */}
        <div
          role="button"
          tabIndex={0}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-(--color-primary) bg-blue-50'
              : 'border-(--color-border) hover:border-(--color-primary)'
          }`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
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

        {status === 'error' && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{errorMsg}</p>
        )}

        {preview && manuscriptId && (
          <button
            type="button"
            disabled={status === 'creating'}
            onClick={() => void handleStart()}
            className="mt-6 w-full py-3 rounded-xl bg-(--color-primary) text-(--color-primary-fg) font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === 'creating' ? '正在发起…' : '开始引用核查'}
          </button>
        )}
      </div>
    </main>
  );
}
