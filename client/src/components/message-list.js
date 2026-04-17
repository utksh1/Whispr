import { StatusBadge } from "./status-badge";

export function MessageList({ messages, selfUsername, emptyMessage }) {
  if (messages.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm leading-7 text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex max-h-[30rem] flex-col gap-4 overflow-y-auto pr-1">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`rounded-2xl border px-4 py-4 ${
            message.senderUsername === selfUsername
              ? "border-cyan-500/30 bg-cyan-500/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-slate-400">
            <span>
              {message.senderUsername} to {message.receiverUsername}
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge tone={message.integrityStatus === "failed" ? "danger" : "success"}>
                {message.integrityStatus === "failed" ? "integrity failed" : "verified"}
              </StatusBadge>
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>
          <p
            className={`mt-3 text-base leading-7 ${
              message.integrityStatus === "failed" ? "text-rose-100" : "text-white"
            }`}
          >
            {message.plaintext}
          </p>
        </article>
      ))}
    </div>
  );
}
