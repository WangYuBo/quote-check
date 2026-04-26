import Link from 'next/link';

const beanAccent = 'text-[oklch(0.55_0.09_160)]';

function BeanDot({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${beanAccent} bg-current ${className}`}
      aria-hidden
    />
  );
}

function IconDimension({
  glyph,
  label,
  desc,
}: {
  glyph: string;
  label: string;
  desc: string;
}) {
  return (
    <div className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-colors hover:border-[oklch(0.55_0.09_160/0.3)]">
      <span className="block font-serif text-3xl" aria-hidden>
        {glyph}
      </span>
      <h3 className="mt-4 font-serif text-lg font-semibold text-[var(--color-fg)]">
        {label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {desc}
      </p>
    </div>
  );
}

function StatusBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`, color }}
    >
      {label}
    </span>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-0 h-[600px] w-[600px] rounded-full bg-[oklch(0.55_0.09_160/0.04)] blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-6 pb-32 pt-20 sm:pt-28">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-[0.2em] text-[var(--color-fg-muted)] uppercase">
              文史类书稿校对工具
            </p>
            <h1 className="mt-6 font-serif text-5xl font-bold leading-[1.1] tracking-tight text-[var(--color-fg)] sm:text-6xl">
              黑猫<BeanDot />
              校对
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[var(--color-fg-muted)] sm:text-lg">
              对照原始文献，从字词、解释、语境三维度比对书稿引用。
              <br />
              机器不判错，只报状态。终审权归编辑。
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-medium text-[var(--color-primary-fg)] transition-all hover:opacity-90"
              >
                开始校对
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M1.5 7h11m0 0L8 2.5M12.5 7L8 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:bg-[var(--color-border)]/30"
              >
                登录
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Three Dimensions ───── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-[var(--color-fg)] sm:text-4xl">
              三维度<BeanDot className="mx-2 align-middle" />
              比对
            </h2>
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
              每一处引用都经过三重校验
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <IconDimension
              glyph="字"
              label="字词比对"
              desc="逐字逐词核对引用文本与原始文献，精确标记字词差异，不放过任何一处出入。"
            />
            <IconDimension
              glyph="释"
              label="解释比对"
              desc="比对注释与原始文献释义，确保引用的解释性文字准确无误，避免以讹传讹。"
            />
            <IconDimension
              glyph="境"
              label="语境比对"
              desc="核查引用是否断章取义，还原原文完整语境，防止选择性引用导致的误解。"
            />
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl font-bold text-[var(--color-fg)] sm:text-4xl">
                四种状态<BeanDot className="mx-2 align-middle" />
                不做判断
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                系统对每一处引用给出客观比对结果，不做价值判断，不做自动修改。
                一切决定权在编辑手中。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <StatusBadge label="一致" color="var(--color-verdict-match)" />
              <StatusBadge label="部分一致" color="var(--color-verdict-partial)" />
              <StatusBadge label="不一致" color="var(--color-verdict-notmatch)" />
              <StatusBadge label="未找到" color="var(--color-verdict-notfound)" />
              <span className="mt-4 block w-full text-xs text-[var(--color-fg-muted)]">
                没有"对"与"错"，只有是否符合原始文献
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Philosophy ───── */}
      <section className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
          <span className="block font-serif text-5xl" aria-hidden>
            &ldquo;
          </span>
          <blockquote className="-mt-4 font-serif text-xl leading-relaxed text-[var(--color-fg)] sm:text-2xl">
            机器初审候选，终审权归编辑
          </blockquote>
          <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
            我们相信编辑的专业判断，技术只是辅助工具
          </p>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
          <h2 className="font-serif text-3xl font-bold text-[var(--color-fg)] sm:text-4xl">
            开始使用<BeanDot className="mx-2 align-middle" />
            黑猫校对
          </h2>
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
            上传书稿，即刻开始三维度引用核查
          </p>
          <Link
            href="/upload"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-sm font-medium text-[var(--color-primary-fg)] transition-all hover:opacity-90"
          >
            上传书稿，开始核查
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1.5 7h11m0 0L8 2.5M12.5 7L8 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
