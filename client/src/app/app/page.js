"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { MessageList } from "@/components/message-list";
import {
  createEncryptedMessage,
  ensureProfile,
  getActivePublicKey,
  getCurrentAppwriteUser,
  getPrivateKeyBackup,
  getPublicKeyById,
  listAppwriteUsers,
  listConversationMessages,
  loginWithAppwrite,
  logoutFromAppwrite,
  readableAppwriteError,
  registerWithAppwrite,
  savePrivateKeyBackup,
  subscribeToAppwriteMessages,
  uploadPublicKeyForUser,
} from "@/lib/appwrite-chat";
import {
  decryptIdentityBackup,
  encryptIdentityBackup,
  encryptMessage,
  generateLocalIdentity,
  hydrateStoredIdentity,
  serializeIdentity,
} from "@/lib/crypto";
import {
  decryptConversationMessages,
} from "@/lib/chat";
import { readStoredJson, writeStoredJson } from "@/lib/storage";

const APP_IDENTITY_KEY = "whispr-appwrite-identity";

const INITIAL_AUTH_FORM = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function isIdentityPublicKeyUploaded(identity, profile) {
  return Boolean(
    identity.currentKeyId &&
      profile?.activePublicKeyId &&
      profile.activePublicKeyId === identity.currentKeyId
  );
}

function getInitials(value = "") {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "W";
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

export default function AppSurface() {
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
  const authSecretRef = useRef("");
  const selectedPeerRef = useRef(null);
  const accountUserRef = useRef(null);
  const profileRef = useRef(null);
  const identityRef = useRef(identity);

  useEffect(() => {
    selectedPeerRef.current = selectedPeer;
  }, [selectedPeer]);

  useEffect(() => {
    accountUserRef.current = accountUser;
  }, [accountUser]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const storedIdentity = readStoredJson(APP_IDENTITY_KEY);
        const hydratedIdentity = await hydrateStoredIdentity(storedIdentity);
        const user = await getCurrentAppwriteUser();
        let nextProfile = null;

        if (user) {
          nextProfile = await ensureProfile(user);
        }

        if (cancelled) {
          return;
        }

        setIdentity(hydratedIdentity);
        setAccountUser(user);
        setProfile(nextProfile);
        setStatus(
          user
            ? `Welcome back, ${nextProfile?.username || user.name}.`
            : "Log in or create an account to start a private conversation."
        );
      } catch (requestError) {
        if (!cancelled) {
          setError(readableAppwriteError(requestError));
          setStatus("Whispr needs cloud storage setup before chats can open.");
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function persistIdentity() {
      if (!identity.ready || !identity.keyPair) {
        return;
      }

      const serializedIdentity = await serializeIdentity(identity);

      if (!cancelled) {
        writeStoredJson(APP_IDENTITY_KEY, serializedIdentity);
      }
    }

    persistIdentity();

    return () => {
      cancelled = true;
    };
  }, [identity]);

  const refreshContacts = useCallback(async () => {
    if (!accountUserRef.current) {
      setContacts([]);
      return;
    }

    try {
      const users = await listAppwriteUsers(searchQuery, accountUserRef.current.$id);

      setContacts(users);

      if (!selectedPeerRef.current && users.length > 0) {
        setSelectedPeer(users.find((user) => user.hasPublicKey) || users[0]);
      }
    } catch (requestError) {
      setError(readableAppwriteError(requestError));
    }
  }, [searchQuery]);

  useEffect(() => {
    refreshContacts();
  }, [accountUser?.$id, refreshContacts]);

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
      const activePeerKey = await getActivePublicKey(peer.username);
      const encryptedMessages = await listConversationMessages(
        currentUser.$id,
        activePeerKey.userId
      );
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
      setError(readableAppwriteError(requestError));
    }
  }, []);

  useEffect(() => {
    refreshConversation();
  }, [refreshConversation, selectedPeer?.username, identity.currentKeyId, profile?.username]);

  useEffect(() => {
    if (!accountUser) {
      return undefined;
    }

    const unsubscribe = subscribeToAppwriteMessages(() => {
      refreshConversation();
    });
    const intervalId = window.setInterval(refreshConversation, 8000);

    return () => {
      unsubscribe?.();
      window.clearInterval(intervalId);
    };
  }, [accountUser, refreshConversation]);

  async function restoreBackupIfAvailable(user, password, fallbackIdentity) {
    const backup = await getPrivateKeyBackup(user.$id);

    if (!backup) {
      return fallbackIdentity;
    }

    try {
      const restoredIdentity = await decryptIdentityBackup(backup, password);
      setStatus("Restored your encrypted key backup for this device.");
      return restoredIdentity;
    } catch (backupError) {
      console.error("[keys] backup restore failed", backupError);
      setStatus("Logged in, but the encrypted key backup could not be unlocked with this password.");
      return fallbackIdentity;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");
    setIsBusy(true);

    try {
      if (authMode === "register" && formState.password !== formState.confirmPassword) {
        setError("Confirm password must match your password.");
        return;
      }

      const payload = {
        username: normalizeUsername(formState.username),
        email: formState.email.trim().toLowerCase(),
        password: formState.password,
      };
      const result =
        authMode === "register"
          ? await registerWithAppwrite(payload)
          : await loginWithAppwrite(payload);
      const nextIdentity = await restoreBackupIfAvailable(
        result.user,
        payload.password,
        identityRef.current
      );

      authSecretRef.current = payload.password;
      setAccountUser(result.user);
      setProfile(result.profile);
      setIdentity(nextIdentity);
      setFormState({ ...INITIAL_AUTH_FORM, email: payload.email });
      setStatus(
        authMode === "register"
          ? `Account created. Welcome to Whispr, ${result.profile.username}.`
          : `Welcome back, ${result.profile.username}.`
      );
    } catch (requestError) {
      setError(readableAppwriteError(requestError));
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadCurrentKey(options = {}) {
    const { showStatus = true } = options;
    const currentUser = accountUserRef.current;
    const currentProfile = profileRef.current;
    const currentIdentity = identityRef.current;

    if (!currentUser || !currentProfile || !currentIdentity.publicKey) {
      throw new Error("key_not_ready");
    }

    const updatedProfile = await uploadPublicKeyForUser({
      user: currentUser,
      profile: currentProfile,
      publicKey: currentIdentity.publicKey,
      keyId: currentIdentity.currentKeyId,
    });
    const nextIdentity = {
      ...currentIdentity,
      uploadedPublicKey: currentIdentity.publicKey,
      uploadedKeyId: updatedProfile.activePublicKeyId,
    };

    if (authSecretRef.current) {
      const backup = await encryptIdentityBackup(nextIdentity, authSecretRef.current);
      const profileWithBackup = await savePrivateKeyBackup(currentUser.$id, backup);
      setProfile(profileWithBackup);
      profileRef.current = profileWithBackup;
    } else {
      setProfile(updatedProfile);
      profileRef.current = updatedProfile;
    }

    setIdentity(nextIdentity);
    identityRef.current = nextIdentity;
    await refreshContacts();

    if (showStatus) {
      setStatus(
        authSecretRef.current
          ? "Your active public key is online and your encrypted key backup is refreshed."
          : "Your active public key is online. Log in again later to refresh encrypted backup."
      );
    }

    return {
      profile: profileRef.current,
      identity: nextIdentity,
    };
  }

  async function handleUploadKey() {
    setError("");
    setIsBusy(true);

    try {
      await uploadCurrentKey();
    } catch (requestError) {
      setError(readableAppwriteError(requestError));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRegenerateKey() {
    setError("");
    setIsBusy(true);

    try {
      const nextIdentity = await generateLocalIdentity(identityRef.current);

      setIdentity(nextIdentity);
      setStatus("Generated a new key. Old keys stayed in your local keyring for old messages.");
    } catch (requestError) {
      setError(readableAppwriteError(requestError));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!selectedPeer || !messageDraft.trim()) {
      return;
    }

    setError("");
    setIsBusy(true);

    try {
      let currentProfile = profileRef.current;
      let currentIdentity = identityRef.current;

      if (!isIdentityPublicKeyUploaded(currentIdentity, currentProfile)) {
        const uploaded = await uploadCurrentKey({ showStatus: false });
        currentProfile = uploaded.profile;
        currentIdentity = uploaded.identity;
      }

      const receiver = await getActivePublicKey(selectedPeer.username);
      const encryptedMessage = await encryptMessage({
        plaintext: messageDraft,
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
      setStatus(`Sent an encrypted message to ${receiver.username}.`);
      await refreshConversation();
    } catch (requestError) {
      setError(readableAppwriteError(requestError));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setError("");
    setIsBusy(true);

    try {
      await logoutFromAppwrite();
      authSecretRef.current = "";
      setAccountUser(null);
      setProfile(null);
      setContacts([]);
      setSelectedPeer(null);
      setMessages([]);
      setStatus("Logged out. Your local keyring stays on this browser for old messages.");
    } catch (requestError) {
      setError(readableAppwriteError(requestError));
    } finally {
      setIsBusy(false);
    }
  }

  const isAuthenticated = Boolean(accountUser && profile);
  const isCurrentKeyUploaded = isIdentityPublicKeyUploaded(identity, profile);
  const verifiedMessageCount = useMemo(
    () => messages.filter((message) => message.integrityStatus === "verified").length,
    [messages]
  );
  const hasUnreadableMessages = messages.some(
    (message) => message.integrityStatus !== "verified"
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#071315] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,_rgba(94,234,212,0.24),_transparent_26%),radial-gradient(circle_at_80%_0%,_rgba(250,204,21,0.12),_transparent_22%),linear-gradient(135deg,_rgba(8,47,73,0.82),_rgba(2,6,23,0.98)_60%)]" />
      <div
        className={
          isAuthenticated
            ? "relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8"
            : "relative min-h-screen w-full"
        }
      >
        {!isAuthenticated ? (
          <section className="grid min-h-screen w-full overflow-hidden bg-[#0a0f18] lg:grid-cols-[0.9_1.1]">
            {/* Left Panel: Auth Form */}
            <div className="flex flex-col justify-between px-8 py-10 sm:px-16 sm:py-16 lg:px-20 lg:py-20">
              <div className="w-full max-w-[28rem]">
                {/* Auth Mode Toggle */}
                <div className="inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
                  {["login", "register"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAuthMode(mode)}
                      className={`rounded-full px-5 py-2 text-xs font-medium tracking-wide uppercase transition ${
                        authMode === mode 
                          ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20" 
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="mt-16">
                  <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
                    {authMode === "register" ? "Join Whispr" : "Login"}
                  </h1>
                  <p className="mt-4 text-base leading-relaxed text-slate-400">
                    {authMode === "register"
                      ? "Create your private encrypted space in seconds."
                      : "See your private chats and restore your secure keyring."}
                  </p>
                </div>

                {/* Google Login Placeholder */}
                <button
                  type="button"
                  disabled
                  className="group mt-10 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Sign in with Google</span>
                  <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase text-white/40">Soon</span>
                </button>

                <form onSubmit={handleAuthSubmit} className="mt-10 space-y-6">
                  {authMode === "register" && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Username*</label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={formState.username}
                          onChange={(e) => setFormState(s => ({ ...s, username: normalizeUsername(e.target.value) }))}
                          className="w-full rounded-2xl bg-white/5 px-5 py-4 text-sm text-white placeholder:text-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/8 focus:ring-white/30"
                          placeholder="johndoe"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Email*</label>
                    <div className="relative group">
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(e) => setFormState(s => ({ ...s, email: e.target.value }))}
                        className="w-full rounded-2xl bg-white/5 px-5 py-4 text-sm text-white placeholder:text-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/8 focus:ring-white/30"
                        placeholder="mail@website.com"
                        required
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none group-focus-within:opacity-40 transition">
                        <svg className="h-5 w-5 stroke-white fill-none" viewBox="0 0 24 24">
                          <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.5" />
                          <path d="M3 7L12 13L21 7" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Password*</label>
                    <div className="relative group">
                      <input
                        type="password"
                        value={formState.password}
                        onChange={(e) => setFormState(s => ({ ...s, password: e.target.value }))}
                        className="w-full rounded-2xl bg-white/5 px-5 py-4 text-sm text-white placeholder:text-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/8 focus:ring-white/30"
                        placeholder="Min. 8 characters"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>

                  {authMode === "register" && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Confirm Password*</label>
                      <input
                        type="password"
                        value={formState.confirmPassword}
                        onChange={(e) => setFormState(s => ({ ...s, confirmPassword: e.target.value }))}
                        className="w-full rounded-2xl bg-white/5 px-5 py-4 text-sm text-white placeholder:text-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/8 focus:ring-white/30"
                        placeholder="Re-enter password"
                        required
                        minLength={8}
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="w-full rounded-2xl bg-[linear-gradient(135deg,#6366f1_0%,#4f46e5_100%)] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {authMode === "register" ? "Create Account" : "Login"}
                    </button>

                    {error && (
                      <p className="mt-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-xs font-medium text-rose-300">
                        {error}
                      </p>
                </div>
                <div className="absolute left-[33%] top-[31%] h-40 w-40 rotate-[24deg] bg-[radial-gradient(circle_at_44%_42%,rgba(255,190,96,0.98),rgba(136,82,48,0.78)_36%,rgba(37,32,39,0.98)_85%)] shadow-[0_0_65px_rgba(255,178,77,0.32)]" />

                <div className="absolute bottom-[16%] left-[43%] h-48 w-28 -rotate-[34deg] rounded-[0.3rem] bg-[linear-gradient(180deg,#2e242e_0%,#140d13_100%)] shadow-[0_30px_55px_rgba(0,0,0,0.45)]" />
                <div className="absolute bottom-[6%] right-[9%] h-56 w-44 rotate-[28deg] rounded-[0.2rem] bg-[linear-gradient(145deg,#2b2c36_0%,#17171f_60%,#0f1116_100%)] shadow-[0_40px_80px_rgba(0,0,0,0.5)]" />
                <div className="absolute bottom-[17%] left-[37%] h-14 w-14 rounded-full bg-[#9c7a5b] opacity-70" />
                <div className="absolute bottom-0 inset-x-0 h-28 bg-[radial-gradient(circle_at_50%_0%,rgba(247,176,108,0.17),transparent_45%)]" />
            </div>
          </section>
        ) : (
          <>
            <header className="mb-5 flex items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/8 px-5 py-4 shadow-2xl shadow-slate-950/30 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-lg font-black text-slate-950">
                  W
                </div>
                <div>
                  <p className="text-xl font-semibold tracking-tight text-white">Whispr</p>
                  <p className="text-sm text-slate-400">Private messages for people, not dashboards.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-white">{profile.username}</p>
                  <p className="text-xs text-slate-400">{accountUser?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isBusy}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Log out
                </button>
              </div>
            </header>

            <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 shadow-2xl shadow-slate-950/25 backdrop-blur">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 font-black text-slate-950">
                    {getInitials(profile.username)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">@{profile.username}</p>
                    <p className="truncate text-sm text-slate-400">{accountUser?.email}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleUploadKey}
                    disabled={isBusy}
                    className={`rounded-2xl px-3 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isCurrentKeyUploaded
                        ? "bg-emerald-400/15 text-emerald-100"
                        : "bg-amber-300 text-slate-950 hover:bg-amber-200"
                    }`}
                  >
                    {isCurrentKeyUploaded ? "Key synced" : "Sync key"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    disabled={isBusy}
                    className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3 font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    New key
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  {profile.hasPrivateKeyBackup
                    ? "Encrypted key backup is ready for this account."
                    : "Sync your key once to enable encrypted backup."}
                </p>
              </div>

              <div className="border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Chats</p>
                  <StatusBadge tone="neutral">{contacts.length}</StatusBadge>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(normalizeUsername(event.target.value))}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  placeholder="Search people"
                />
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {contacts.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm leading-6 text-slate-400">
                    No people yet. Ask a friend to create a Whispr account, then search their username.
                  </p>
                ) : (
                  contacts.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedPeer(user)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        selectedPeer?.username === user.username
                          ? "bg-cyan-300 text-slate-950"
                          : "text-slate-200 hover:bg-white/8"
                      }`}
                    >
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-black ${
                          selectedPeer?.username === user.username
                            ? "bg-slate-950 text-cyan-200"
                            : "bg-white/10 text-white"
                        }`}
                      >
                        {getInitials(user.username)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{user.username}</span>
                        <span className={`block text-xs ${selectedPeer?.username === user.username ? "text-slate-700" : "text-slate-500"}`}>
                          {user.hasPublicKey ? "Ready to receive" : "Waiting for key"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#f7f0df] text-slate-950 shadow-2xl shadow-slate-950/25">
              <div className="flex items-center justify-between gap-4 border-b border-slate-950/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-base font-black text-cyan-200">
                    {selectedPeer ? getInitials(selectedPeer.username) : "?"}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {selectedPeer ? selectedPeer.username : "Choose a chat"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {selectedPeer
                        ? selectedPeer.hasPublicKey
                          ? "Encrypted conversation"
                          : "They need to sync a key first"
                        : "Pick someone from your chats"}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={hasUnreadableMessages ? "warning" : messages.length ? "success" : "neutral"}>
                  {messages.length ? `${verifiedMessageCount}/${messages.length} readable` : "new chat"}
                </StatusBadge>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.14),_transparent_34%)] p-5">
                <MessageList
                  messages={messages}
                  selfUsername={profile?.username}
                  variant="chat"
                  emptyMessage={
                    selectedPeer
                      ? "No messages yet. Start with something only they should read."
                      : "Choose a person from the left to begin."
                  }
                />
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-slate-950/10 bg-[#efe5cf] p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    id="message"
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={2}
                    className="min-h-14 flex-1 resize-none rounded-2xl border border-slate-950/10 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
                    placeholder={
                      selectedPeer
                        ? `Message ${selectedPeer.username}...`
                        : "Choose a chat first..."
                    }
                    disabled={!selectedPeer || !isAuthenticated}
                  />
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedPeer || !isAuthenticated || !messageDraft.trim() || isBusy}
                  >
                    Send
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{status}</span>
                  {selectedPeer ? (
                    <span>{selectedPeer.hasPublicKey ? "Only devices with matching keys can read this." : "Ask them to sync their key."}</span>
                  ) : null}
                </div>
                {error ? (
                  <p className="mt-3 rounded-2xl bg-rose-100 px-4 py-3 text-sm leading-6 text-rose-800">
                    {error}
                  </p>
                ) : null}
              </form>
            </section>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
