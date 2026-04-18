"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const EMPTY_SNAPSHOT = {
  stats: {
    profiles: 0,
    publicKeys: 0,
    activePublicKeys: 0,
    encryptedBackups: 0,
    messages: 0,
    tamperedMessages: 0,
  },
  profiles: [],
  keys: [],
  backups: [],
  messages: [],
  fetchedAt: "",
  notice: "",
};

function formatTime(value) {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortId(value = "") {
  if (!value) {
    return "none";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function StatTile({ label, value, detail }) {
  return (
    <div className="rounded-lg border border-[#d5ddd7] bg-white p-4 shadow-[0_1px_0_rgba(23,32,29,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#17201d]">{value}</p>
      <p className="mt-2 text-sm text-[#607068]">{detail}</p>
    </div>
  );
}

function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: "border-[#cbd7d0] bg-white text-[#334039]",
    good: "border-[#8fc8a8] bg-[#e6f6ee] text-[#125334]",
    warn: "border-[#ddb96c] bg-[#fff5d8] text-[#765111]",
    danger: "border-[#e4a4a4] bg-[#fff0f0] text-[#8a2323]",
  };

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MonoBlock({ children, className = "" }) {
  return (
    <code className={`block break-all rounded-md border border-[#d5ddd7] bg-[#f4f7f4] p-3 font-mono text-xs leading-5 text-[#26312d] ${className}`}>
      {children || "not stored"}
    </code>
  );
}

function MessageRow({ message, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(message.id)}
      className={`grid w-full gap-3 rounded-lg border p-4 text-left transition md:grid-cols-[1fr_1.2fr_0.7fr] ${
        active
          ? "border-[#2f8f67] bg-[#eef9f2]"
          : "border-[#d5ddd7] bg-white hover:border-[#98ada1]"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[#17201d]">{message.senderUsername}</p>
          <span className="text-[#607068]">to</span>
          <p className="font-semibold text-[#17201d]">{message.receiverUsername}</p>
        </div>
        <p className="mt-2 text-sm text-[#607068]">{formatTime(message.createdAt)}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">Ciphertext preview</p>
        <p className="mt-2 break-all font-mono text-xs leading-5 text-[#334039]">{message.ciphertextPreview}</p>
      </div>
      <div className="flex flex-wrap items-start gap-2 md:justify-end">
        <Badge tone={message.tampered ? "danger" : "good"}>
          {message.tampered ? "tampered" : "stored encrypted"}
        </Badge>
        <Badge>{message.ciphertextLength} chars</Badge>
      </div>
    </button>
  );
}

function DirectoryTable({ title, rows, emptyMessage, renderRow }) {
  return (
    <section className="rounded-lg border border-[#d5ddd7] bg-white">
      <div className="border-b border-[#d5ddd7] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#334039]">{title}</h2>
      </div>
      <div className="divide-y divide-[#e4ebe6]">
        {rows.length ? rows.map(renderRow) : <p className="p-4 text-sm text-[#607068]">{emptyMessage}</p>}
      </div>
    </section>
  );
}

async function fetchAdminSnapshot() {
  const response = await fetch("/api/admin", {
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.setup || payload.error || "Admin snapshot failed.");
  }

  return payload;
}

export default function DemoAdminPage() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const selectedMessage = useMemo(() => {
    return (
      snapshot.messages.find((message) => message.id === selectedMessageId) ||
      snapshot.messages[0] ||
      null
    );
  }, [selectedMessageId, snapshot.messages]);

  const loadSnapshot = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const payload = await fetchAdminSnapshot();
      setSnapshot(payload);
      setSelectedMessageId((currentId) =>
        payload.messages.some((message) => message.id === currentId)
          ? currentId
          : payload.messages[0]?.id || ""
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSnapshot() {
      try {
        const payload = await fetchAdminSnapshot();

        if (cancelled) {
          return;
        }

        setSnapshot(payload);
        setSelectedMessageId(payload.messages[0]?.id || "");
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadSnapshot({ quiet: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [autoRefresh, loadSnapshot]);

  return (
    <main className="min-h-screen bg-[#f6f8f5] text-[#17201d]">
      <section className="border-b border-[#d5ddd7] bg-[#eef4ef]">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[1fr_340px] lg:px-8">
          <div>
            <a href="/demo" className="text-sm font-semibold text-[#2b7350] hover:text-[#16442f]">
              Back to demo
            </a>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-[#2b7350]">
              Compromised server view
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-[#17201d] md:text-5xl">
              The database has ciphertext, not conversations.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#4b5b52]">
              Supabase can list rows, IDs, timestamps, public keys, encrypted backups, and encrypted message payloads. Plaintext message bodies are absent.
            </p>
          </div>
          <div
            className="min-h-44 rounded-lg border border-[#cbd7d0] bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(20,32,28,0.2), rgba(20,32,28,0.64)), url('https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=900')",
            }}
          >
            <div className="flex h-full min-h-44 items-end p-4">
              <p className="rounded-md bg-white/88 px-3 py-2 text-sm font-semibold text-[#17201d]">
                Server-side audit lane
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-lg border border-[#d5ddd7] bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-[#17201d]">
              {loading ? "Reading Supabase tables..." : snapshot.notice || "Admin snapshot ready."}
            </p>
            <p className="mt-1 text-sm text-[#607068]">
              Last refresh: {snapshot.fetchedAt ? formatTime(snapshot.fetchedAt) : "not loaded yet"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((value) => !value)}
              className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                autoRefresh
                  ? "border-[#2f8f67] bg-[#e6f6ee] text-[#125334]"
                  : "border-[#cbd7d0] bg-white text-[#334039] hover:bg-[#f4f7f4]"
              }`}
            >
              Auto refresh {autoRefresh ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => loadSnapshot({ quiet: true })}
              className="rounded-md bg-[#17201d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2f3d36] disabled:opacity-60"
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-[#e4a4a4] bg-[#fff0f0] p-4 text-sm leading-6 text-[#8a2323]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Profiles" value={snapshot.stats.profiles} detail="User directory rows" />
          <StatTile label="Messages" value={snapshot.stats.messages} detail="Ciphertext payloads" />
          <StatTile label="Tampered" value={snapshot.stats.tamperedMessages} detail="Integrity demo rows" />
          <StatTile label="Public keys" value={snapshot.stats.publicKeys} detail={`${snapshot.stats.activePublicKeys} active`} />
          <StatTile label="Backups" value={snapshot.stats.encryptedBackups} detail="Encrypted keyrings" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#607068]">Messages table</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#17201d]">Ciphertext inventory</h2>
              </div>
              <Badge tone="warn">Plaintext column: absent</Badge>
            </div>

            <div className="flex flex-col gap-3">
              {snapshot.messages.length ? (
                snapshot.messages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    active={selectedMessage?.id === message.id}
                    onSelect={setSelectedMessageId}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-[#d5ddd7] bg-white p-6 text-sm text-[#607068]">
                  No encrypted messages are stored yet.
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#d5ddd7] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#607068]">Selected row</p>
                  <h2 className="mt-1 text-2xl font-semibold text-[#17201d]">
                    {selectedMessage ? shortId(selectedMessage.id) : "No message"}
                  </h2>
                </div>
                <Badge tone={selectedMessage ? (selectedMessage.tampered ? "danger" : "good") : "neutral"}>
                  {selectedMessage ? (selectedMessage.tampered ? "tampered" : "encrypted") : "waiting"}
                </Badge>
              </div>

              {selectedMessage ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">Conversation</p>
                    <p className="mt-2 text-sm text-[#334039]">
                      {selectedMessage.senderUsername} to {selectedMessage.receiverUsername}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-[#607068]">
                      {selectedMessage.conversationKey}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">Ciphertext</p>
                    <MonoBlock>{selectedMessage.raw.ciphertext}</MonoBlock>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">Nonce</p>
                      <MonoBlock>{selectedMessage.raw.nonce}</MonoBlock>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">Salt</p>
                      <MonoBlock>{selectedMessage.raw.salt}</MonoBlock>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#607068]">Server plaintext</p>
                    <MonoBlock className="border-[#ddb96c] bg-[#fff8e8] text-[#765111]">
                      Not present in Supabase
                    </MonoBlock>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#607068]">Send a demo message to inspect its backend payload.</p>
              )}
            </section>
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <DirectoryTable
            title="Profiles"
            rows={snapshot.profiles}
            emptyMessage="No profiles found."
            renderRow={(profile) => (
              <div key={profile.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#17201d]">{profile.username}</p>
                  <Badge tone={profile.hasPublicKey ? "good" : "warn"}>
                    {profile.hasPublicKey ? "public key" : "no key"}
                  </Badge>
                </div>
                <p className="mt-2 break-all text-xs text-[#607068]">{profile.id}</p>
                <p className="mt-2 text-sm text-[#607068]">{profile.email || "email not stored"}</p>
              </div>
            )}
          />

          <DirectoryTable
            title="Public Keys"
            rows={snapshot.keys}
            emptyMessage="No public keys found."
            renderRow={(key) => (
              <div key={key.keyId} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#17201d]">{key.username || shortId(key.userId)}</p>
                  <Badge tone={key.isActive ? "good" : "neutral"}>{key.isActive ? "active" : "historical"}</Badge>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-[#607068]">{key.keyId}</p>
                <p className="mt-2 break-all font-mono text-xs text-[#334039]">{key.publicKeyPreview}</p>
              </div>
            )}
          />

          <DirectoryTable
            title="Encrypted Backups"
            rows={snapshot.backups}
            emptyMessage="No encrypted key backups found."
            renderRow={(backup) => (
              <div key={backup.userId} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#17201d]">{shortId(backup.userId)}</p>
                  <Badge tone="good">encrypted</Badge>
                </div>
                <p className="mt-2 text-sm text-[#607068]">{backup.version}</p>
                <p className="mt-2 break-all font-mono text-xs text-[#334039]">{backup.ciphertextPreview}</p>
              </div>
            )}
          />
        </section>
      </div>
    </main>
  );
}
