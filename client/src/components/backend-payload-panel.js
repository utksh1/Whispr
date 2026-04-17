export function BackendPayloadPanel({ title, description, payload }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#030712]/70 p-4 font-mono text-xs leading-6 text-slate-300">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}
