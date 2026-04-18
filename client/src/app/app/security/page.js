"use client";

import { useEffect, useState } from "react";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";
import { Icon } from "@/components/ui/Icon";
import { buildScopedStorageKey, readStoredJson } from "@/lib/storage";
import {
  ensureProfile,
  getCurrentSupabaseUser,
  logoutFromSupabase,
  logoutFromAllDevices,
} from "@/lib/supabase-chat";
import { useRouter } from "next/navigation";

const LEGACY_APP_IDENTITY_KEY = "whispr-supabase-identity";
const APP_IDENTITY_KEY_PREFIX = "whispr-supabase-identity";

export default function SecurityPage() {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [keyStats, setKeyStats] = useState({ count: 0, activeId: null });
  const hasLocalKeys = keyStats.count > 0;
  const hasPublishedKey = Boolean(profile?.hasPublicKey && profile?.activePublicKeyId);

  function getScopedIdentityKey(userId) {
    return buildScopedStorageKey(APP_IDENTITY_KEY_PREFIX, userId);
  }

  useEffect(() => {
    async function loadProfile() {
      const user = await getCurrentSupabaseUser();

      if (!user) {
        router.replace("/app");
        return;
      }

      setUser(user);
      const nextProfile = await ensureProfile(user);
      setProfile(nextProfile);

      const scopedIdentity = readStoredJson(getScopedIdentityKey(user.id));
      const legacyIdentity = readStoredJson(LEGACY_APP_IDENTITY_KEY);
      const identity = scopedIdentity || legacyIdentity;

      if (identity?.keyring?.length) {
        setKeyStats({
          count: identity.keyring.length,
          activeId: identity.currentKeyId || identity.keyring[0]?.keyId || null,
        });
        return;
      }

      if (identity?.publicKey) {
        setKeyStats({
          count: 1,
          activeId: identity.currentKeyId || identity.uploadedKeyId || null,
        });
      }
    }

    loadProfile().catch((error) => {
      console.error(error);
    });
  }, [router]);

  const handleLogout = async () => {
    await logoutFromSupabase();
    router.replace("/app");
  };

  const handleNuke = async () => {
    if (!confirm("ARE YOU ABSOLUTELY SURE? This will permanently delete your local encryption keys and messages. You cannot recover your messages without these keys.")) {
      return;
    }

    setIsBusy(true);
    try {
      if (user?.id) {
        localStorage.removeItem(getScopedIdentityKey(user.id));
      }
      localStorage.removeItem(LEGACY_APP_IDENTITY_KEY);
      await logoutFromSupabase();
      router.replace("/app");
    } catch (e) {
      console.error(e);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!confirm("This will sign you out from all other devices. Proceed?")) {
      return;
    }

    setIsBusy(true);
    try {
      await logoutFromAllDevices();
      router.replace("/app");
    } catch (e) {
      console.error(e);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar onLogout={handleLogout} />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Privacy</h2>
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl border ${
                  hasPublishedKey
                    ? "bg-primary/10 border-primary/20"
                    : "bg-surface-container-lowest border-outline-variant/20"
                }`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                    hasPublishedKey ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  Status
                </p>
                <p className="text-sm font-medium">
                  {hasPublishedKey
                    ? "Public key published"
                    : hasLocalKeys
                    ? "Local key only"
                    : "No local key generated"}
                </p>
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
                      <p className="font-bold">Published Public ID</p>
                      <p className="text-xs font-mono text-on-surface-variant opacity-60 truncate max-w-[200px]">
                        {profile?.activePublicKeyId || "Not published"}
                      </p>
                    </div>
                    <Icon
                      name={hasPublishedKey ? "verified" : "key_off"}
                      className={`text-2xl ${hasPublishedKey ? "text-primary" : "text-on-surface-variant"}`}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-2xl">
                    <div>
                      <p className="font-bold">Local Active ID</p>
                      <p className="text-xs font-mono text-on-surface-variant opacity-60 truncate max-w-[200px]">
                        {keyStats.activeId || "Not generated"}
                      </p>
                    </div>
                    <Icon
                      name={hasLocalKeys ? "key" : "key_off"}
                      className={`text-2xl ${hasLocalKeys ? "text-primary" : "text-on-surface-variant"}`}
                    />
                  </div>
                  <div className="p-4 bg-surface-container-lowest rounded-2xl">
                    <p className="font-bold mb-1">Key Rotation</p>
                    <p className="text-sm text-on-surface-variant font-light leading-relaxed">
                      Whispr stores your local keyring on this device. Manual key rotation is not wired into this screen yet.
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-surface-container-low p-8 rounded-[3rem] border border-outline-variant/10">
                <h3 className="text-xl font-bold mb-6 text-error">Danger Zone</h3>
                <div className="space-y-3">
                  <button 
                    onClick={handleNuke}
                    disabled={isBusy}
                    className="w-full text-left p-6 bg-error-container/5 hover:bg-error-container/10 transition-colors rounded-[2rem] flex items-center justify-between group disabled:opacity-50"
                  >
                    <div>
                      <h4 className="font-bold text-error">Nuke Local Content</h4>
                      <p className="text-sm text-error/60 font-light">Wipes all messages and your local keyring. Cannot be undone.</p>
                    </div>
                    <Icon name="delete_forever" className="text-2xl text-error" />
                  </button>
                  <button 
                    onClick={handleRevokeSessions}
                    disabled={isBusy}
                    className="w-full text-left p-6 bg-surface-container-highest rounded-[2rem] flex items-center justify-between group disabled:opacity-50"
                  >
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
