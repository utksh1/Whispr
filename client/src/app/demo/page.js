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
  tamperMessage,
  updateMyPublicKey,
  REALTIME_ENABLED,
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

const DEMO_KEYS = {
  left: {
    session: "whispr-demo-left-session",
    identity: "whispr-demo-left-identity",
    defaultUsername: "alice",
  },
  right: {
    session: "whispr-demo-right-session",
    identity: "whispr-demo-right-identity",
    defaultUsername: "bob",
  },
};

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function counterpartSlot(slotId) {
  return slotId === "left" ? "right" : "left";
}

function createEmptyParticipant(slotId) {
  return {
    slotId,
    username: DEMO_KEYS[slotId].defaultUsername,
    password: "hackathon-demo-123",
    token: "",
    user: null,
    identity: {
      ready: false,
      publicKey: "",
      keyPair: null,
      uploadedPublicKey: null,
    },
    messages: [],
  };
}

function ParticipantCard({
  participant,
  active,
  onSelect,
  onChange,
  onAuth,
  onUploadKey,
  onRegenerateKey,
  onLogout,
}) {
  const currentKeyUploaded =
    participant.identity.uploadedPublicKey === participant.identity.publicKey &&
    Boolean(participant.identity.publicKey);

  return (
    <div
      className={`rounded-[1.5rem] border p-4 transition ${
        active ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
            {participant.slotId === "left" ? "Participant A" : "Participant B"}
          </p>
          <button
            type="button"
            onClick={() => onSelect(participant.slotId)}
            className="mt-2 text-left text-xl font-semibold text-white"
          >
            {participant.user?.username || participant.username}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={participant.token ? "success" : "warning"}>
            {participant.token ? "signed in" : "guest"}
          </StatusBadge>
          <StatusBadge tone={currentKeyUploaded ? "success" : "warning"}>
            {currentKeyUploaded ? "key uploaded" : "local only"}
          </StatusBadge>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Username</label>
          <input
            type="text"
            value={participant.username}
            onChange={(event) => onChange(participant.slotId, "username", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-slate-400">Password</label>
          <input
            type="password"
            value={participant.password}
            onChange={(event) => onChange(participant.slotId, "password", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAuth(participant.slotId, "register")}
          className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Register
        </button>
        <button
          type="button"
          onClick={() => onAuth(participant.slotId, "login")}
          className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => onUploadKey(participant.slotId)}
          className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
          disabled={!participant.token}
        >
          Upload key
        </button>
        <button
          type="button"
          onClick={() => onRegenerateKey(participant.slotId)}
          className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
        >
          New key
        </button>
        <button
          type="button"
          onClick={() => onLogout(participant.slotId)}
          className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/8"
        >
          Reset auth
        </button>
      </div>
    </div>
  );
}

export default function DemoSurface() {
  const [participants, setParticipants] = useState({
    left: createEmptyParticipant("left"),
    right: createEmptyParticipant("right"),
  });
  const [activeSender, setActiveSender] = useState("left");
  const [messageDraft, setMessageDraft] = useState("Judges, the server still cannot read this.");
  const [backendMessages, setBackendMessages] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [status, setStatus] = useState("Preparing two isolated demo clients...");
  const [error, setError] = useState("");
  const participantsRef = useRef(participants);
  const activeSenderRef = useRef(activeSender);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    activeSenderRef.current = activeSender;
  }, [activeSender]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const nextParticipants = {};

      for (const slotId of Object.keys(DEMO_KEYS)) {
        const storedSession = readStoredJson(DEMO_KEYS[slotId].session);
        const storedIdentity = readStoredJson(DEMO_KEYS[slotId].identity);
        const hydratedIdentity = await hydrateStoredIdentity(storedIdentity);

        nextParticipants[slotId] = {
          ...createEmptyParticipant(slotId),
          username: storedSession?.user?.username || DEMO_KEYS[slotId].defaultUsername,
          token: storedSession?.token || "",
          user: storedSession?.user || null,
          identity: hydratedIdentity,
        };
      }

      if (!cancelled) {
        setParticipants(nextParticipants);
        setStatus("Recovered both demo lanes. Validate auth and re-upload keys if needed.");
      }
    }

    hydrate().catch(() => {
      if (!cancelled) {
        setError("Failed to initialize demo participants in the browser.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function persistParticipants() {
      for (const [slotId, participant] of Object.entries(participants)) {
        if (participant.identity.ready && participant.identity.keyPair) {
          const serializedIdentity = await serializeIdentity(participant.identity);

          if (!cancelled) {
            writeStoredJson(DEMO_KEYS[slotId].identity, serializedIdentity);
          }
        }

        if (participant.token) {
          writeStoredJson(DEMO_KEYS[slotId].session, {
            token: participant.token,
            user: participant.user,
          });
        } else {
          clearStoredJson(DEMO_KEYS[slotId].session);
        }
      }
    }

    persistParticipants();

    return () => {
      cancelled = true;
    };
  }, [participants]);

  useEffect(() => {
    let cancelled = false;

    async function refreshParticipants() {
      for (const [slotId, participant] of Object.entries(participantsRef.current)) {
        if (!participant.token) {
          continue;
        }

        try {
          const result = await getCurrentUser(participant.token);

          if (cancelled) {
            return;
          }

          setParticipants((currentParticipants) => ({
            ...currentParticipants,
            [slotId]: {
              ...currentParticipants[slotId],
              user: result.user,
              username: result.user.username,
            },
          }));
        } catch (requestError) {
          if (!cancelled) {
            setError(`Could not restore ${slotId} session: ${requestError.message}`);
          }
        }
      }
    }

    refreshParticipants();

    return () => {
      cancelled = true;
    };
  }, [participants.left.token, participants.right.token]);

  const refreshDirectory = useCallback(async () => {
    const availableToken = participantsRef.current.left.token || participantsRef.current.right.token;

    if (!availableToken) {
      setDirectory([]);
      return;
    }

    try {
      const result = await listUsers(availableToken);
      setDirectory(result.users);
    } catch {
      setDirectory([]);
    }
  }, []);

  const refreshConversationForSlot = useCallback(async (slotId) => {
    const participant = participantsRef.current[slotId];
    const peer = participantsRef.current[counterpartSlot(slotId)];

    if (!participant.token || !participant.user || !participant.identity.keyPair || !peer.username) {
      setParticipants((currentParticipants) => ({
        ...currentParticipants,
        [slotId]: {
          ...currentParticipants[slotId],
          messages: [],
        },
      }));
      return;
    }

    try {
      const result = await fetchConversationMessages(participant.token, peer.username);
      const decryptedMessages = await decryptConversationMessages({
        messages: result.messages,
        selfUsername: participant.user.username,
        selfIdentity: participant.identity,
        resolvePublicKey: async (username) => {
          const publicKey = await getUserPublicKey(participant.token, username);
          return publicKey.publicKey;
        },
      });

      setParticipants((currentParticipants) => ({
        ...currentParticipants,
        [slotId]: {
          ...currentParticipants[slotId],
          messages: decryptedMessages,
        },
      }));

      if (slotId === activeSenderRef.current) {
        setBackendMessages(result.messages);
      }
    } catch (requestError) {
      setError(`Could not refresh ${slotId} conversation: ${requestError.message}`);
    }
  }, []);

  const refreshAllConversationViews = useCallback(async () => {
    await Promise.all(["left", "right"].map((slotId) => refreshConversationForSlot(slotId)));
    await refreshDirectory();
  }, [refreshConversationForSlot, refreshDirectory]);

  useEffect(() => {
    const sockets = [];

    Object.entries(participantsRef.current).forEach(([slotId, participant]) => {
      if (!participant.token) {
        return;
      }

      const socket = connectRealtime({
        token: participant.token,
        onConnect() {
          setStatus(`${participant.user?.username || slotId} reconnected for realtime demo delivery.`);
        },
        onConnectError() {
          setStatus("Realtime unavailable on one demo lane. Manual refresh is still available.");
        },
        onMessage() {
          refreshAllConversationViews();
        },
        onTampered() {
          refreshAllConversationViews();
          setStatus("Ciphertext was modified on the backend. Both demo clients should reject the payload.");
        },
      });

      sockets.push(socket);
    });

    return () => {
      sockets.forEach((socket) => socket.disconnect());
    };
  }, [participants.left.token, participants.right.token, refreshAllConversationViews]);

  useEffect(() => {
    if (REALTIME_ENABLED) {
      return undefined;
    }

    const hasAuthenticatedParticipant =
      Boolean(participants.left.token) || Boolean(participants.right.token);

    if (!hasAuthenticatedParticipant) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshAllConversationViews();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [participants.left.token, participants.right.token, refreshAllConversationViews]);

  useEffect(() => {
    refreshAllConversationViews();
  }, [participants.left.user?.username, participants.right.user?.username, refreshAllConversationViews]);

  async function handleAuth(slotId, mode) {
    const participant = participantsRef.current[slotId];

    try {
      setError("");
      const payload = {
        username: normalizeUsername(participant.username),
        password: participant.password,
      };
      const result =
        mode === "register" ? await registerUser(payload) : await loginUser(payload);

      setParticipants((currentParticipants) => ({
        ...currentParticipants,
        [slotId]: {
          ...currentParticipants[slotId],
          username: result.user.username,
          token: result.token,
          user: result.user,
        },
      }));
      setStatus(
        `${result.user.username} is ready on ${
          slotId === "left" ? "Participant A" : "Participant B"
        }.`
      );
      await refreshAllConversationViews();
    } catch (requestError) {
      setError(`Could not ${mode} ${participant.username}: ${requestError.message}`);
    }
  }

  async function handleUploadKey(slotId) {
    const participant = participantsRef.current[slotId];

    if (!participant.token) {
      return;
    }

    try {
      setError("");
      const result = await updateMyPublicKey(participant.token, participant.identity.publicKey);

      setParticipants((currentParticipants) => ({
        ...currentParticipants,
        [slotId]: {
          ...currentParticipants[slotId],
          user: result.user,
          identity: {
            ...currentParticipants[slotId].identity,
            uploadedPublicKey: currentParticipants[slotId].identity.publicKey,
          },
        },
      }));
      setStatus(`${result.user.username} uploaded a new public key. The private key never left the browser.`);
      await refreshAllConversationViews();
    } catch (requestError) {
      setError(`Could not upload the public key for ${participant.username}: ${requestError.message}`);
    }
  }

  async function handleRegenerateKey(slotId) {
    try {
      const nextIdentity = await generateLocalIdentity();

      setParticipants((currentParticipants) => ({
        ...currentParticipants,
        [slotId]: {
          ...currentParticipants[slotId],
          identity: nextIdentity,
        },
      }));
      setStatus(
        `${participantsRef.current[slotId].username} generated a fresh local keypair. Re-upload before sending.`
      );
    } catch {
      setError("Could not generate a new local keypair for the demo.");
    }
  }

  function handleParticipantFieldChange(slotId, field, value) {
    setParticipants((currentParticipants) => ({
      ...currentParticipants,
      [slotId]: {
        ...currentParticipants[slotId],
        [field]: field === "username" ? normalizeUsername(value) : value,
      },
    }));
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    const sender = participantsRef.current[activeSenderRef.current];
    const receiver = participantsRef.current[counterpartSlot(activeSenderRef.current)];

    try {
      setError("");

      if (!sender.token || !receiver.username) {
        throw new Error("log in both participants before sending messages");
      }

      const receiverKey = await getUserPublicKey(sender.token, receiver.username);
      const encryptedMessage = await encryptMessage({
        plaintext: messageDraft,
        senderIdentity: sender.identity,
        receiverPublicKey: receiverKey.publicKey,
      });

      await sendConversationMessage(sender.token, receiver.username, encryptedMessage);
      setMessageDraft("");
      setStatus(`${sender.user?.username || sender.username} encrypted locally and sent ciphertext to ${receiver.username}.`);
      await refreshAllConversationViews();
    } catch (requestError) {
      setError(`Could not send the encrypted message: ${requestError.message}`);
    }
  }

  async function handleTamperLatest() {
    const sender = participantsRef.current[activeSenderRef.current];
    const latestMessage = backendMessages[backendMessages.length - 1];

    if (!latestMessage || !sender.token) {
      return;
    }

    try {
      setError("");
      await tamperMessage(sender.token, latestMessage.id);
      setStatus("The backend payload was corrupted on purpose. Both clients should show integrity failure.");
      await refreshAllConversationViews();
    } catch (requestError) {
      setError(`Could not tamper with the latest ciphertext: ${requestError.message}`);
    }
  }

  function handleLogout(slotId) {
    setParticipants((currentParticipants) => ({
      ...currentParticipants,
      [slotId]: {
        ...currentParticipants[slotId],
        token: "",
        user: null,
        messages: [],
      },
    }));
    setStatus(`Cleared the saved auth session for ${slotId}.`);
  }

  const sender = participants[activeSender];
  const receiver = participants[counterpartSlot(activeSender)];
  const backendView = useMemo(() => buildBackendView(backendMessages), [backendMessages]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(180deg,_#071827,_#020817_68%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <TopNav title="Dual-Client Demo" subtitle="Two authenticated browser identities sharing the same protected backend contracts." />

        <section className="grid gap-6 lg:grid-cols-[1.05fr_1.1fr_0.9fr]">
          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Participants</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Two trusted devices</h2>
              </div>
              <button
                type="button"
                onClick={refreshDirectory}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/8"
              >
                Refresh users
              </button>
            </div>

            <ParticipantCard
              participant={participants.left}
              active={activeSender === "left"}
              onSelect={setActiveSender}
              onChange={handleParticipantFieldChange}
              onAuth={handleAuth}
              onUploadKey={handleUploadKey}
              onRegenerateKey={handleRegenerateKey}
              onLogout={handleLogout}
            />
            <ParticipantCard
              participant={participants.right}
              active={activeSender === "right"}
              onSelect={setActiveSender}
              onChange={handleParticipantFieldChange}
              onAuth={handleAuth}
              onUploadKey={handleUploadKey}
              onRegenerateKey={handleRegenerateKey}
              onLogout={handleLogout}
            />

            <div className="rounded-[1.5rem] border border-white/10 bg-[#030712]/40 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Authenticated user directory</p>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                {directory.length === 0 ? (
                  <p className="text-slate-400">No authenticated users are visible yet.</p>
                ) : (
                  directory.map((user) => (
                    <div key={user.id} className="rounded-xl border border-white/8 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-white">{user.username}</p>
                        <StatusBadge tone={user.hasPublicKey ? "success" : "warning"}>
                          {user.hasPublicKey ? "key ready" : "no key"}
                        </StatusBadge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Live demo flow</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {sender.user?.username || sender.username} to {receiver.user?.username || receiver.username}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={refreshAllConversationViews}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/8"
                >
                  Refresh fallback
                </button>
              </div>

              <form
                onSubmit={handleSendMessage}
                className="mt-5 rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/8 p-4"
              >
                <label htmlFor="demo-message" className="text-sm font-medium text-cyan-100">
                  Draft plaintext on the active sender device
                </label>
                <textarea
                  id="demo-message"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  placeholder="Write a secret message..."
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Encrypt and send
                  </button>
                  <button
                    type="button"
                    onClick={handleTamperLatest}
                    className="rounded-2xl border border-rose-400/35 bg-rose-500/12 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!backendMessages.length}
                  >
                    Tamper latest ciphertext
                  </button>
                  <StatusBadge tone="neutral">active sender: {sender.user?.username || sender.username}</StatusBadge>
                </div>
              </form>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-[#030712]/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Participant A timeline</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {participants.left.user?.username || participants.left.username}
                    </h3>
                  </div>
                  <StatusBadge tone={participants.left.messages.length ? "success" : "warning"}>
                    {participants.left.messages.length ? "decrypted" : "waiting"}
                  </StatusBadge>
                </div>
                <div className="mt-4">
                  <MessageList
                    messages={participants.left.messages}
                    selfUsername={participants.left.user?.username}
                    emptyMessage="Authenticate, upload a key, and start the demo flow."
                  />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#030712]/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Participant B timeline</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {participants.right.user?.username || participants.right.username}
                    </h3>
                  </div>
                  <StatusBadge tone={participants.right.messages.length ? "success" : "warning"}>
                    {participants.right.messages.length ? "decrypted" : "waiting"}
                  </StatusBadge>
                </div>
                <div className="mt-4">
                  <MessageList
                    messages={participants.right.messages}
                    selfUsername={participants.right.user?.username}
                    emptyMessage="Authenticate, upload a key, and start the demo flow."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <BackendPayloadPanel
              title="Compromised backend view"
              description="This panel shows what the server can inspect for the active conversation: sender, receiver, nonce, and ciphertext only."
              payload={backendView}
            />

            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Demo operator notes</p>
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
                  <p className="font-medium text-white">Suggested script</p>
                  <ul className="mt-2 space-y-2">
                    <li>1. Register or log in both demo users.</li>
                    <li>2. Upload both public keys.</li>
                    <li>3. Select the active sender and send a plaintext message.</li>
                    <li>4. Show both clients decrypt locally while the backend panel stays opaque.</li>
                    <li>5. Tamper with the latest ciphertext to trigger an integrity failure.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
