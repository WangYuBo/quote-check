'use client';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-red-600">页面加载失败</h2>
        <p className="text-sm text-[hsl(var(--shadcn-muted-foreground))]">
          {error.message}
          {error.digest && <span className="block mt-1 font-mono text-xs">Error ID: {error.digest}</span>}
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          重试
        </button>
      </div>
    </div>
  );
}
