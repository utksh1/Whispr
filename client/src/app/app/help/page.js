"use client";

import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";

const FAQS = [
  { q: "Why are some messages unreadable?", a: "Whispr uses end-to-end encryption. If you clear your browser data or log in from a new device without a key backup, you won't be able to read old messages." },
  { q: "Where are my private keys?", a: "They stay in your browser's local storage. We never see them. If you use a password to back them up, they are encrypted with that password before being stored in our vault." },
  { q: "Is Whispr open source?", a: "Yes, our protocol and client-side encryption logic are fully transparent and auditable." },
  { q: "How do I start a whisper?", a: "Go to the Contacts page, find a peer, and click the chat icon. If they haven't synced their public key yet, you can still message them, but it will wait for their key to arrive." }
];

export default function HelpPage() {
  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Assistance</h2>
            <div className="p-6 bg-primary text-on-primary rounded-[2rem] shadow-lg shadow-primary/20 italic">
              &ldquo;In the quiet of the sanctuary, clarity is found.&rdquo;
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-surface p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">FAQ</h1>
              <p className="text-on-surface-variant font-light">Understanding the mechanics of the silence.</p>
            </header>

            <div className="space-y-6">
              {FAQS.map((faq, i) => (
                <div key={i} className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/5">
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                    {faq.q}
                  </h3>
                  <p className="text-on-surface-variant font-light leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>

            <footer className="mt-12 p-8 bg-surface-container-highest rounded-[3rem] text-center border border-dashed border-outline-variant/20">
              <p className="text-sm text-on-surface-variant mb-4">Still need help?</p>
              <button className="bg-on-surface text-surface px-8 py-3 rounded-full font-bold hover:opacity-80 transition-opacity">
                Contact Support
              </button>
            </footer>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </main>
  );
}
