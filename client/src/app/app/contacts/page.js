"use client";

import { useEffect, useState } from "react";
import { TopAppBar } from "@/components/ui/TopAppBar";
import { BottomNavBar } from "@/components/ui/BottomNavBar";
import { Icon } from "@/components/ui/Icon";
import { 
  listSupabaseUsers, 
  getCurrentSupabaseUser
} from "@/lib/supabase-chat";

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchContacts() {
      try {
        const user = await getCurrentSupabaseUser();
        if (!user || cancelled) {
          return;
        }

        const users = await listSupabaseUsers(searchQuery, user.$id);
        if (!cancelled) {
          setContacts(users);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
        }
      }
    }

    fetchContacts();

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-surface text-on-surface">
      <TopAppBar />
      <div className="flex-1 flex overflow-hidden pt-24 pb-24 md:pb-0 max-w-screen-2xl mx-auto w-full">
        <aside className="hidden md:flex flex-col w-80 bg-surface-container-low h-full rounded-r-3xl mr-6 p-4">
          <div className="px-4 py-2">
            <h2 className="text-xl font-semibold tracking-tight text-on-surface mb-6 font-headline">Directory</h2>
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant/50" />
              <input 
                type="text" 
                placeholder="Find a whisperer..."
                className="w-full bg-surface-container-lowest border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-body active:ring-0 focus:ring-1 focus:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-surface p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <header className="mb-12">
              <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">Contacts</h1>
              <p className="text-on-surface-variant font-light">Connect with others in the sanctuary.</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {contacts.map((contact) => (
                <div key={contact.$id} className="bg-surface-container-low p-6 rounded-[2rem] hover:shadow-[0_20px_60px_rgba(48,51,51,0.06)] transition-all group border border-transparent hover:border-primary/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-3xl bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-bold group-hover:scale-105 transition-transform">
                      {contact.username[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-on-surface">{contact.username}</h3>
                      <p className="text-sm text-on-surface-variant font-light truncate max-w-[150px]">{contact.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-6">
                    <span className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full ${contact.hasPublicKey ? "bg-primary/10 text-primary" : "bg-outline-variant/20 text-on-surface-variant"}`}>
                      {contact.hasPublicKey ? "E2EE Enabled" : "Keys Pending"}
                    </span>
                    <button className="bg-primary text-on-primary w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary-dim transition-colors shadow-lg shadow-primary/20">
                      <Icon name="chat_bubble" className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {contacts.length === 0 && (
              <div className="text-center py-24">
                <Icon name="person_search" className="text-6xl text-outline-variant mb-4 opacity-20" />
                <p className="text-on-surface-variant italic">The silence is deep here. Try another name.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      <BottomNavBar />
    </main>
  );
}
