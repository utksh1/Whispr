export function StatusBadge({ tone = "neutral", children }) {
  const className = {
    success: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    warning: "bg-amber-500/15 text-amber-100 ring-amber-400/30",
    danger: "bg-rose-500/15 text-rose-100 ring-rose-400/30",
    neutral: "bg-white/8 text-slate-200 ring-white/10",
  }[tone];

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}
