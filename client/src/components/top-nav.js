import Link from "next/link";

export function TopNav({ title, subtitle }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <Link href="/" className="transition hover:text-white">
              Overview
            </Link>
            <Link href="/app" className="transition hover:text-white">
              Product app
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              Demo harness
            </Link>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
