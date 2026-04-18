import { StatusBadge } from "./status-badge";

export function MessageList({ messages, selfUsername, emptyMessage, variant = "technical" }) {
  if (messages.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm leading-7 text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  const isChatVariant = variant === "chat";

  return (
    <div className="flex max-h-[30rem] flex-col gap-4 overflow-y-auto pr-1">
      {messages.map((message) => {
        const isMine = message.senderUsername === selfUsername;
        const statusTone =
          message.integrityStatus === "verified"
            ? "success"
            : message.integrityStatus === "missing-key"
              ? "warning"
              : "danger";
        const statusLabel =
          message.integrityStatus === "verified"
            ? isChatVariant
              ? "sent"
              : "verified"
            : message.integrityStatus === "missing-key"
              ? "missing key"
              : "integrity failed";
        const messageTone =
          message.integrityStatus === "failed"
            ? "text-rose-100"
            : message.integrityStatus === "missing-key"
              ? "text-amber-100"
              : "text-white";

        return (
          <article
            key={message.id}
            className={`rounded-2xl border px-4 py-4 ${
              isMine
                ? "border-cyan-500/30 bg-cyan-500/10"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-slate-400">
              <span>{isChatVariant ? (isMine ? "You" : message.senderUsername) : `${message.senderUsername} to ${message.receiverUsername}`}</span>
              <div className="flex items-center gap-2">
                {isChatVariant && message.integrityStatus === "verified" ? null : (
                  <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                )}
                <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
            <p className={`mt-3 text-base leading-7 ${messageTone}`}>{message.plaintext}</p>
          </article>
        );
      })}
    </div>
  );
}
