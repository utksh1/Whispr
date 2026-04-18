"use client";

import { Icon } from "@/components/ui/Icon";

export function TopAppBar() {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-on-background/80 backdrop-blur-xl bg-gradient-to-b from-surface to-transparent">
      <div className="flex justify-between items-center px-8 py-6 max-w-screen-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface font-headline italic">Whispr</h1>
        <div className="flex gap-4 items-center">
          <button type="button" className="text-primary dark:text-primary-fixed hover:opacity-70 transition-opacity duration-300 active:scale-95 cursor-pointer" aria-label="Open menu">
            <Icon name="more_vert" className="text-2xl" />
          </button>
        </div>
      </div>
    </header>
  );
}
