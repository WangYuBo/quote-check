import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8">
        <p className="text-sm text-[var(--color-fg-muted)]">v1.0</p>
        <h1 className="mt-2 font-serif text-4xl font-bold">引用核查</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">
          文史类书稿的三维度引用比对：字词、解释、语境。
          <br />
          机器不判错，只报"一致 / 部分一致 / 不一致 / 未找到"。终审权归编辑。
        </p>
      </header>

      <div className="mt-6">
        <Link
          href="/upload"
          className="inline-block px-6 py-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-medium text-sm hover:opacity-90 transition-opacity"
        >
          上传书稿，开始核查
        </Link>
      </div>

      <footer className="mt-12 text-xs text-[var(--color-fg-muted)]">
        <p>机器初审候选 · 终审权归编辑 · 不判"错"只报"不符合"</p>
      </footer>
    </main>
  );
}
