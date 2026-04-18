"use client";

import { useEffect, useState } from "react";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";
import { Icon } from "@/components/ui/Icon";
import { 
  getCurrentSupabaseUser, 
  ensureProfile, 
  logoutFromSupabase 
} from "@/lib/supabase-chat";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const u = await getCurrentSupabaseUser();
      if (u) {
        setUser(u);
        const p = await ensureProfile(u);
        setProfile(p);
      } else {
        router.push("/app");
      }
    }
    load();
  }, [router]);

  const handleLogout = async () => {
    await logoutFromSupabase();
    router.push("/app");
  };

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar onLogout={handleLogout} />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        {/* Sidebar Space (Consistent Layout) */}
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Settings</h2>
            <nav className="space-y-2">
              <Link href="/app/settings" className="flex items-center gap-3 p-4 bg-surface-container-lowest rounded-2xl text-primary font-bold">
                <Icon name="person" className="text-2xl" />
                <span>Profile</span>
              </Link>
              <Link href="/app/security" className="flex items-center gap-3 p-4 hover:bg-surface-container-highest rounded-2xl transition-colors cursor-pointer text-on-surface-variant font-medium">
                <Icon name="key" className="text-2xl" />
                <span>Security</span>
              </Link>
              <button onClick={() => alert("Appearance settings coming soon!")} className="flex items-center gap-3 p-4 hover:bg-surface-container-highest rounded-2xl transition-colors cursor-pointer text-on-surface-variant font-medium">
                <Icon name="palette" className="text-2xl" />
                <span>Appearance</span>
              </button>
              <Link href="/app/help" className="flex items-center gap-3 p-4 hover:bg-surface-container-highest rounded-2xl transition-colors cursor-pointer text-on-surface-variant font-medium">
                <Icon name="help_outline" className="text-2xl" />
                <span>Help & FAQ</span>
              </Link>
            </nav>
          </div>
        </aside>

        <section className="flex-1 bg-surface p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">Account</h1>
              <p className="text-on-surface-variant font-light">Manage your presence in the sanctuary.</p>
            </header>

            <div className="space-y-8">
              {/* Profile Card */}
              <div className="bg-surface-container-low p-8 rounded-[3rem] shadow-[0_40px_100px_rgba(48,51,51,0.05)] border border-outline-variant/5">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-dim text-on-primary flex items-center justify-center text-4xl font-black shadow-xl shadow-primary/20">
                    {profile?.username?.[0]?.toUpperCase() || "W"}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-on-surface">{profile?.username || "Whispr User"}</h2>
                    <p className="text-on-surface-variant font-light">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Icon name="verified_user" className="text-2xl text-primary" />
                      <span className="font-medium">Encryption Keys</span>
                    </div>
                    <span className="text-xs uppercase tracking-widest text-primary font-bold">Synced</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Icon name="alternate_email" className="text-2xl text-outline" />
                      <span className="font-medium">Username</span>
                    </div>
                    <span className="text-on-surface-variant opacity-60">@{profile?.username}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button 
                  onClick={() => alert("Key pair sync coming soon!")}
                  className="w-full text-left p-6 bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-[2rem] flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold">Sync New Key Pair</h4>
                    <p className="text-sm text-on-surface-variant font-light">Rotate your local encryption keys for better security.</p>
                  </div>
                  <Icon name="refresh" className="text-2xl" />
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-full text-left p-6 bg-error-container/10 hover:bg-error-container/20 transition-colors rounded-[2rem] flex items-center justify-between group"
                >
                  <div>
                    <h4 className="font-bold text-error">Logout</h4>
                    <p className="text-sm text-error/60 font-light">Leave the sanctuary and clear active session.</p>
                  </div>
                  <Icon name="logout" className="text-2xl text-error group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </main>
  );
}
