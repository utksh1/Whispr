"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { useRouter } from "next/navigation";

export function TopAppBar({ onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="w-full shrink-0 relative z-[100]">
      <div className="flex h-16 w-full items-center justify-between border-b border-emerald-900/10 bg-white/95 px-6 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="leading-none cursor-pointer" onClick={() => router.push("/app")}>
            <h1 className="text-xl font-semibold tracking-tight text-emerald-950 font-headline italic sm:text-2xl">Whispr</h1>
            <p className="hidden text-[10px] uppercase tracking-[0.28em] text-emerald-900/70 sm:block">Encrypted Relay</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            type="button"
            onClick={() => router.push("/app/security")}
            className="hidden items-center gap-2 rounded-full border border-emerald-800/20 bg-emerald-900/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-950 md:inline-flex transition hover:bg-emerald-900/20"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secured
          </button>

          <button
            type="button"
            onClick={() => router.push("/app/notifications")}
            className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/15 text-emerald-950 transition hover:bg-emerald-900/10 active:scale-95"
            aria-label="Notifications"
          >
            <Icon name="notifications" className="text-lg" />
          </button>
          
          <button
            type="button"
            onClick={() => router.push("/app/settings")}
            className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/15 text-emerald-950 transition hover:bg-emerald-900/10 active:scale-95"
            aria-label="Open settings"
          >
            <Icon name="settings" className="text-lg" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`grid h-9 w-9 place-items-center rounded-xl border border-emerald-900/15 text-emerald-950 transition hover:bg-emerald-900/10 active:scale-95 ${isMenuOpen ? "bg-emerald-900/10" : ""}`}
              aria-label="Open menu"
            >
              <Icon name="more_vert" className="text-lg" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-emerald-900/10 bg-white p-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in duration-200">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/app/settings");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-emerald-950 transition hover:bg-emerald-900/5"
                >
                  <Icon name="settings" className="text-base text-emerald-800" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/app/help")}
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-emerald-950 transition hover:bg-emerald-900/5"
                >
                  <Icon name="help_outline" className="text-base text-emerald-800" />
                  <span>Help & Support</span>
                </button>
                <div className="my-1 h-px bg-emerald-900/5" />
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <Icon name="logout" className="text-base" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
