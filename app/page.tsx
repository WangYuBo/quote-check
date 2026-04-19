export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8">
        <p className="text-sm text-[var(--color-fg-muted)]">v1.0 scaffold</p>
        <h1 className="mt-2 font-serif text-4xl font-bold">引用核查</h1>
        <p className="mt-3 text-lg text-[var(--color-fg-muted)]">
          文史类书稿的三维度引用比对：字词、解释、语境。
          <br />
          机器不判错，只报"一致 / 部分一致 / 不一致 / 未找到"。终审权归编辑。
        </p>
      </header>

      <section className="prose-classical rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="mb-3 text-xl font-semibold">脚手架已就位</h2>
        <ul className="list-disc space-y-1 pl-5 text-[var(--color-fg)]">
          <li>Next.js 15 · React 19 · RSC 默认</li>
          <li>Drizzle + Neon · Inngest · Vercel AI SDK</li>
          <li>Better Auth · Pino redact · Zod</li>
          <li>Tailwind v4 · OKLCH token · B/C 皮肤</li>
          <li>
            prompts/v1/ 已冻结：<code>extract · verify · map</code>
          </li>
        </ul>
        <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
          下一步：lib/ 核心模块实装（db schema · auth · ai client · logger · 幂等键）， 随后写 TDD
          合规测试与 Inngest 工作流。
        </p>
      </section>

      <footer className="mt-12 text-xs text-[var(--color-fg-muted)]">
        <p>
          规约链（0→9）已闭合：meta · cog · real · 产品 · 用户故事 · 架构 · 数据库 · UI · 编码 ·
          质量保障。
        </p>
      </footer>
    </main>
  );
}
