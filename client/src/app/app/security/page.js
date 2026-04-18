"use client";

import { useState } from "react";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";
import { Icon } from "@/components/ui/Icon";
import { readStoredJson } from "@/lib/storage";

const APP_IDENTITY_KEY = "whispr-supabase-identity";

export default function SecurityPage() {
  const [keyStats] = useState(() => {
    const identity = readStoredJson(APP_IDENTITY_KEY);
    if (identity?.keyring) {
      return {
        count: identity.keyring.length,
        activeId: identity.currentKeyId,
      };
    }

    return { count: 0, activeId: null };
  });

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Privacy</h2>
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Status</p>
                <p className="text-sm font-medium">Device Secured</p>
              </div>
              <div className="p-4 bg-surface-container-lowest rounded-2xl">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Local Keyring</p>
                <p className="text-lg font-bold">{keyStats.count} Keys</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-surface p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">Security</h1>
              <p className="text-on-surface-variant font-light">Whispr uses zero-knowledge architecture. Your keys never leave this device unencrypted.</p>
            </header>

            <div className="space-y-6">
              <section className="bg-surface-container-low p-8 rounded-[3rem] border border-outline-variant/10">
                <h3 className="text-xl font-bold mb-6">Encryption Keys</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl">
                    <div>
                      <p className="font-bold">Active Public ID</p>
                      <p className="text-xs font-mono text-on-surface-variant opacity-60 truncate max-w-[200px]">{keyStats.activeId || "Not generated"}</p>
                    </div>
                    <Icon name="verified" className="text-2xl text-primary" />
                  </div>
                  <div className="p-4 bg-surface-container-lowest rounded-2xl">
                    <p className="font-bold mb-1">Automatic Key Rotation</p>
                    <p className="text-sm text-on-surface-variant font-light leading-relaxed">
                      Whispr generates a new key pair periodically to limit the impact of any single key compromise.
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-surface-container-low p-8 rounded-[3rem] border border-outline-variant/10">
                <h3 className="text-xl font-bold mb-6 text-error">Danger Zone</h3>
                <div className="space-y-3">
                  <button className="w-full text-left p-6 bg-error-container/5 hover:bg-error-container/10 transition-colors rounded-[2rem] flex items-center justify-between group">
                    <div>
                      <h4 className="font-bold text-error">Nuke Local Content</h4>
                      <p className="text-sm text-error/60 font-light">Wipes all messages and your local keyring. Cannot be undone.</p>
                    </div>
                    <Icon name="delete_forever" className="text-2xl text-error" />
                  </button>
                  <button className="w-full text-left p-6 bg-surface-container-highest rounded-[2rem] flex items-center justify-between opacity-50 cursor-not-allowed">
                    <div>
                      <h4 className="font-bold">Revoke All Web Sessions</h4>
                      <p className="text-sm text-on-surface-variant font-light">Signs you out from all other devices.</p>
                    </div>
                    <Icon name="devices" className="text-2xl text-on-surface-variant" />
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </main>
  );
}
