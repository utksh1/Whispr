"use client";

import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";
import { Icon } from "@/components/ui/Icon";

const DISCOVER_ITEMS = [
  { id: 1, name: "The Quiet Room", type: "public_channel", members: "1.2k", description: "Minimalist discussion on sound and silence.", theme: "bg-surface-dim" },
  { id: 2, name: "Whispr Devs", type: "official", members: "42", description: "Updates and experiments from the core team.", theme: "bg-primary-container/20" },
  { id: 3, name: "Nova Anthology", type: "public_channel", members: "800", description: "Curated poetry and short fiction whispers.", theme: "bg-secondary-container/20" },
];

export default function DiscoverPage() {
  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Explore</h2>
            <div className="bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/10 shadow-sm">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Trending Tags</p>
              <div className="flex flex-wrap gap-2">
                {['#silence', '#encryption', '#poetry', '#privacy', '#zen'].map(tag => (
                  <span key={tag} className="px-3 py-1 bg-surface-container-highest text-[10px] font-bold rounded-full text-on-surface-variant hover:bg-primary hover:text-on-primary transition-colors cursor-pointer">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-surface p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">Discover</h1>
              <p className="text-on-surface-variant font-light">Find voices that resonate or explore the quietest corners of the sanctuary.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DISCOVER_ITEMS.map((item) => (
                <div key={item.id} className={`${item.theme} p-8 rounded-[3rem] group hover:shadow-[0_40px_100px_rgba(48,51,51,0.08)] transition-all flex flex-col justify-between border border-outline-variant/5`}>
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center shadow-sm">
                        <Icon name={item.type === 'official' ? 'verified' : 'groups'} className="text-2xl text-primary" />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant/40">{item.members} members</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors italic">{item.name}</h3>
                    <p className="text-on-surface-variant font-light leading-relaxed mb-8">{item.description}</p>
                  </div>
                  <button className="w-full py-4 bg-surface text-on-surface font-bold rounded-2xl shadow-sm hover:bg-primary hover:text-on-primary transition-all">
                    Join Conversation
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <BottomNavBar />
    </main>
  );
}
