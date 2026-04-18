"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createEncryptedMessage,
  deleteConversationMessages,
  ensureProfile,
  getActivePublicKey,
  getCurrentSupabaseUser,
  getPrivateKeyBackup,
  getPublicKeyById,
  listSupabaseUsers,
  listConversationMessages,
  loginWithGoogle,
  loginWithSupabase,
  logoutFromSupabase,
  readableSupabaseError,
  registerWithSupabase,
  savePrivateKeyBackup,
  subscribeToSupabaseAuth,
  subscribeToSupabaseMessages,
  subscribeToSupabaseProfiles,
  uploadPublicKeyForUser,
} from "@/lib/supabase-chat";
import {
  decryptIdentityBackup,
  encryptIdentityBackup,
  encryptMessage,
  generateLocalIdentity,
  hydrateStoredIdentity,
  serializeIdentity,
} from "@/lib/crypto";
import { decryptConversationMessages } from "@/lib/chat";
import { buildScopedStorageKey, readStoredJson, writeStoredJson } from "@/lib/storage";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { Sidebar } from "@/components/ui/Sidebar";
import { ChatWindow } from "@/components/ui/ChatWindow";
import { BottomNavBar } from "@/components/ui/BottomNavBar";

const LEGACY_APP_IDENTITY_KEY = "whispr-supabase-identity";
const APP_IDENTITY_KEY_PREFIX = "whispr-supabase-identity";
const APP_IDENTITY_KEY = LEGACY_APP_IDENTITY_KEY;

const INITIAL_AUTH_FORM = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function isIgnorableAuthScreenError(message) {
  return message === "Auth session missing!" || message === "Your session expired. Please log in again.";
}

function hasOauthCallbackParams() {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);

  return (
    searchParams.has("oauth") ||
    searchParams.has("code") ||
    searchParams.has("state") ||
    searchParams.has("error") ||
    window.location.hash.includes("access_token")
  );
}

function clearOauthCallbackUrl() {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

function resetWorkspaceState({
  setContacts,
  setSelectedPeer,
  setMessages,
  setMessageDraft,
  setIdentity,
}) {
  setContacts([]);
  setSelectedPeer(null);
  setMessages([]);
  setMessageDraft("");
  setIdentity(emptyIdentity());
}

function getResetFormState(mode, currentState) {
  if (mode === "register") {
    return { ...currentState, confirmPassword: "" };
  }

  return {
    ...currentState,
    username: "",
    confirmPassword: "",
  };
}

function isIdentityPublicKeyUploaded(identity, profile) {
  return Boolean(
    identity.currentKeyId &&
      profile?.activePublicKeyId &&
      profile.activePublicKeyId === identity.currentKeyId
  );
}

function emptyIdentity() {
  return {
    ready: false,
    publicKey: "",
    keyPair: null,
    currentKeyId: null,
    keyring: [],
    uploadedPublicKey: null,
    uploadedKeyId: null,
  };
}

function getAccountIdentityStorageKey(userId) {
  return buildScopedStorageKey(APP_IDENTITY_KEY_PREFIX, userId);
}

function canMigrateLegacyIdentity(storedIdentity, profile) {
  if (!storedIdentity?.publicKey || !profile?.publicKey) {
    return false;
  }

  return Boolean(
    profile.activePublicKeyId &&
      storedIdentity.currentKeyId &&
      profile.activePublicKeyId === storedIdentity.currentKeyId &&
      profile.publicKey === storedIdentity.publicKey
  );
}

function AuthFieldCard({ children, className = "" }) {
  return (
    <div
      className={`w-full border border-white/10 bg-emerald-950/30 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.15)] backdrop-blur-3xl ${className}`}
    >
      {children}
    </div>
  );
}

export default function AppSurface() {
  const KEY_PUBLISH_ERROR_PREFIX =
    "Whispr signed you in, but it could not publish your public key yet.";
  const MAX_KEY_PUBLISH_ATTEMPTS = 3;
  const [authMode, setAuthMode] = useState("login");
  const [formState, setFormState] = useState(INITIAL_AUTH_FORM);
  const [accountUser, setAccountUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [identity, setIdentity] = useState(emptyIdentity);
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [status, setStatus] = useState("Opening your secure workspace...");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isPublishingKey, setIsPublishingKey] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const selectedPeerRef = useRef(null);
  const accountUserRef = useRef(null);
  const profileRef = useRef(null);
  const identityRef = useRef(identity);
  const oauthStateRef = useRef(null);
  const keyPublishAttemptRef = useRef(0);
  const keyPublishTimerRef = useRef(null);
  const keyPublishInFlightRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const isSessionAuthenticated = Boolean(accountUser);
  const isProfileReady = Boolean(profile);
  const keyPublishError = error.startsWith(KEY_PUBLISH_ERROR_PREFIX) ? error : "";
  const screenError = keyPublishError ? "" : error;

  useEffect(() => {
    selectedPeerRef.current = selectedPeer;
    accountUserRef.current = accountUser;
    profileRef.current = profile;
    identityRef.current = identity;
  }, [selectedPeer, accountUser, profile, identity]);

  useEffect(() => {
    return () => {
      if (keyPublishTimerRef.current) {
        window.clearTimeout(keyPublishTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const oauthState =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("oauth")
            : null;

        oauthStateRef.current = oauthState;

        const user = await getCurrentSupabaseUser();
        let hydratedIdentity = emptyIdentity();
        let nextProfile = null;

        if (user) {
          // Small delay for OAuth users to give the trigger time to finish
          if (oauthState) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
          nextProfile = await ensureProfile(user);

          if (!nextProfile) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            nextProfile = await ensureProfile(user);
          }

          const storedIdentity = readStoredJson(getAccountIdentityStorageKey(user.id));
          const legacyIdentity = readStoredJson(LEGACY_APP_IDENTITY_KEY);

          if (storedIdentity) {
            hydratedIdentity = await hydrateStoredIdentity(storedIdentity);
          } else if (canMigrateLegacyIdentity(legacyIdentity, nextProfile)) {
            hydratedIdentity = await hydrateStoredIdentity(legacyIdentity);
          } else {
            hydratedIdentity = await generateLocalIdentity();
          }
        }

        if (cancelled) return;

        setIdentity(hydratedIdentity);
        setAccountUser(user);
        setProfile(nextProfile);

        // Only clear callback params after auth has actually been restored or the callback failed.
        if (
          typeof window !== "undefined" &&
          (user || oauthState === "google-failed") &&
          hasOauthCallbackParams()
        ) {
          clearOauthCallbackUrl();
        }

        if (oauthState === "google-failed") {
          setError("Google sign-in failed. Please try again.");
          setStatus("Google sign-in did not complete.");
          return;
        }

        if (!user && oauthState === "google") {
          setStatus("Completing Google sign-in...");
        }

        setStatus(
          oauthState === "google" && !user
            ? "Completing Google sign-in..."
            : user
            ? `Welcome back, ${nextProfile?.username || user.name}.`
            : "Log in or create an account to start a private conversation."
        );

        if (user && nextProfile) {
          // Only replace if we have query params to clean up, to avoid unnecessary re-mounts
          if (oauthState || typeof window !== "undefined" && window.location.search) {
            router.replace("/app");
          }
        }
      } catch (requestError) {
        if (!cancelled) {
          const nextError = readableSupabaseError(requestError);
          setError(isIgnorableAuthScreenError(nextError) ? "" : nextError);
          setStatus("Whispr needs Supabase auth and tables configured before chats can open.");
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    boot();
    return () => { cancelled = true; };
  }, [pathname, router]);

  useEffect(() => {
    const unsubscribe = subscribeToSupabaseAuth(async (user) => {
      try {
        if (!user) {
          setAccountUser(null);
          setProfile(null);
          resetWorkspaceState({
            setContacts,
            setSelectedPeer,
            setMessages,
            setMessageDraft,
            setIdentity,
          });
          keyPublishAttemptRef.current = 0;
          setStatus("Log in or create an account to start a private conversation.");
          return;
        }

        const nextProfile = await ensureProfile(user);
        setAccountUser(user);
        setProfile(nextProfile);
        setStatus(`Welcome back, ${nextProfile?.username || user.name}.`);

        if (hasOauthCallbackParams()) {
          clearOauthCallbackUrl();
        }
      } catch (requestError) {
        const nextError = readableSupabaseError(requestError);
        setError(isIgnorableAuthScreenError(nextError) ? "" : nextError);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasOauthCallbackParams()) {
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      if (cancelled || !hasOauthCallbackParams()) {
        return;
      }

      try {
        const user = await getCurrentSupabaseUser();

        if (user || window.location.hash.includes("access_token")) {
          clearOauthCallbackUrl();
        }
      } catch {
        if (window.location.hash.includes("access_token")) {
          clearOauthCallbackUrl();
        }
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!accountUser || !identity.ready || !identity.keyPair) return;
    serializeIdentity(identity).then(serialized => {
      writeStoredJson(getAccountIdentityStorageKey(accountUser.id), serialized);
    });
  }, [accountUser, identity]);

  const syncIdentityBackup = useCallback(async (userId, nextIdentity, password) => {
    if (!userId || !nextIdentity?.ready || !nextIdentity?.keyPair || !password) {
      return;
    }

    try {
      const encryptedBackup = await encryptIdentityBackup(nextIdentity, password);
      const updatedProfile = await savePrivateKeyBackup(userId, encryptedBackup);
      setProfile(updatedProfile);
    } catch (requestError) {
      console.error("[auth] encrypted backup sync failed", requestError);
    }
  }, []);

  const publishIdentityPublicKey = useCallback(async ({ manual = false } = {}) => {
    const currentUser = accountUserRef.current;
    const currentProfile = profileRef.current;
    const currentIdentity = identityRef.current;

    if (!currentUser || !currentProfile || !currentIdentity.ready || !currentIdentity.keyPair) {
      return false;
    }

    if (isIdentityPublicKeyUploaded(currentIdentity, currentProfile)) {
      keyPublishAttemptRef.current = 0;
      setIsPublishingKey(false);
      return true;
    }

    if (keyPublishInFlightRef.current) {
      return false;
    }

    keyPublishInFlightRef.current = true;
    setIsPublishingKey(true);
    setStatus(
      manual
        ? "Retrying your public key publish..."
        : "Publishing your public key..."
    );

    try {
      const updatedProfile = await uploadPublicKeyForUser({
        user: currentUser,
        profile: currentProfile,
        publicKey: currentIdentity.publicKey,
        keyId: currentIdentity.currentKeyId,
      });

      keyPublishAttemptRef.current = 0;
      setProfile(updatedProfile);
      setError((currentError) =>
        currentError.startsWith(KEY_PUBLISH_ERROR_PREFIX) ? "" : currentError
      );
      setStatus(`Welcome back, ${updatedProfile?.username || currentUser.name}.`);
      return true;
    } catch (requestError) {
      const readableError = readableSupabaseError(requestError);
      setError(`${KEY_PUBLISH_ERROR_PREFIX} ${readableError}`);
      setStatus("Signed in, but your public key still needs to be published.");
      console.error("[auth] Identity sync failed:", requestError);
      return false;
    } finally {
      keyPublishInFlightRef.current = false;
      setIsPublishingKey(false);
    }
  }, []);

  const refreshContacts = useCallback(async () => {
    if (!accountUserRef.current) {
      setContacts([]);
      return;
    }
    try {
      const users = await listSupabaseUsers(searchQuery, accountUserRef.current.id);
      setContacts(users);
      if (!selectedPeerRef.current && users.length > 0) {
        setSelectedPeer(users.find((user) => user.hasPublicKey) || users[0]);
      }
    } catch (requestError) {
      setError(readableSupabaseError(requestError));
    }
  }, [searchQuery]);

  useEffect(() => {
    refreshContacts();
  }, [accountUser?.id, refreshContacts]);

  useEffect(() => {
    if (!accountUser || !profile || !identity.ready || !identity.keyPair) {
      return undefined;
    }

    if (isIdentityPublicKeyUploaded(identity, profile)) {
      keyPublishAttemptRef.current = 0;
      if (keyPublishTimerRef.current) {
        window.clearTimeout(keyPublishTimerRef.current);
        keyPublishTimerRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;

    async function syncWithRetry() {
      const success = await publishIdentityPublicKey();

      if (success || cancelled) {
        return;
      }

      keyPublishAttemptRef.current += 1;

      if (keyPublishAttemptRef.current >= MAX_KEY_PUBLISH_ATTEMPTS) {
        return;
      }

      const nextAttempt = keyPublishAttemptRef.current + 1;
      setStatus(`Retrying public key publish (${nextAttempt}/${MAX_KEY_PUBLISH_ATTEMPTS})...`);
      keyPublishTimerRef.current = window.setTimeout(() => {
        syncWithRetry();
      }, 1500 * keyPublishAttemptRef.current);
    }

    syncWithRetry();

    return () => {
      cancelled = true;
      if (keyPublishTimerRef.current) {
        window.clearTimeout(keyPublishTimerRef.current);
        keyPublishTimerRef.current = null;
      }
    };
  }, [
    accountUser,
    identity,
    identity.currentKeyId,
    identity.keyPair,
    identity.publicKey,
    identity.ready,
    profile,
    profile?.activePublicKeyId,
    publishIdentityPublicKey,
  ]);

  const refreshConversation = useCallback(async () => {
    const currentUser = accountUserRef.current;
    const currentProfile = profileRef.current;
    const currentIdentity = identityRef.current;
    const peer = selectedPeerRef.current;

    if (!currentUser || !currentProfile || !currentIdentity.keyPair || !peer?.username) {
      setMessages([]);
      return;
    }

    try {
      const peerUserId = peer.id || peer.userId;

      if (!peerUserId) {
        throw new Error("peer_not_found");
      }

      const encryptedMessages = await listConversationMessages(currentUser.id, peerUserId);
      const decryptedMessages = await decryptConversationMessages({
        messages: encryptedMessages,
        selfUsername: currentProfile.username,
        selfIdentity: currentIdentity,
        resolvePublicKey: async ({ username, keyId }) => {
          if (keyId) {
            const result = await getPublicKeyById(keyId);
            return result.publicKey;
          }
          const result = await getActivePublicKey(username);
          return result.publicKey;
        },
      });
      setMessages(decryptedMessages);
    } catch (requestError) {
      setError(readableSupabaseError(requestError));
    }
  }, []);

  useEffect(() => {
    refreshConversation();
  }, [refreshConversation, selectedPeer?.username, identity.currentKeyId, profile?.username]);

  useEffect(() => {
    if (!accountUser) return undefined;
    const unsubscribeMessages = subscribeToSupabaseMessages(() => refreshConversation());
    const unsubscribeProfiles = subscribeToSupabaseProfiles(() => refreshContacts());
    
    // Fallback polling for extra reliability
    const intervalId = window.setInterval(() => {
      refreshConversation();
      refreshContacts();
    }, 10000);

    return () => {
      unsubscribeMessages?.();
      unsubscribeProfiles?.();
      window.clearInterval(intervalId);
    };
  }, [accountUser, refreshConversation, refreshContacts]);

  async function restoreBackupIfAvailable(user, password, fallbackIdentity) {
    try {
      const backup = await getPrivateKeyBackup(user.id);

      if (!backup) {
        console.info("[auth] no encrypted backup found", { userId: user.id });
        return fallbackIdentity;
      }

      const restoredIdentity = await decryptIdentityBackup(backup, password);
      console.info("[auth] restored encrypted backup", {
        userId: user.id,
        keyCount: restoredIdentity.keyring?.length || 0,
      });
      setStatus("Restored your encrypted key backup.");
      return restoredIdentity;
    } catch (e) {
      console.error("[auth] backup restore failed, continuing with local identity", e);
      setStatus("Log in successful, but key backup couldn't be unlocked.");
      return fallbackIdentity;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setIsBusy(true);
    try {
      if (authMode === "register" && formState.password !== formState.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      const payload = {
        username: normalizeUsername(formState.username),
        email: formState.email.trim().toLowerCase(),
        password: formState.password,
      };
      const result = authMode === "register"
        ? await registerWithSupabase(payload)
        : await loginWithSupabase(payload);
      console.info("[auth] authentication succeeded", {
        mode: authMode,
        userId: result.user?.id,
        hasProfile: Boolean(result.profile),
      });

      setAccountUser(result.user);
      setProfile(result.profile);
      const storedIdentity = readStoredJson(getAccountIdentityStorageKey(result.user.id));
      const localIdentity = storedIdentity
        ? await hydrateStoredIdentity(storedIdentity)
        : await generateLocalIdentity();
      const nextIdentity = await restoreBackupIfAvailable(result.user, payload.password, localIdentity);
      setIdentity(nextIdentity);
      await syncIdentityBackup(result.user.id, nextIdentity, payload.password);

      if (result.profile?.username) {
        setStatus(`Welcome back, ${result.profile.username}.`);
      } else {
        setStatus("Authenticated successfully. Preparing your secure workspace...");
      }

      router.replace("/app");
    } catch (e) {
      console.error("[auth] authentication flow failed", e);
      setError(readableSupabaseError(e));
    } finally {
      setIsBusy(false);
    }
  }

  function handleAuthModeChange(mode) {
    setAuthMode(mode);
    setError("");
    setFormState((currentState) => getResetFormState(mode, currentState));
  }

  async function handleGoogleAuth() {
    setError("");
    setStatus("Redirecting to Google...");
    setIsBusy(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      setError(readableSupabaseError(e));
      setIsBusy(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const draft = messageDraft.trim();
    if (!selectedPeer || !draft) return;

    if (!isIdentityPublicKeyUploaded(identityRef.current, profileRef.current)) {
      setError(
        `${KEY_PUBLISH_ERROR_PREFIX} Wait for your key publish to finish before sending messages.`
      );
      return;
    }

    setError("");
    setIsBusy(true);
    try {
      const currentProfile = profileRef.current;
      const currentIdentity = identityRef.current;
      const receiver = await getActivePublicKey(selectedPeer.username);
      const encryptedMessage = await encryptMessage({
        plaintext: draft,
        senderIdentity: currentIdentity,
        receiverPublicKey: receiver.publicKey,
      });
      await createEncryptedMessage({
        sender: accountUserRef.current,
        senderProfile: currentProfile,
        receiver,
        encryptedMessage,
      });
      setMessageDraft("");
    } catch (e) {
      setError(readableSupabaseError(e));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setIsBusy(true);
    try {
      await logoutFromSupabase();
      setAccountUser(null);
      setProfile(null);
      resetWorkspaceState({
        setContacts,
        setSelectedPeer,
        setMessages,
        setMessageDraft,
        setIdentity,
      });
      keyPublishAttemptRef.current = 0;
      setError("");
      setStatus("Log in or create an account to start a private conversation.");
      router.replace("/");
    } catch (e) {
      setError(readableSupabaseError(e));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteConversation() {
    const currentUser = accountUserRef.current;
    const peer = selectedPeerRef.current;

    if (!currentUser || !peer?.username) {
      return;
    }

    if (!window.confirm(`Delete the chat with ${peer.username}? This removes the conversation for your account.`)) {
      return;
    }

    setError("");
    setIsDeletingConversation(true);

    try {
      const peerUserId = peer.id || peer.userId;

      if (!peerUserId) {
        throw new Error("peer_not_found");
      }

      await deleteConversationMessages(currentUser.id, peerUserId);
      setMessages([]);
      setStatus(`Deleted the chat with ${peer.username}.`);
      refreshContacts();
    } catch (requestError) {
      setError(readableSupabaseError(requestError));
    } finally {
      setIsDeletingConversation(false);
    }
  }

  return (
    <main className="h-screen w-full flex flex-col overflow-hidden bg-surface text-on-surface">
      {isBooting ? (
        <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(180deg,_#071827,_#020817_68%)] px-6 text-slate-100">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Whispr</p>
            <h1 className="mt-4 text-4xl font-semibold text-white animate-pulse">Initializing...</h1>
          </div>
        </section>
      ) : !isSessionAuthenticated ? (
        <section className="relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden text-silver-100 font-body">
          <div
            className="fixed inset-0"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(2, 44, 34, 0.95) 0%, rgba(2, 44, 34, 0.4) 60%, rgba(2, 44, 34, 0.2) 100%), url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2070')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="pointer-events-none fixed inset-0 bg-black/10" />
          <div className="pointer-events-none fixed left-0 top-0 h-full w-[40vw] bg-emerald-950/45 blur-[120px]" />
          <div className="absolute left-6 top-5 z-[120] md:left-10 md:top-7 lg:left-14 lg:top-8">
            <span className="font-display text-2xl font-medium tracking-[0.08em] text-white/95 md:text-3xl">
              Whispr
            </span>
          </div>
           
          <div className="relative flex min-h-screen flex-col items-start justify-start gap-8 px-6 pt-10 pb-8 md:px-14 md:pt-10 lg:h-[100dvh] lg:min-h-0 lg:flex-row lg:items-center lg:gap-20 lg:px-20 lg:py-8">
            <div className="w-full max-w-2xl shrink-0 text-left lg:max-w-3xl">
              <div className="space-y-4 lg:space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/6 px-4 py-1.5 text-[10px] uppercase tracking-[0.34em] text-white/75 backdrop-blur-2xl">
                  <span>Whispr</span>
                  <span className="h-1 w-1 rounded-full bg-white/45" />
                  <span>Private by default</span>
                </div>

                <div className="space-y-3">
                  <p className="font-display text-sm italic tracking-[0.1em] text-white/75 md:text-base">
                    A calmer place for private communication
                  </p>
                  <h1 className="font-display max-w-4xl text-[clamp(2.35rem,5.3vw,4.6rem)] font-light leading-[0.98] tracking-[-0.028em] text-white">
                    Quiet conversations,
                    <br />
                    local keys,
                    <br />
                    no digital crowd.
                  </h1>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-px w-12 bg-gradient-to-r from-white/70 to-transparent" />
                  <p className="text-[10px] uppercase tracking-[0.42em] text-slate-200/80">
                    Crafted for focused circles
                  </p>
                </div>

                <p className="font-display max-w-2xl text-base italic leading-relaxed text-white/72 font-light lg:max-w-3xl">
                  Whispr keeps identity lightweight and encryption local, so the experience feels
                  more like entering a private room than joining another noisy feed.
                </p>

                <div className="flex flex-wrap gap-2 pt-1 text-[10px] uppercase tracking-[0.22em] text-white/80">
                  <span className="rounded-full border border-white/12 bg-white/7 px-3 py-1.5 backdrop-blur-xl">
                    No phone number
                  </span>
                  <span className="rounded-full border border-white/12 bg-white/7 px-3 py-1.5 backdrop-blur-xl">
                    Local encryption keys
                  </span>
                  <span className="rounded-full border border-white/12 bg-white/7 px-3 py-1.5 backdrop-blur-xl">
                    Minimal metadata
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-auto w-full max-w-sm shrink-0 md:ml-auto md:mr-4 lg:mr-10 lg:pt-0">
              <div className="relative z-[100] inline-flex rounded-full bg-white/10 p-1 text-sm text-white/50 backdrop-blur-3xl shadow-xl">
                {["login", "register"].map((mode) => (
                  <button
                    key={`${mode}-toggle-button`}
                    type="button"
                    onClick={() => handleAuthModeChange(mode)}
                    className={`relative z-[110] rounded-full px-7 py-2 transition-all duration-300 font-medium ${
                      authMode === mode 
                      ? "bg-white/25 text-white shadow-lg scale-105" 
                      : "text-white/40 hover:text-white/80"
                    }`}
                  >
                    {mode === "login" ? "Login" : "Register"}
                  </button>
                ))}
              </div>

              <div className="mt-5 w-full">
                <form onSubmit={handleAuthSubmit} className="flex w-full flex-col items-start translate-y-0">
                  <div className="w-full space-y-0 relative">
                    {authMode === "register" && (
                      <AuthFieldCard className="rounded-bl-[1.5rem] rounded-tr-[3rem] relative z-30">
                        <label className="sr-only" htmlFor="auth-username">Username</label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-0 top-1 text-white/30">
                            <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current fill-none">
                              <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeWidth="1.5" />
                              <path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </span>
                          <input
                            id="auth-username"
                            type="text"
                            value={formState.username}
                            onChange={(e) => setFormState(s => ({ ...s, username: normalizeUsername(e.target.value) }))}
                            className="w-full border-0 border-b border-white/20 bg-transparent py-2.5 pl-10 pr-2 text-sm tracking-[0.18em] text-white placeholder:text-white/20 focus:border-white/50 focus:outline-none focus:ring-0"
                            placeholder="quiet-name"
                            required
                          />
                        </div>
                      </AuthFieldCard>
                    )}
                    
                    <AuthFieldCard className={`w-full rounded-bl-[1.5rem] rounded-tr-[4rem] relative z-20 ${authMode === "register" ? "-mt-4 md:translate-x-2" : "md:-translate-x-5 md:-rotate-1"}`}>
                      <label className="sr-only" htmlFor="auth-email">Email</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-0 top-1 text-white/30">
                          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current fill-none">
                            <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.5" />
                            <path d="m3 7 9 6 9-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <input
                          id="auth-email"
                          type="email"
                          value={formState.email}
                          onChange={(e) => setFormState(s => ({ ...s, email: e.target.value }))}
                          className="w-full border-0 border-b border-white/20 bg-transparent py-2.5 pl-10 pr-2 text-sm tracking-[0.18em] text-white placeholder:text-white/20 focus:border-white/50 focus:outline-none focus:ring-0"
                          placeholder="your@essence.com"
                          required
                        />
                      </div>
                    </AuthFieldCard>

                    <AuthFieldCard className={`relative z-10 w-full rounded-br-[5rem] rounded-tl-[1.5rem] -mt-4 ${authMode === "register" ? "md:-translate-x-2" : "md:translate-x-4 md:rotate-1"}`}>
                      <label className="sr-only" htmlFor="auth-password">Password</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-0 top-1 text-white/30">
                          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current fill-none">
                            <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="1.5" />
                            <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </span>
                        <input
                          id="auth-password"
                          type="password"
                          value={formState.password}
                          onChange={(e) => setFormState(s => ({ ...s, password: e.target.value }))}
                          className="w-full border-0 border-b border-white/20 bg-transparent py-2.5 pl-10 pr-2 text-sm tracking-[0.18em] text-white placeholder:text-white/20 focus:border-white/50 focus:outline-none focus:ring-0"
                          placeholder={authMode === "register" ? "Choose your quiet passphrase" : "Secret mantra"}
                          required
                        />
                      </div>
                    </AuthFieldCard>

                    {authMode === "register" && (
                      <AuthFieldCard className="relative z-0 w-full rounded-bl-[1.5rem] rounded-tr-[3rem] -mt-4 md:translate-x-1">
                        <label className="sr-only" htmlFor="auth-confirm-password">Confirm Password</label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-0 top-1 text-white/30">
                            <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current fill-none">
                              <path d="m5 12 4 4L19 6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <input
                            id="auth-confirm-password"
                            type="password"
                            value={formState.confirmPassword}
                            onChange={(e) => setFormState(s => ({ ...s, confirmPassword: e.target.value }))}
                            className="w-full border-0 border-b border-white/20 bg-transparent py-2.5 pl-10 pr-2 text-sm tracking-[0.18em] text-white placeholder:text-white/20 focus:border-white/50 focus:outline-none focus:ring-0"
                            placeholder="Echo it once more"
                            required
                          />
                        </div>
                      </AuthFieldCard>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="font-display mt-6 w-full rounded-full bg-slate-100 py-4 text-sm font-bold uppercase tracking-[0.32em] text-emerald-950 shadow-2xl transition duration-300 hover:-translate-y-1 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authMode === "register" ? "Create Account" : "Begin Journey"}
                  </button>

                  <div className="mt-6 flex w-full items-center gap-4 text-[9px] uppercase tracking-[0.42em] text-white/20">
                    <div className="h-px flex-1 bg-white/10" />
                    <span>OR</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isBusy}
                    className="mt-5 flex w-full items-center justify-center gap-4 rounded-full border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold tracking-[0.18em] text-white backdrop-blur-2xl transition duration-300 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 shadow-inner"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#4285F4]">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
                      </svg>
                    </span>
                    <span>AUTHORIZE ACCESS</span>
                  </button>

                  <p className="mt-5 w-full text-center text-[8px] leading-relaxed tracking-[0.18em] text-white/30 uppercase max-w-[280px]">
                    Biometric or OAuth identity required. Encryption keys remain local.
                  </p>

                  {screenError ? (
                    <p className="mt-4 text-sm text-red-100 bg-red-400/20 p-4 rounded-2xl w-full text-center">
                      {screenError}
                    </p>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </section>
      ) : !isProfileReady ? (
        <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(180deg,_#071827,_#020817_68%)] px-6 text-slate-100">
          <div className="max-w-xl text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Whispr</p>
            <h1 className="mt-4 text-3xl font-semibold text-white">Preparing your secure workspace...</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Your account is authenticated. Whispr is restoring your chat profile before opening the inbox.
            </p>
            {screenError ? (
              <p className="mt-6 rounded-2xl bg-red-400/20 p-4 text-sm text-red-100">{screenError}</p>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <TopAppBar onLogout={handleLogout} />
          {(!isIdentityPublicKeyUploaded(identity, profile) || isPublishingKey || keyPublishError) ? (
            <section className="border-b border-outline-variant/40 bg-surface-container/80 px-4 py-3">
              <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-on-surface">
                  <p className="font-semibold">
                    {isPublishingKey
                      ? "Publishing your public key..."
                      : isIdentityPublicKeyUploaded(identity, profile)
                      ? "Workspace ready."
                      : "Your public key is not published yet."}
                  </p>
                  {keyPublishError ? (
                    <p className="mt-1 text-on-surface-variant">{keyPublishError}</p>
                  ) : !isIdentityPublicKeyUploaded(identity, profile) ? (
                    <p className="mt-1 text-on-surface-variant">
                      Other members will see this account as &quot;no key&quot; until publish finishes.
                    </p>
                  ) : null}
                </div>
                {!isIdentityPublicKeyUploaded(identity, profile) ? (
                  <button
                    type="button"
                    onClick={() => publishIdentityPublicKey({ manual: true })}
                    disabled={isPublishingKey}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPublishingKey ? "Publishing..." : "Retry Key Publish"}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
          <main className="flex-1 flex overflow-hidden pb-24 md:pb-0 w-full">
            <Sidebar 
              contacts={contacts} 
              selectedPeer={selectedPeer} 
              onSelectPeer={setSelectedPeer} 
            />
            <ChatWindow 
              peer={selectedPeer}
              messages={messages}
              messageDraft={messageDraft}
              onMessageChange={setMessageDraft}
              onSendMessage={handleSendMessage}
              onDeleteConversation={handleDeleteConversation}
              isBusy={isBusy}
              canSend={Boolean(
                selectedPeer?.hasPublicKey &&
                  isIdentityPublicKeyUploaded(identity, profile)
              )}
              isDeletingConversation={isDeletingConversation}
            />
          </main>
          <BottomNavBar />
        </>
      )}
    </main>
  );
}
