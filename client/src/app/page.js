"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.18),_transparent_32%),linear-gradient(180deg,_#071827,_#020817_68%)] px-6 text-slate-100">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Whispr</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Opening your secure workspace...</h1>
      </div>
    </main>
  );
}
