"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/top-nav";
import { StatusBadge } from "@/components/status-badge";
import { MessageList } from "@/components/message-list";
import { BackendPayloadPanel } from "@/components/backend-payload-panel";
import {
  fetchConversationMessages,
  getCurrentUser,
  getUserPublicKey,
  listUsers,
  loginUser,
  registerUser,
  sendConversationMessage,
  updateMyPublicKey,
} from "@/lib/api";
import {
  buildBackendView,
  connectRealtime,
  decryptConversationMessages,
} from "@/lib/chat";
import {
  encryptMessage,
  generateLocalIdentity,
  hydrateStoredIdentity,
  serializeIdentity,
} from "@/lib/crypto";
import { clearStoredJson, readStoredJson, writeStoredJson } from "@/lib/storage";
import { REALTIME_ENABLED } from "@/lib/api";

const APP_SESSION_KEY = "whispr-app-session";
const APP_IDENTITY_KEY = "whispr-app-identity";

const INITIAL_AUTH_FORM = {
  username: "",
  password: "",
};

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function AppSurface() {
  const [authMode, setAuthMode] = useState("register");
  const [formState, setFormState] = useState(INITIAL_AUTH_FORM);
  const [session, setSession] = useState({ token: "", user: null, ready: false });
  const [identity, setIdentity] = useState({ ready: false, publicKey: "", keyPair: null, uploadedPublicKey: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [directory, setDirectory] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("The backend only gets ciphertext from me.");
  const [status, setStatus] = useState("Loading secure local state...");
  const [error, setError] = useState("");
  const [socketReady, setSocketReady] = useState(false);
  const sessionRef = useRef(session);
  const selectedPeerRef = useRef(selectedPeer);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    selectedPeerRef.current = selectedPeer;
  }, [selectedPeer]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const storedSession = readStoredJson(APP_SESSION_KEY);
        const storedIdentity = readStoredJson(APP_IDENTITY_KEY);
        const hydratedIdentity = await hydrateStoredIdentity(storedIdentity);

        if (cancelled) {
          return;
        }

        setIdentity(hydratedIdentity);
        setSession({
          token: storedSession?.token || "",
          user: storedSession?.user || null,
          ready: true,
        });
        setStatus(
          storedSession?.token
            ? "Recovered your encrypted chat session. Revalidating auth..."
            : "Generate or restore your local key, then register or log in."
        );
      } catch {
        if (!cancelled) {
          setError("Failed to initialize local cryptography in this browser.");
        }
      }
    }

    hydrate();

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

  useEffect(() => {
    if (!session.ready) {
      return;
    }

    if (!session.token) {
      clearStoredJson(APP_SESSION_KEY);
      return;
    }

    writeStoredJson(APP_SESSION_KEY, session);
  }, [session]);

  useEffect(() => {
    if (!session.ready || !session.token) {
      return;
    }

    let cancelled = false;

    async function refreshMe() {
      try {
        const result = await getCurrentUser(session.token);

        if (cancelled) {
          return;
        }

        setSession((currentSession) => ({
          ...currentSession,
          user: result.user,
        }));
        setStatus(`Authenticated as ${result.user.username}.`);
      } catch (requestError) {
        if (!cancelled) {
          setSession({ token: "", user: null, ready: true });
          setMessages([]);
          setDirectory([]);
          setStatus("Session expired. Log in again to continue.");
          setError(`Could not restore the saved session: ${requestError.message}`);
        }
      }
    }

    refreshMe();

    return () => {
      cancelled = true;
    };
  }, [session.ready, session.token]);

  useEffect(() => {
    if (!session.user || !session.token) {
      return;
    }

    let cancelled = false;

    async function loadDirectory() {
      try {
        const result = await listUsers(session.token, searchQuery);
        const peers = result.users.filter((user) => user.username !== session.user.username);

        if (cancelled) {
          return;
        }

        setDirectory(peers);

        if (!selectedPeer && peers.length > 0) {
          const firstPeer = peers.find((user) => user.hasPublicKey) || peers[0];
          setSelectedPeer(firstPeer.username);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(`Could not load users: ${requestError.message}`);
        }
      }
    }

    loadDirectory();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, selectedPeer, session.token, session.user]);

  const refreshConversation = useCallback(async (peerUsername = selectedPeerRef.current) => {
    if (!sessionRef.current.token || !sessionRef.current.user || !peerUsername || !identity.keyPair) {
      setMessages([]);
      return;
    }

    try {
      const conversation = await fetchConversationMessages(sessionRef.current.token, peerUsername);
      const publicKeyCache = new Map();
      const decryptedMessages = await decryptConversationMessages({
        messages: conversation.messages,
        selfUsername: sessionRef.current.user.username,
        selfIdentity: identity,
        resolvePublicKey: async (username) => {
          if (!publicKeyCache.has(username)) {
            const result = await getUserPublicKey(sessionRef.current.token, username);
            publicKeyCache.set(username, result.publicKey);
          }

          return publicKeyCache.get(username);
        },
      });

      setMessages(decryptedMessages);
    } catch (requestError) {
      setError(`Could not load conversation: ${requestError.message}`);
    }
  }, [identity]);

  useEffect(() => {
    refreshConversation();
  }, [identity.keyPair, refreshConversation, selectedPeer, session.token, session.user?.username]);

  useEffect(() => {
    if (!session.token) {
      return undefined;
    }

    const socket = connectRealtime({
      token: session.token,
      onConnect() {
        setSocketReady(true);
      },
      onDisconnect() {
        setSocketReady(false);
      },
      onConnectError() {
        setSocketReady(false);
        setStatus("Realtime unavailable. Manual refresh still works.");
      },
      onMessage(message) {
        const peerUsername =
          message.senderUsername === sessionRef.current.user?.username
            ? message.receiverUsername
            : message.senderUsername;

        if (peerUsername === selectedPeerRef.current) {
          refreshConversation(peerUsername);
        }
      },
      onTampered(message) {
        const peerUsername =
          message.senderUsername === sessionRef.current.user?.username
            ? message.receiverUsername
            : message.senderUsername;

        if (peerUsername === selectedPeerRef.current) {
          refreshConversation(peerUsername);
          setStatus("Ciphertext was tampered with on the backend. The client should reject it.");
        }
      },
    });

    return () => {
      socket.disconnect();
      setSocketReady(false);
    };
  }, [refreshConversation, session.token]);

  useEffect(() => {
    if (REALTIME_ENABLED || !session.token || !selectedPeer) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshConversation();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshConversation, selectedPeer, session.token]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const username = normalizeUsername(formState.username);
      const requestInput = {
        username,
        password: formState.password,
      };
      const response =
        authMode === "register"
          ? await registerUser(requestInput)
          : await loginUser(requestInput);

      setSession({
        token: response.token,
        user: response.user,
        ready: true,
      });
      setFormState({
        username,
        password: "",
      });
      setStatus(
        authMode === "register"
          ? `Account created for ${response.user.username}. Upload your public key to start chatting.`
          : `Welcome back, ${response.user.username}.`
      );
    } catch (requestError) {
      setError(
        authMode === "register"
          ? `Could not create the account: ${requestError.message}`
          : `Could not log in: ${requestError.message}`
      );
    }
  }

  async function uploadPublicKey() {
    if (!session.token || !identity.publicKey) {
      return;
    }

    setError("");

    try {
      const result = await updateMyPublicKey(session.token, identity.publicKey);

      setIdentity((currentIdentity) => ({
        ...currentIdentity,
        uploadedPublicKey: currentIdentity.publicKey,
      }));
      setSession((currentSession) => ({
        ...currentSession,
        user: result.user,
      }));
      setStatus("Uploaded the current browser public key. Private key material stayed local.");
    } catch (requestError) {
      setError(`Could not upload the public key: ${requestError.message}`);
    }
  }

  async function regenerateKey() {
    try {
      setError("");
      const nextIdentity = await generateLocalIdentity();

      setIdentity(nextIdentity);
      setStatus("Generated a fresh local keypair. Upload the new public key before sending messages.");
    } catch {
      setError("Could not generate a new local keypair.");
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!selectedPeer || !session.token || !identity.keyPair) {
      return;
    }

    setError("");

    try {
      const peerKey = await getUserPublicKey(session.token, selectedPeer);
      const encryptedMessage = await encryptMessage({
        plaintext: messageDraft,
        senderIdentity: identity,
        receiverPublicKey: peerKey.publicKey,
      });

      await sendConversationMessage(session.token, selectedPeer, encryptedMessage);
      setMessageDraft("");
      setStatus(`Encrypted locally as ${session.user.username} and relayed ciphertext to ${selectedPeer}.`);
      await refreshConversation(selectedPeer);
    } catch (requestError) {
      setError(`Could not send the encrypted message: ${requestError.message}`);
    }
  }

  function handleLogout() {
    setSession({ token: "", user: null, ready: true });
    setDirectory([]);
    setSelectedPeer("");
    setMessages([]);
    setStatus("Logged out locally. Your browser still retains the private key unless you regenerate it.");
  }

  const isAuthenticated = Boolean(session.token && session.user);
  const isCurrentKeyUploaded =
    identity.uploadedPublicKey && identity.uploadedPublicKey === identity.publicKey;
  const backendView = useMemo(() => buildBackendView(messages), [messages]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(180deg,_#071827,_#020817_68%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <TopNav title="Authenticated Whispr" subtitle="One signed-in user, one local private key, ciphertext-only transport." />

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Identity</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {isAuthenticated ? session.user.username : "Sign in to chat"}
                </h2>
              </div>
              <StatusBadge tone={socketReady ? "success" : "warning"}>
                {socketReady ? "realtime ready" : "manual refresh"}
              </StatusBadge>
            </div>

            {!isAuthenticated ? (
              <form onSubmit={handleAuthSubmit} className="mt-5 flex flex-col gap-4">
                <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 p-1">
                  {["register", "login"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAuthMode(mode)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        authMode === mode ? "bg-cyan-400 text-slate-950" : "text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Username</label>
                <input
                  type="text"
                  value={formState.username}
                  onChange={(event) =>
                    setFormState((currentForm) => ({
                      ...currentForm,
                      username: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="alice"
                />

                <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Password</label>
                <input
                  type="password"
                  value={formState.password}
                  onChange={(event) =>
                    setFormState((currentForm) => ({
                      ...currentForm,
                      password: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="Use at least 8 characters"
                />

                <button
                  type="submit"
                  className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  {authMode === "register" ? "Create account" : "Log in"}
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-[#030712]/40 p-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="neutral">JWT session active</StatusBadge>
                    <StatusBadge tone={session.user.hasPublicKey ? "success" : "warning"}>
                      {session.user.hasPublicKey ? "server key on file" : "server key missing"}
                    </StatusBadge>
                    <StatusBadge tone={isCurrentKeyUploaded ? "success" : "warning"}>
                      {isCurrentKeyUploaded ? "current key uploaded" : "current key local only"}
                    </StatusBadge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    Your private key lives in browser storage for this MVP. Regenerating the key makes the existing server-side key stale until you upload again.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={uploadPublicKey}
                      className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Upload current public key
                    </button>
                    <button
                      type="button"
                      onClick={regenerateKey}
                      className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                    >
                      Generate new key
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/8"
                    >
                      Log out
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-[#030712]/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Directory</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Find someone to message</h3>
                    </div>
                    <StatusBadge tone="neutral">{directory.length} users</StatusBadge>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(normalizeUsername(event.target.value))}
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Search usernames"
                  />
                  <div className="mt-4 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                    {directory.length === 0 ? (
                      <p className="text-sm leading-6 text-slate-400">No matching users yet.</p>
                    ) : (
                      directory.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedPeer(user.username)}
                          className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition ${
                            selectedPeer === user.username
                              ? "border-cyan-400 bg-cyan-400/10"
                              : "border-white/10 bg-white/5 hover:bg-white/8"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium text-white">{user.username}</p>
                            <StatusBadge tone={user.hasPublicKey ? "success" : "warning"}>
                              {user.hasPublicKey ? "key ready" : "no key"}
                            </StatusBadge>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Conversation</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedPeer ? `You and ${selectedPeer}` : "Choose a recipient"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => refreshConversation()}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/8"
                disabled={!selectedPeer}
              >
                Refresh
              </button>
            </div>

            <form
              onSubmit={handleSendMessage}
              className="mt-5 rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/8 p-4"
            >
              <label htmlFor="message" className="text-sm font-medium text-cyan-100">
                Draft plaintext on this device
              </label>
              <textarea
                id="message"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                rows={4}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                placeholder="Write a secret message..."
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedPeer || !isAuthenticated || !messageDraft.trim()}
                >
                  Encrypt and send
                </button>
                {selectedPeer ? <StatusBadge tone="neutral">peer: {selectedPeer}</StatusBadge> : null}
              </div>
            </form>

            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#030712]/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Decrypted timeline</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Visible on your device only</h3>
                </div>
                <StatusBadge tone={messages.length ? "success" : "warning"}>
                  {messages.length ? `${messages.length} decrypted` : "waiting"}
                </StatusBadge>
              </div>
              <div className="mt-4">
                <MessageList
                  messages={messages}
                  selfUsername={session.user?.username}
                  emptyMessage="Upload your public key, choose a peer with a key, then start the conversation."
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <BackendPayloadPanel
              title="Ciphertext-only backend view"
              description="This mirrors what the server can inspect for the selected conversation."
              payload={backendView}
            />

            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Runtime status</p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                <div>
                  <p className="font-medium text-white">Status</p>
                  <p className="mt-1">{status}</p>
                </div>
                {error ? (
                  <div>
                    <p className="font-medium text-rose-200">Error</p>
                    <p className="mt-1 text-rose-100">{error}</p>
                  </div>
                ) : null}
                <div>
                  <p className="font-medium text-white">What stays private</p>
                  <p className="mt-1">
                    Plaintext and private keys remain on the browser. The backend only gets relay-safe ciphertext and metadata.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
