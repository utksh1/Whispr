import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.2),_transparent_32%),linear-gradient(180deg,_#071827,_#020817_68%)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cyan-950/20 sm:p-10">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Whispr public demo MVP</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            End-to-end encrypted messaging with a backend that only relays ciphertext.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Choose the product surface when you want a real authenticated chat flow, or open the demo harness when you need the side-by-side judge story with backend compromise proof.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/app"
              className="rounded-[1.75rem] border border-cyan-400/30 bg-cyan-400/10 p-6 transition hover:border-cyan-300 hover:bg-cyan-400/14"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Authenticated app</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Use Whispr like a real chat client</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Register, log in, upload your public key, discover peers, and exchange encrypted messages from a single authenticated session.
              </p>
            </Link>
            <Link
              href="/demo"
              className="rounded-[1.75rem] border border-white/10 bg-white/6 p-6 transition hover:border-white/20 hover:bg-white/8"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Judge demo</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Run the two-client compromise story</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Drive two authenticated participants side by side, show realtime delivery, and reveal the ciphertext-only backend view with optional tamper detection.
              </p>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Private by design</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Private keys stay in the browser. The server stores ciphertext, nonce, sender, receiver, and timestamps only.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Authenticated routing</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              JWT-protected HTTP and Socket.IO flows bind messages to authenticated identities instead of trusting client-supplied sender fields.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Hackathon-ready</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The normal product route and the dual-client story share one backend contract, so the demo stays honest to the actual implementation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
