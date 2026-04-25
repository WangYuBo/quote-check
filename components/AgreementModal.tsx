'use client';

import { useEffect, useState } from 'react';

import { authClient } from '@/lib/auth-client';

interface AgreementStatus {
  accepted: boolean;
  currentVersion: string;
}

export default function AgreementModal() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/agreement')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as AgreementStatus;
        if (!data.accepted) setShow(true);
      })
      .catch(() => { /* 网络失败不阻断 */ });
  }, []);

  async function handleAccept() {
    setLoading(true);
    try {
      const res = await fetch('/api/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      });
      if (res.ok) setShow(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    await authClient.signOut();
    window.location.href = '/';
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl p-8 space-y-6 shadow-xl mx-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">数据使用协议</h2>
          <p className="text-xs text-gray-400">版本 v1.0-2026-04</p>
        </div>

        <div className="text-sm text-gray-700 space-y-3 max-h-64 overflow-y-auto pr-2">
          <p>在使用引文核查服务前，请确认以下事项：</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>数据流向</strong>：您上传的书稿和参考文献将存储于 Vercel Blob，
              并通过硅基流动平台调用 DeepSeek-V3 模型进行引文分析。
            </li>
            <li>
              <strong>不用于训练</strong>：硅基流动平台承诺不使用您的数据训练模型
              （详见硅基流动服务条款）。
            </li>
            <li>
              <strong>自动删除</strong>：您的书稿和参考文件将在 7 天后自动删除，
              核查报告（不含原文）将长期保留用于溯源。
            </li>
            <li>
              <strong>日志脱敏</strong>：系统日志不记录原文内容，仅记录任务 ID 等元数据。
            </li>
            <li>
              <strong>终审权归编辑</strong>：AI 的核查结果仅供参考，最终判断权归编辑所有，
              系统不直接修改书稿。
            </li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '处理中…' : '我已阅读并同意'}
          </button>
          <button
            type="button"
            onClick={() => void handleReject()}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50"
          >
            拒绝并退出
          </button>
        </div>
      </div>
    </div>
  );
}
