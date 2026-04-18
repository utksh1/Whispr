"use client";

import { Icon } from "@/components/ui/Icon";

export function TopAppBar() {
  return (
    <header className="w-full shrink-0">
      <div className="flex h-16 w-full items-center justify-between border-b border-emerald-900/10 bg-white/95 px-6 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="leading-none">
            <h1 className="text-xl font-semibold tracking-tight text-emerald-950 font-headline italic sm:text-2xl">Whispr</h1>
            <p className="hidden text-[10px] uppercase tracking-[0.28em] text-emerald-900/70 sm:block">Encrypted Relay</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-emerald-800/20 bg-emerald-900/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-950 md:inline-flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secured
          </span>

          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/15 text-emerald-950 transition hover:bg-emerald-900/10 active:scale-95"
            aria-label="Notifications"
          >
            <Icon name="notifications" className="text-lg" />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/15 text-emerald-950 transition hover:bg-emerald-900/10 active:scale-95"
            aria-label="Open settings"
          >
            <Icon name="settings" className="text-lg" />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/15 text-emerald-950 transition hover:bg-emerald-900/10 active:scale-95"
            aria-label="Open menu"
          >
            <Icon name="more_vert" className="text-lg" />
          </button>
        </div>
      </div>
    </header>
  );
}
